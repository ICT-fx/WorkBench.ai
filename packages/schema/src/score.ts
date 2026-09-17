import { z } from "zod";
import { ValueSchema } from "./value.js";

/** Exactement quatre verdicts. Ne jamais en introduire un cinquième. */
export const FIELD_VERDICTS = ["correct", "faux", "manquant", "hallucine"] as const;
export const FieldVerdictSchema = z.enum(FIELD_VERDICTS);
export type FieldVerdict = z.infer<typeof FieldVerdictSchema>;

export const FieldScoreSchema = z.object({
  got: ValueSchema.nullable(),
  expected: ValueSchema.nullable(),
  verdict: FieldVerdictSchema,
  points: z.number().min(0),
  maxPoints: z.number().min(0),
});
export type FieldScore = z.infer<typeof FieldScoreSchema>;

export const DocScoreSchema = z.object({
  model: z.string().min(1),
  docId: z.string().min(1),
  byCriterion: z.record(z.string(), FieldScoreSchema),
  /** Vrai dès qu'un seul champ critique est faux, manquant ou halluciné. */
  needsReview: z.boolean(),
});
export type DocScore = z.infer<typeof DocScoreSchema>;

export const ReviewItemSchema = z.object({
  model: z.string(),
  docId: z.string(),
  criterionId: z.string(),
  autoVerdict: FieldVerdictSchema,
  humanVerdict: FieldVerdictSchema,
  reason: z.string().optional(),
  decidedAt: z.string(),
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
