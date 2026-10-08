import type { DocScore, FieldScore, GroundTruth, ModelResult, Task, Value } from "@hub/schema";
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
    // Un critère écarté ne compte pas : sa réponse reste dans le fichier brut.
    if (criterion.exclu !== undefined) continue;
    // Un critère que la vérité terrain ne déclare pas n'est pas posé à ce
    // document. Le lire comme `null` en ferait un champ « absent », et un
    // modèle qui n'a rien répondu serait compté juste sans avoir rien fait.
    if (!(criterion.id in groundTruth.fields)) continue;
    const expected = groundTruth.fields[criterion.id] ?? null;
    const field = scoreField(criterion, expected, parsed[criterion.key ?? criterion.id]);
    byCriterion[criterion.id] = field;
    if (criterion.critical && field.verdict !== "correct") needsReview = true;
  }

  return { model, docId: groundTruth.docId, byCriterion, needsReview };
}

/**
 * Note un échec que l'on impute au modèle : il n'a rien rendu d'exploitable.
 *
 * Un modèle qui réfléchit sans jamais écrire de réponse, ou qui se contredit, a fait
 * son propre travail : retirer la question à tout le panel à cause de lui la
 * rendrait plus facile pour les autres, et c'est justement les questions difficiles
 * qui font échouer ces modèles. Elle reste donc, et il y est compté « manquant ».
 *
 * Le verdict est forcé, et non calculé sur une réponse vide : sur une question dont
 * la bonne réponse est « il n'y en a pas », une réponse vide serait juste, et un échec
 * rapporterait un point.
 */
export function scoreEchecImpute(task: Task, groundTruth: GroundTruth, model: string): DocScore {
  const byCriterion: Record<string, FieldScore> = {};
  let needsReview = false;
  for (const criterion of task.criteria) {
    if (criterion.exclu !== undefined || !(criterion.id in groundTruth.fields)) continue;
    byCriterion[criterion.id] = {
      got: null, expected: groundTruth.fields[criterion.id] ?? null,
      verdict: "manquant", points: 0, maxPoints: criterion.weight,
    };
    if (criterion.critical) needsReview = true;
  }
  return { model, docId: groundTruth.docId, byCriterion, needsReview };
}

/**
 * Note les réponses d'un run.
 *
 * Un échec d'appel ne compte pas contre le modèle : il vient presque toujours de notre
 * côté (quota, hébergeur en panne, extracteur). Une seule exception, explicite et
 * motivée : les échecs listés dans `imputes`, clés `modèle/document`, que l'on a lus et
 * reconnus comme propres au modèle. Ces clés ne valent que pour un appel réellement en
 * échec : une réponse reçue n'est jamais réécrite.
 *
 * Un document hors périmètre est laissé de côté ; un document interrogé puis retiré du
 * jeu, sans plus de vérité terrain, est signalé plutôt que de faire échouer la notation.
 */
export function scoreResults(opts: {
  task: Task;
  groundTruths: ReadonlyMap<string, GroundTruth>;
  results: ModelResult[];
  retenus: ReadonlySet<string>;
  imputes: ReadonlyMap<string, string>;
}): { scores: DocScore[]; sansReference: Set<string> } {
  const scores: DocScore[] = [];
  const sansReference = new Set<string>();
  for (const result of opts.results) {
    if (!opts.retenus.has(result.docId)) continue;
    const gt = opts.groundTruths.get(result.docId);
    if (gt === undefined) { sansReference.add(result.docId); continue; }
    if (result.error !== undefined) {
      if (opts.imputes.has(`${result.model}/${result.docId}`)) scores.push(scoreEchecImpute(opts.task, gt, result.model));
      continue;
    }
    scores.push(scoreDocument(opts.task, gt, (result.raw ?? {}) as Record<string, unknown>, result.model));
  }
  return { scores, sansReference };
}
