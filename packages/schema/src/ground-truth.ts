import { z } from "zod";
import { ValueSchema } from "./value.js";

/**
 * Ce qu'il fallait extraire d'un document.
 *
 * `null` est significatif : le champ est absent du document. Un modèle qui
 * produit une valeur là où la vérité terrain dit `null` hallucine. Un champ
 * simplement omis de `fields` est une erreur de jeu de test, pas une absence.
 */
export const GroundTruthSchema = z.object({
  docId: z.string().min(1),
  fields: z.record(z.string(), ValueSchema.nullable()),
  notes: z.string().optional(),
});
export type GroundTruth = z.infer<typeof GroundTruthSchema>;
