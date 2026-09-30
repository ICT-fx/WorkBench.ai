import type { DocScore, LeaderboardRow, ModelResult } from "@hub/schema";

const pct = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

/** Médiane et non moyenne : un seul appel lent donnerait une image trompeuse. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    map.set(k, [...(map.get(k) ?? []), x]);
  }
  return map;
}

/**
 * Agrège les scores par modèle en une ligne de classement.
 *
 * Les appels en échec n'entrent dans aucune moyenne — ils sont comptés à part.
 * Les écarter silencieusement flatterait un modèle instable, qui n'aurait été
 * noté que sur les documents qu'il a réussi à traiter.
 */
export function aggregate(scores: DocScore[], results: ModelResult[]): LeaderboardRow[] {
  const scoresByModel = groupBy(scores, (s) => s.model);
  const resultsByModel = groupBy(results, (r) => r.model);

  const rows: LeaderboardRow[] = [];

  for (const [model, modelScores] of scoresByModel) {
    const modelResults = resultsByModel.get(model) ?? [];
    const ok = modelResults.filter((r) => r.error === undefined);
    const failed = modelResults.filter((r) => r.error !== undefined);

    let points = 0;
    let maxPoints = 0;
    let hallucinated = 0;
    let absentFields = 0;
    let fields = 0;

    for (const score of modelScores) {
      for (const field of Object.values(score.byCriterion)) {
        fields++;
        points += field.points;
        maxPoints += field.maxPoints;
        if (field.expected === null) {
          absentFields++;
          if (field.verdict === "hallucine") hallucinated++;
        }
      }
    }

    // Les documents en échec ne pénalisent pas le modèle : dans ce projet, les
    // échecs observés venaient du quota du compte, du crédit réservé par les
    // appels simultanés ou d'un hébergeur en panne — de notre côté, donc, pas
    // du modèle. Ils restent visibles dans `errorCount`, à interpréter avec le
    // contexte du run.
    const attempted = modelScores.length;

    // Marge d'erreur à 95 % sur l'exactitude, en points : l'approximation normale
    // d'une proportion, sur le nombre de champs notés. Vingt-cinq documents ne
    // départagent pas deux modèles à un point d'écart, et le classement doit le dire.
    const p = maxPoints === 0 ? 0 : points / maxPoints;
    const ci = fields === 0 ? undefined : Math.round(1.96 * Math.sqrt((p * (1 - p)) / fields) * 1000) / 10;

    rows.push({
      model,
      modelVersion: ok[0]?.modelVersion ?? modelResults[0]?.modelVersion ?? model,
      sansRelecture: pct(modelScores.filter((s) => !s.needsReview).length, attempted),
      exactitude: pct(points, maxPoints),
      hallucinations: pct(hallucinated, absentFields),
      costPerDoc: ok.length === 0 ? 0 : Math.round((ok.reduce((a, r) => a + r.costUsd, 0) / ok.length) * 1e6) / 1e6,
      latencyP50: median(ok.map((r) => r.latencyMs)),
      errorCount: failed.length,
      docCount: modelScores.length,
      ...(ci === undefined ? {} : { ci }),
    });
  }

  // À exactitude égale — et vingt modèles peuvent être parfaits sur une tâche
  // facile — c'est le prix qui départage, puis la rapidité. Un classement doit
  // rendre un ordre unique, et ces deux critères sont mesurés, pas arbitraires.
  return rows.sort((a, b) =>
    b.exactitude - a.exactitude ||
    a.costPerDoc - b.costPerDoc ||
    a.latencyP50 - b.latencyP50);
}
