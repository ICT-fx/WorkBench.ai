import type { DocScore, ReviewItem } from "@hub/schema";

/**
 * Les notes d'un run, une fois les arbitrages humains appliqués.
 *
 * Le classement publié est calculé sur les verdicts arbitrés : quand un humain
 * requalifie une réponse, c'est son verdict qui compte. Le site doit lire les
 * mêmes, sans quoi un tableau annoncerait « 2 valeurs inventées » sous un
 * classement qui n'en compte plus aucune.
 *
 * Module pur, sans accès disque : la page et la copie des images partent de la
 * même fonction. Même règle que `applyReview` du pipeline — un test les compare.
 */
export function appliquerArbitrages(scores: DocScore[], review: ReviewItem[]): DocScore[] {
  if (review.length === 0) return scores;
  const cle = (model: string, docId: string, criterionId: string): string => [model, docId, criterionId].join(" :: ");
  const decisions = new Map(review.map((r) => [cle(r.model, r.docId, r.criterionId), r]));

  return scores.map((score) => {
    let touche = false;
    const byCriterion = Object.fromEntries(Object.entries(score.byCriterion).map(([id, field]) => {
      const decision = decisions.get(cle(score.model, score.docId, id));
      if (decision === undefined || decision.humanVerdict === field.verdict) return [id, field];
      touche = true;
      return [id, { ...field, verdict: decision.humanVerdict, points: decision.humanVerdict === "correct" ? field.maxPoints : 0 }];
    }));
    return touche ? { ...score, byCriterion } : score;
  });
}

export type Requalification = {
  model: string;
  docId: string;
  criterionId: string;
  /** Le verdict du comparateur, et celui que l'humain a rendu à sa place. */
  de: ReviewItem["autoVerdict"];
  vers: ReviewItem["humanVerdict"];
  motif: string;
};

/**
 * Les réponses dont un humain a changé le verdict. Une confirmation — le même
 * verdict que le comparateur — n'en est pas une : elle ne change rien à lire.
 */
export const requalifications = (review: ReviewItem[]): Requalification[] =>
  review.filter((r) => r.humanVerdict !== r.autoVerdict).map((r) => ({
    model: r.model, docId: r.docId, criterionId: r.criterionId,
    de: r.autoVerdict, vers: r.humanVerdict, motif: r.reason ?? "",
  }));
