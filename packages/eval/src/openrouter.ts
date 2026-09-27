import type { Task } from "@hub/schema";
import type { GenerateFn } from "./run";
import { HttpError, reessayer } from "./retry";

const BASE = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Isole l'objet JSON d'une réponse de modèle.
 *
 * Les modèles encadrent volontiers leur JSON de texte ou de balises de code.
 * Refuser ces réponses reviendrait à mesurer le respect d'une consigne de
 * forme plutôt que la lecture du document ; on extrait donc l'objet.
 */
export function extraireJson(contenu: string): Record<string, unknown> | null {
  const sansBalises = contenu.replace(/```(?:json)?/gi, "");
  const debut = sansBalises.indexOf("{");
  const fin = sansBalises.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    const v: unknown = JSON.parse(sansBalises.slice(debut, fin + 1));
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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
  apiKey: string;
  provider?: ProviderOptions;
  maxTokens?: number;
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
        max_tokens: opts.maxTokens ?? 2000,
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

    const texte = json.choices?.[0]?.message?.content ?? "";
    const objet = extraireJson(texte);
    if (objet === null) {
      throw new Error(`réponse sans JSON exploitable : ${texte.slice(0, 160)}`);
    }

    // On ne garde que les clés du barème : une clé inventée hors barème ne doit
    // ni être notée, ni encombrer le fichier de résultats.
    const attendues = new Set(task.criteria.map((c) => c.id));
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
