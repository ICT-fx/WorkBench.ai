import { z } from "zod";
import { ValueSchema } from "./value";

/**
 * Ce qu'il fallait extraire d'un document.
 *
 * `null` est significatif : le champ est absent du document. Un modèle qui
 * produit une valeur là où la vérité terrain dit `null` hallucine. Un champ
 * omis de `fields` n'est pas posé à ce document, et n'est donc pas noté : c'est
 * ce qui permet à une tâche de ne poser qu'une question par document. Les deux
 * ne se confondent jamais — un champ absent du document s'écrit `null`.
 */
export const GroundTruthSchema = z.object({
  docId: z.string().min(1),
  fields: z.record(z.string(), ValueSchema.nullable()),
  notes: z.string().optional(),
});
export type GroundTruth = z.infer<typeof GroundTruthSchema>;
