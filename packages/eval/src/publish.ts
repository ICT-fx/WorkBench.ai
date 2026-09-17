import type { DocScore, Leaderboard, ModelResult, ReviewItem, Task } from "@hub/schema";
import { LeaderboardSchema } from "@hub/schema";
import { aggregate } from "./aggregate.js";

/**
 * Applique les arbitrages humains par-dessus le score automatique.
 *
 * L'humain tranche toujours : le scoring automatique est un outil de tri, pas
 * une autorité. Les points et le drapeau de relecture sont recalculés, sinon un
 * arbitrage laisserait le classement incohérent avec les verdicts affichés.
 */
export function applyReview(task: Task, scores: DocScore[], review: ReviewItem[]): DocScore[] {
  const critical = new Set(task.criteria.filter((c) => c.critical).map((c) => c.id));
  const known = new Set(task.criteria.map((c) => c.id));

  return scores.map((score) => {
    const applicable = review.filter(
      (r) => r.model === score.model && r.docId === score.docId && known.has(r.criterionId),
    );
    if (applicable.length === 0) return score;

    const byCriterion = { ...score.byCriterion };
    for (const item of applicable) {
      const field = byCriterion[item.criterionId];
      if (field === undefined) continue;
      byCriterion[item.criterionId] = {
        ...field,
        verdict: item.humanVerdict,
        points: item.humanVerdict === "correct" ? field.maxPoints : 0,
      };
    }

    const needsReview = Object.entries(byCriterion).some(
      ([id, f]) => critical.has(id) && f.verdict !== "correct",
    );
    return { ...score, byCriterion, needsReview };
  });
}

export type BuildLeaderboardOptions = {
  taskId: string;
  runDate: string;
  scores: DocScore[];
  results: ModelResult[];
  sampleSize: number;
  status: "reel" | "demo";
  /** Au-delà de ce taux d'appels en échec, un modèle rend le run impubliable. */
  maxErrorRate?: number;
};

/**
 * Construit le classement publiable.
 *
 * Un modèle qui a échoué sur plus d'un dixième du jeu bloque la publication :
 * mieux vaut pas de classement qu'un classement calculé sur les seules factures
 * que le modèle a bien voulu traiter.
 */
export function buildLeaderboard(opts: BuildLeaderboardOptions): Leaderboard {
  const maxErrorRate = opts.maxErrorRate ?? 0.1;
  const rows = aggregate(opts.scores, opts.results);

  for (const row of rows) {
    const attempted = row.docCount + row.errorCount;
    if (attempted > 0 && row.errorCount / attempted > maxErrorRate) {
      throw new Error(
        `Publication refusée : ${row.model} a ${row.errorCount} appel(s) en échec sur ${attempted} ` +
        `(${Math.round((row.errorCount / attempted) * 100)} %). Relancer le run avant de publier.`,
      );
    }
  }

  return LeaderboardSchema.parse({
    taskId: opts.taskId,
    status: opts.status,
    runDate: opts.runDate,
    sampleSize: opts.sampleSize,
    rows,
  });
}
