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
  error: z.string().optional(),
});
export type ModelResult = z.infer<typeof ModelResultSchema>;

export const RunMetaSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  startedAt: z.string(),
  models: z.array(z.object({ alias: z.string(), version: z.string() })),
  promptHash: z.string(),
  docCount: z.number().int().min(1),
});
export type RunMeta = z.infer<typeof RunMetaSchema>;
