import { z } from "zod";

const percent = z.number().min(0).max(100);

export const LeaderboardRowSchema = z.object({
  model: z.string().min(1),
  modelVersion: z.string().min(1),
  /** % de documents sans aucun champ critique faux. */
  sansRelecture: percent,
  /** Points pondérés obtenus / points possibles. */
  exactitude: percent,
  /** Champs inventés / champs réellement absents du document. */
  hallucinations: percent,
  costPerDoc: z.number().min(0),
  latencyP50: z.number().min(0),
  /** Appels en échec : sans ce chiffre, un modèle qui échoue la moitié du
   *  temps afficherait un score flatteur calculé sur les factures faciles. */
  errorCount: z.number().int().min(0),
  docCount: z.number().int().min(0),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

export const LeaderboardSchema = z.object({
  taskId: z.string().min(1),
  runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
  sampleSize: z.number().int().min(1),
  rows: z.array(LeaderboardRowSchema),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
