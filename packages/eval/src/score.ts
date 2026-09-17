import type { DocScore, FieldScore, GroundTruth, Task, Value } from "@hub/schema";
import { compareField, normalizeGot } from "./compare";

/** Un champ vaut son poids, ou zéro. Pas de demi-point : une facture est juste ou fausse. */
function scoreField(
  criterion: Task["criteria"][number],
  expected: Value | null,
  got: unknown,
): FieldScore {
  const verdict = compareField(criterion, expected, got);
  return {
    got: normalizeGot(got),
    expected,
    verdict,
    points: verdict === "correct" ? criterion.weight : 0,
    maxPoints: criterion.weight,
  };
}

/**
 * Note la réponse d'un modèle sur un document.
 *
 * Le barème fait foi : une clé inventée par le modèle hors barème est ignorée,
 * un critère du barème absent de la réponse est noté « manquant ». Sans cette
 * règle, un modèle bavard paraîtrait meilleur qu'un modèle précis.
 */
export function scoreDocument(
  task: Task,
  groundTruth: GroundTruth,
  parsed: Record<string, unknown>,
  model: string,
): DocScore {
  const byCriterion: Record<string, FieldScore> = {};
  let needsReview = false;

  for (const criterion of task.criteria) {
    const expected = groundTruth.fields[criterion.id] ?? null;
    const field = scoreField(criterion, expected, parsed[criterion.id]);
    byCriterion[criterion.id] = field;
    if (criterion.critical && field.verdict !== "correct") needsReview = true;
  }

  return { model, docId: groundTruth.docId, byCriterion, needsReview };
}
