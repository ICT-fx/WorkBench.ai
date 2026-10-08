import { createHash } from "node:crypto";
import {
  TestProtocolSchema,
  type Criterion, type Leaderboard, type ModelResult, type RunCalendar, type TestProtocol,
} from "@hub/schema";

/**
 * Le test figé d'un benchmark publié.
 *
 * Un classement n'a de valeur dans la durée que si un modèle sorti six mois plus
 * tard peut passer exactement le même test : mêmes documents, mêmes pages, même
 * prompt, même barème, mêmes paramètres. Ce module écrit ce test noir sur blanc au
 * moment de la publication, et refuse de lancer un appel payant si le test que
 * l'on s'apprête à rejouer n'est plus celui qui a été publié.
 */

/**
 * Les paramètres d'appel, communs à tous les runs. Ils sont ici, et non dans la
 * commande, pour que la publication les consigne tels qu'ils ont servi.
 */
export const PARAMETRES_APPEL = {
  // Certains modèles réfléchissent longuement avant de répondre : à 3 000
  // jetons, quarante-trois réponses sont revenues vides ou tronquées,
  // faute de place pour écrire le JSON après la réflexion.
  maxTokens: 8000,
  maxTokensByModel: {
    // Cohere atteint exactement le plafond commun cinq fois sur six et n'a plus la
    // place d'écrire sa réponse : l'appel est facturé pour rien, et la facture
    // concernée est écartée du classement pour tout le panel.
    "cohere/command-a-plus": 20000,
    // Mesuré le 07/10 sur l'analyse de rapports : à 8 000 jetons, ces quatre
    // modèles ont réfléchi sans écrire de réponse sur 9 appels (0,5 $ facturés
    // pour rien). Le plafond est relevé là, et nulle part ailleurs.
    "moonshotai/kimi-k3": 16000,
    "moonshotai/kimi-k2.6": 16000,
    "qwen/qwen3.7-flash": 16000,
    "qwen/qwen3.8-max-0902": 16000,
  } as Record<string, number>,
  // Le report sur un autre hébergeur est autorisé : l'interdire a fait
  // échouer tous les appels d'un modèle dont l'hébergeur principal était
  // en panne. L'hébergeur réellement utilisé est enregistré à chaque
  // appel, ce qui suffit à rendre le run vérifiable.
  allowProviderFallbacks: true,
};

const court = (hash: ReturnType<typeof createHash>, longueur: number): string =>
  hash.digest("hex").slice(0, longueur);

/** L'empreinte d'un gabarit de prompt : celle que chaque `run.json` porte déjà. */
export const empreintePrompt = (promptText: string): string =>
  court(createHash("sha256").update(promptText), 12);

/** L'empreinte du barème : changer un critère, un poids ou une tolérance la change. */
export const empreinteBareme = (criteria: Criterion[]): string =>
  court(createHash("sha256").update(JSON.stringify(criteria)), 12);

export type DocumentEnvoye = { docId: string; images: Buffer[]; promptText?: string };

/**
 * L'empreinte de ce qu'un modèle reçoit pour un document : le prompt envoyé avec
 * lui, puis chacune de ses pages, octet pour octet et dans l'ordre.
 *
 * Les pages des factures ne sont pas versionnées — 206 Mo — et se régénèrent
 * depuis l'archive publique. Cette empreinte est ce qui prouve qu'elles sont
 * revenues à l'identique : une page rendue à une autre résolution serait un autre
 * test, et rien d'autre ne le signalerait.
 */
export function empreinteDocument(doc: DocumentEnvoye, promptCommun: string): string {
  const hash = createHash("sha256").update(doc.promptText ?? promptCommun);
  for (const image of doc.images) hash.update("\0").update(image);
  return court(hash, 16);
}

const estUnJour = (texte: string): boolean => /^\d{4}-\d{2}-\d{2}/.test(texte);

/**
 * Les instants connus des appels d'un modèle : la date portée par chaque réponse,
 * à défaut le calendrier relevé pour le run, à défaut le jour que nomme le run.
 */
function instants(results: ModelResult[], calendriers: Map<string, RunCalendar>): string[] {
  const out: string[] = [];
  const sansDate = new Set<string>();
  for (const r of results) {
    if (r.calledAt !== undefined) out.push(r.calledAt);
    else sansDate.add(r.runId);
  }
  for (const runId of sansDate) {
    const releve = calendriers.get(runId)?.models[results[0]!.model];
    if (releve !== undefined) out.push(releve.first, releve.last);
    else if (estUnJour(runId)) out.push(runId.slice(0, 10));
  }
  return out.sort();
}

