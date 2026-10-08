import type { Task } from "@hub/schema";
import { ErreurFacturee, type GenerateFn } from "./run";
import { HttpError, reessayer } from "./retry";

const BASE = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Longueur du texte conservé quand une réponse n'a pas pu être lue.
 *
 * Ce texte est tout ce qui reste d'un appel facturé : 160 caractères ne
 * permettaient pas de dire si le refus venait du modèle ou de notre extracteur.
 */
const TEXTE_CONSERVE = 2000;

/**
 * Les objets JSON de premier niveau d'un texte, dans l'ordre où ils apparaissent.
 *
 * On parcourt le texte en comptant les accolades, chaînes de caractères
 * comprises : une accolade écrite dans une chaîne ne ferme rien. Un fragment
 * qui ressemble à un objet sans en être un — une accolade de prose, une
 * formule — est sauté.
 */
function objetsJson(texte: string): Record<string, unknown>[] {
  const objets: Record<string, unknown>[] = [];
  let i = 0;
  while (i < texte.length) {
    if (texte[i] !== "{") { i++; continue; }
    let profondeur = 0, dansChaine = false, fin = -1;
    for (let j = i; j < texte.length; j++) {
      const c = texte[j]!;
      if (dansChaine) {
        if (c === "\\") j++;
        else if (c === '"') dansChaine = false;
      } else if (c === '"') dansChaine = true;
      else if (c === "{") profondeur++;
      else if (c === "}" && --profondeur === 0) { fin = j; break; }
    }
    if (fin < 0) { i++; continue; }
    try {
      const v: unknown = JSON.parse(texte.slice(i, fin + 1));
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        objets.push(v as Record<string, unknown>);
        i = fin + 1;
        continue;
      }
    } catch { /* ce n'était pas du JSON */ }
    i++;
  }
  return objets;
}

/**
 * Isole l'objet JSON d'une réponse de modèle.
 *
 * Les modèles encadrent volontiers leur JSON de texte ou de balises de code, et
 * le font suivre d'un calcul qui contient lui-même des accolades. Refuser ces
 * réponses reviendrait à mesurer le respect d'une consigne de forme plutôt que
 * la lecture du document ; on extrait donc l'objet.
 *
 * Quand le modèle a écrit la même réponse deux fois, on la prend. Quand il a
 * écrit plusieurs objets, on les réunit tant qu'ils ne se contredisent pas.
 * Quand deux d'entre eux donnent des valeurs différentes à une même clé, on ne
 * choisit pas à sa place : l'appel est traité comme inexploitable, et rejoué.
 */
