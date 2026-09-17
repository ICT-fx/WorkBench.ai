import { z } from "zod";
import { CriterionSchema } from "./criterion";

export const TaskSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** La question métier, en une phrase, telle qu'elle s'affiche sur le site. */
  question: z.string().min(1),
  criteria: z.array(CriterionSchema).min(1),
}).refine(
  (t) => new Set(t.criteria.map((c) => c.id)).size === t.criteria.length,
  { message: "Deux critères portent le même id", path: ["criteria"] },
);
export type Task = z.infer<typeof TaskSchema>;