export type ConstruireProtocoleOptions = {
  leaderboard: Leaderboard;
  criteria: Criterion[];
  /** Le gabarit de prompt de la tâche. */
  promptText: string;
  /** Les documents de la tâche, tels que le run les envoie. */
  documents: DocumentEnvoye[];
  /** Les réponses des runs publiés. */
  results: ModelResult[];
  /** Les documents notés pour tout le panel : ceux du classement. */
  docIds: Set<string>;
  calendriers?: Map<string, RunCalendar>;
  /** La version datée de chaque alias, lue dans le catalogue, et son jour de relevé. */
  canoniques?: Map<string, string>;
  canoniquesAu?: string;
};

/**
 * Écrit le test publié : ses documents, son prompt, son barème, ses paramètres, et
 * ce que l'on sait de chaque modèle qui l'a passé.
 *
 * Un document du classement dont les pages manquent arrête tout : publier un test
 * qu'on ne saurait pas renvoyer tel quel à un nouveau modèle serait le publier à moitié.
 */
export function construireProtocole(opts: ConstruireProtocoleOptions): TestProtocol {
  const parId = new Map(opts.documents.map((d) => [d.docId, d]));
  const absents = [...opts.docIds].filter((id) => !parId.has(id));
  if (absents.length > 0) {
    throw new Error(
      `Test impossible à figer : ${absents.length} document(s) du classement sans pages sur le disque ` +
      `(${absents.slice(0, 3).join(", ")}…). Régénérer les documents de la tâche avant de publier.`);
  }

  const retenus = opts.results.filter((r) => opts.docIds.has(r.docId));
  const calendriers = opts.calendriers ?? new Map<string, RunCalendar>();

  return TestProtocolSchema.parse({
    taskId: opts.leaderboard.taskId,
    runId: opts.leaderboard.runId,
    runDate: opts.leaderboard.runDate,
    promptHash: empreintePrompt(opts.promptText),
    criteriaHash: empreinteBareme(opts.criteria),
    parameters: PARAMETRES_APPEL,
    documents: [...opts.docIds].sort().map((docId) => {
      const doc = parId.get(docId)!;
      return { docId, pages: doc.images.length, fingerprint: empreinteDocument(doc, opts.promptText) };
    }),
    models: opts.leaderboard.rows.map((row) => {
      const siens = retenus.filter((r) => r.model === row.model);
      const dates = instants(siens, calendriers);
      const canonique = opts.canoniques?.get(row.model) ?? null;
      return {
        alias: row.model,
        version: row.modelVersion,
        canonical: canonique,
        canonicalAsOf: canonique === null ? null : opts.canoniquesAu ?? null,
        firstCall: dates[0] ?? opts.leaderboard.runDate,
        lastCall: dates.at(-1) ?? opts.leaderboard.runDate,
        providers: [...new Set(siens.flatMap((r) => (r.provider === undefined ? [] : [r.provider])))].sort(),
      };
    }),
  });
}

/**
 * Les documents à envoyer pour rejouer un test publié, dans l'ordre du protocole.
 *
 * Lance une erreur, sans rien dépenser, dès que le test d'aujourd'hui n'est plus
 * celui qui a été publié : prompt réécrit, barème changé, document absent ou page
 * rendue autrement. Tester un nouveau modèle sur un test voisin donnerait un score
 * qui se range dans le même tableau sans y avoir sa place.
 */
export function documentsDuTest<T extends DocumentEnvoye>(
  protocole: TestProtocol, documents: T[], promptText: string, criteria: Criterion[],
): T[] {
  const ecarts: string[] = [];
  if (empreintePrompt(promptText) !== protocole.promptHash) {
    ecarts.push(`le prompt a changé (${empreintePrompt(promptText)} au lieu de ${protocole.promptHash})`);
  }
  if (empreinteBareme(criteria) !== protocole.criteriaHash) {
    ecarts.push(`le barème a changé (${empreinteBareme(criteria)} au lieu de ${protocole.criteriaHash})`);
  }
  const parId = new Map(documents.map((d) => [d.docId, d]));
  const retenus: T[] = [];
  for (const attendu of protocole.documents) {
    const doc = parId.get(attendu.docId);
    if (doc === undefined) { ecarts.push(`${attendu.docId} : document absent`); continue; }
    if (empreinteDocument(doc, promptText) !== attendu.fingerprint) {
      ecarts.push(`${attendu.docId} : ce qui serait envoyé n'est plus ce qui a été publié`);
      continue;
    }
    retenus.push(doc);
  }
  if (ecarts.length > 0) {
    throw new Error(
      `Le test publié de « ${protocole.taskId} » ne peut pas être rejoué à l'identique :\n  · ` +
      `${ecarts.slice(0, 8).join("\n  · ")}${ecarts.length > 8 ? `\n  · … et ${ecarts.length - 8} autre(s)` : ""}`);
  }
  return retenus;
}