export function extraireJson(contenu: string): Record<string, unknown> | null {
  const objets = objetsJson(contenu.replace(/```(?:json)?/gi, ""));
  if (objets.length === 0) return null;
  const reunion: Record<string, unknown> = {};
  for (const objet of objets) {
    for (const [cle, valeur] of Object.entries(objet)) {
      if (cle in reunion && JSON.stringify(reunion[cle]) !== JSON.stringify(valeur)) return null;
      reunion[cle] = valeur;
    }
  }
  return reunion;
}

export type ProviderOptions = {
  /** Hébergeurs autorisés, dans l'ordre de préférence. */
  order?: string[];
  /** false = pas de report sur un autre hébergeur, donc mesure reproductible. */
  allow_fallbacks?: boolean;
  /** "deny" écarte les hébergeurs qui conservent les données. */
  data_collection?: "allow" | "deny";
  /** Niveaux de compression acceptés : un modèle compressé répond moins bien. */
  quantizations?: string[];
};

export type OpenRouterOptions = {
  /** Délai maximal d'un appel, en millisecondes. Au-delà, l'appel est repris. */
  timeoutMs?: number;
  apiKey: string;
  provider?: ProviderOptions;
  maxTokens?: number;
  /**
   * Plafond propre à certains modèles, par alias.
   *
   * Un modèle qui réfléchit longuement avant de répondre peut épuiser le plafond
   * commun sans avoir eu la place d'écrire son JSON : l'appel est facturé et
   * rendu inexploitable. Relever le plafond pour tout le monde coûterait plus
   * cher en crédit réservé à chaque requête ; on le relève donc là où c'est
   * nécessaire, et nulle part ailleurs.
   */
  maxTokensParModele?: Record<string, number>;
  /** Informe des reprises, pour que le run ne paraisse pas figé. */
  surReprise?: (model: string, docId: string, tentative: number, attenteMs: number) => void;
};

type Reponse = {
  model?: string;
  provider?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string };
};

/** Appelle un modèle via OpenRouter, en envoyant les pages du document en images. */
export function createOpenRouterGenerate(opts: OpenRouterOptions): GenerateFn {
  return async ({ model, docId, promptText, images, task }: {
    model: string; docId: string; promptText: string; images: Buffer[]; task: Task;
  }) => {
    const started = Date.now();

    const contenu = [
      { type: "text" as const, text: promptText },
      ...images.map((b) => ({
        type: "image_url" as const,
        image_url: { url: `data:image/jpeg;base64,${b.toString("base64")}` },
      })),
    ];

    const appeler = async (): Promise<Response> => fetch(BASE, {
      method: "POST",
      // Sans délai maximal, une connexion qui ne répond plus bloque l'appel pour
      // toujours. À deux appels simultanés, deux connexions mortes figent le run
      // entier : c'est arrivé après 194 appels, sans message d'erreur, le
      // processus attendant une réponse qui ne venait jamais. Quatre minutes
      // laissent largement répondre les modèles les plus lents — la médiane la
      // plus haute mesurée est de 39 secondes — et un dépassement est traité
      // comme une erreur passagère, donc réessayé.
      signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/flowera/hub-evals",
        "X-Title": "Hub d'evaluations metier",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: contenu }],
        temperature: 0,
        max_tokens: opts.maxTokensParModele?.[model] ?? opts.maxTokens ?? 2000,
        usage: { include: true },
        ...(opts.provider === undefined ? {} : { provider: opts.provider }),
      }),
    });

    const json = await reessayer(async () => {
      const rep = await appeler();
      if (!rep.ok) {
        const corps = (await rep.text()).slice(0, 300);
        const entete = rep.headers.get("retry-after");
        const retryAfterMs = entete === null ? undefined : Number(entete) * 1000;
        throw new HttpError(rep.status, `${rep.status} ${rep.statusText} — ${corps}`,
          Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
      }
      const j = (await rep.json()) as Reponse;
      if (j.error !== undefined) throw new Error(j.error.message ?? "erreur OpenRouter");
      return j;
    }, {
      surReprise: (t, ms) => { opts.surReprise?.(model, docId, t, ms); },
    });

    const latencyMs = Date.now() - started;

    const facture = {
      costUsd: json.usage?.cost ?? 0,
      ...(json.model === undefined ? {} : { modelVersion: json.model }),
      ...(json.provider === undefined ? {} : { provider: json.provider }),
      ...(json.usage?.prompt_tokens === undefined ? {} : { inputTokens: json.usage.prompt_tokens }),
      ...(json.usage?.completion_tokens === undefined ? {} : { outputTokens: json.usage.completion_tokens }),
    };

    const texte = json.choices?.[0]?.message?.content ?? "";
    const objet = extraireJson(texte);
    if (objet === null) {
      // L'appel a été facturé même si sa réponse est inutilisable.
      throw new ErreurFacturee(
        `réponse sans JSON exploitable : ${texte.slice(0, TEXTE_CONSERVE)}`, facture);
    }

    // On ne garde que les clés du barème : une clé inventée hors barème ne doit
    // ni être notée, ni encombrer le fichier de résultats.
    const attendues = new Set(task.criteria.map((c) => c.key ?? c.id));
    const filtre = Object.fromEntries(
      Object.entries(objet).filter(([k]) => attendues.has(k)),
    );

    return {
      object: filtre,
      modelVersion: json.model ?? model,
      latencyMs,
      costUsd: json.usage?.cost ?? 0,
      ...(json.provider === undefined ? {} : { provider: json.provider }),
      ...(json.usage?.prompt_tokens === undefined ? {} : { inputTokens: json.usage.prompt_tokens }),
      ...(json.usage?.completion_tokens === undefined ? {} : { outputTokens: json.usage.completion_tokens }),
    };
  };
}
