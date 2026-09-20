import type { BenchmarkHistory, DocScore, Leaderboard, ModelResult, ReviewItem, Task } from "@hub/schema";
import { BenchmarkHistorySchema, LeaderboardSchema } from "@hub/schema";
import { aggregate } from "./aggregate";

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
  runId: string;
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
    runId: opts.runId,
    status: opts.status,
    runDate: opts.runDate,
    sampleSize: opts.sampleSize,
    rows,
  });
}

/**
 * Ajoute une publication à l'historique d'un benchmark.
 *
 * L'historique est ce qui permet de suivre un modèle dans le temps : un même
 * alias peut changer de comportement sans prévenir, et seul un re-test le montre.
 * Republier un run remplace son entrée au lieu de la dupliquer. Une première
 * mesure réelle efface les runs de démonstration : une courbe qui mêlerait les
 * deux ferait passer du fabriqué pour du mesuré.
 */
export function appendHistory(history: BenchmarkHistory | null, leaderboard: Leaderboard): BenchmarkHistory {
  const gardes = (history?.runs ?? []).filter((run) =>
    run.runId !== leaderboard.runId && (leaderboard.status === "demo" || run.status === "reel"));

  return BenchmarkHistorySchema.parse({
    benchmarkId: leaderboard.taskId,
    runs: [
      ...gardes,
      {
        runId: leaderboard.runId,
        runDate: leaderboard.runDate,
        status: leaderboard.status,
        rows: leaderboard.rows.map((r) => ({
          model: r.model, exactitude: r.exactitude, costPerDoc: r.costPerDoc, latencyP50: r.latencyP50,
        })),
      },
    ].sort((a, b) => a.runDate.localeCompare(b.runDate)),
  });
}
