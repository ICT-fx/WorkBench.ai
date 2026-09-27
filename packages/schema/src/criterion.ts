import { z } from "zod";

export const CRITERION_KINDS = ["exact", "number", "date", "lines", "text"] as const;
export const CriterionKindSchema = z.enum(CRITERION_KINDS);
export type CriterionKind = z.infer<typeof CriterionKindSchema>;

export const CriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: CriterionKindSchema,
  /** Criticité métier, pas difficulté technique. */
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Un champ critique faux fait basculer le document en « à relire ». */
  critical: z.boolean(),
  /** Écart toléré pour les critères numériques. 0 = au centime près. */
  tolerance: z.number().min(0).optional(),
  /**
   * Convention de lecture des dates chiffrées, pour les critères de kind "date".
   * "DMY" (défaut) : 02/03 = 2 mars, usage français.
   * "MDY" : 02/03 = 3 février, usage américain.
   * La convention suit le pays du document, pas celui du lecteur.
   */
  dateOrder: z.enum(["DMY", "MDY"]).optional(),
  /** Mots-clés attendus, pour les critères de kind "text". */
  expectedKeywords: z.array(z.string()).optional(),
});
export type Criterion = z.infer<typeof CriterionSchema>;
