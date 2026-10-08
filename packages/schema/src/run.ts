import { z } from "zod";

/**
 * Une réponse brute de modèle. Écrit par `eval run`, jamais modifié ensuite :
 * ce fichier ne contient aucune note, ce qui permet de rejouer le scoring
 * sans repayer d'appels.
 */
export const ModelResultSchema = z.object({
  runId: z.string().min(1),
  model: z.string().min(1),
  /** Version réelle renvoyée par l'API, pas l'alias demandé. */
  modelVersion: z.string().min(1),
  docId: z.string().min(1),
  raw: z.unknown(),
  latencyMs: z.number().min(0),
  costUsd: z.number().min(0),
  /** L'hébergeur qui a réellement servi le modèle : deux hébergeurs du même
   *  modèle peuvent le servir plus ou moins compressé, donc plus ou moins bien.
   *  Sans cette information, un classement n'est pas reproductible. */
  provider: z.string().optional(),
  inputTokens: z.number().min(0).optional(),
  outputTokens: z.number().min(0).optional(),
  /**
   * L'instant de l'appel, en ISO 8601. Un alias de modèle peut changer de
   * comportement sans changer de nom : sans la date de chaque appel, on ne saurait
   * plus dire quelle version a répondu. Absent des runs antérieurs au 8 octobre 2026,
   * dont les dates sont relevées dans `calendrier.json`.
   */
  calledAt: z.string().optional(),
  error: z.string().optional(),
});
export type ModelResult = z.infer<typeof ModelResultSchema>;

export const RunMetaSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  startedAt: z.string(),
  models: z.array(z.object({
    alias: z.string(),
    /** La version que le fournisseur a déclarée dans sa réponse. */
    version: z.string(),
    /**
     * La version datée vers laquelle l'alias pointait au lancement, lue dans le
     * catalogue d'OpenRouter : `anthropic/claude-opus-5.5-20260921` pour
     * `anthropic/claude-opus-5.5`. C'est elle qui dit quel modèle a été testé.
     */
    canonical: z.string().optional(),
  })),
  promptHash: z.string(),
  docCount: z.number().int().min(1),
});
export type RunMeta = z.infer<typeof RunMetaSchema>;

/**
 * Les dates d'appel d'un run antérieur à `calledAt`, relevées une fois pour toutes
 * sur la date d'écriture de chaque réponse. Ce fichier ne remplace pas une donnée
 * mesurée : il la consigne avant qu'un clonage du dépôt ne l'efface.
 */
export const RunCalendarSchema = z.object({
  runId: z.string().min(1),
  source: z.string().min(1),
  recordedAt: z.string().min(1),
  models: z.record(z.string(), z.object({
    first: z.string(), last: z.string(), calls: z.number().int().min(1),
  })),
});
export type RunCalendar = z.infer<typeof RunCalendarSchema>;

const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date ISO attendue");

/**
 * Le test publié d'un benchmark, figé : de quoi le rejouer à l'identique sur un
 * modèle qui n'existait pas encore.
 *
 * Écrit par `eval publish`, à côté du classement. Il nomme chaque document du test
 * avec l'empreinte de ce que le modèle reçoit, le prompt, le barème, les paramètres
 * d'appel, et pour chaque modèle la version testée et les dates de ses appels.
 */
export const TestProtocolSchema = z.object({
  taskId: z.string().min(1),
  /** Les runs dont sort le classement publié. */
  runId: z.string().min(1),
  runDate: jour,
  /** Empreinte du gabarit de prompt, la même que dans le `run.json` de chaque run. */
  promptHash: z.string().min(1),
  /** Empreinte des critères du barème. */
  criteriaHash: z.string().min(1),
  /** Les paramètres d'appel en vigueur à la publication. */
  parameters: z.object({
    maxTokens: z.number().int().positive(),
    maxTokensByModel: z.record(z.string(), z.number().int().positive()),
    allowProviderFallbacks: z.boolean(),
  }),
  /**
   * Les documents du test. L'empreinte couvre le prompt envoyé avec le document et
   * chacune de ses pages, octet pour octet : deux empreintes égales, c'est le même
   * envoi.
   */
  documents: z.array(z.object({
    docId: z.string().min(1),
    pages: z.number().int().min(0),
    fingerprint: z.string().min(1),
  })).min(1),
  models: z.array(z.object({
    alias: z.string().min(1),
    /** Ce que le fournisseur a déclaré en répondant. */
    version: z.string().min(1),
    /** La version datée du catalogue, et le jour où elle a été relevée. */
    canonical: z.string().nullable(),
    canonicalAsOf: jour.nullable(),
    firstCall: jour,
    lastCall: jour,
    /** Les hébergeurs qui ont réellement servi ce modèle pendant le test. */
    providers: z.array(z.string()),
  })).min(1),
});
export type TestProtocol = z.infer<typeof TestProtocolSchema>;
