import type { LeaderboardRow } from "@hub/schema";

/**
 * Au-delà de ce taux de champs inventés, un modèle n'est recommandable pour
 * rien. Choix éditorial assumé : en comptabilité, un chiffre inventé coûte plus
 * cher qu'un chiffre manquant, parce qu'il passe la relecture.
 */
export const SEUIL_HALLUCINATION = 1;

/** Au-delà de ce taux d'appels en échec, le modèle n'est pas industrialisable. */
const SEUIL_ECHEC = 0.05;

/**
 * Pour être « le meilleur rapport coût/précision », un modèle doit d'abord être
 * précis : au moins 90 % de l'exactitude du meilleur. Sans ce plancher, le
 * rapport brut couronnerait toujours le modèle le moins cher, fût-il inutile —
 * un modèle qui rate six factures sur dix n'est pas une bonne affaire.
 */
const PLANCHER_RAPPORT = 0.9;

export type Recommandations = {
  precision: LeaderboardRow;
  rapport: LeaderboardRow;
  risque: LeaderboardRow;
};

const recommandable = (r: LeaderboardRow): boolean => {
  const tentes = r.docCount + r.errorCount;
  return r.hallucinations <= SEUIL_HALLUCINATION &&
    (tentes === 0 || r.errorCount / tentes <= SEUIL_ECHEC);
};

const best = <T>(xs: T[], score: (x: T) => number): T =>
  xs.reduce((a, b) => (score(b) > score(a) ? b : a));

/**
 * Trois recommandations plutôt qu'un vainqueur : le meilleur modèle d'un
 * classement n'est pas forcément le bon pour un cas donné, et c'est justement
 * ce que ce hub cherche à montrer.
 *
 * Renvoie `null` quand aucun modèle n'est recommandable — ne rien conseiller
 * est une réponse honnête, pas une page vide.
 */
export function recommandations(rows: LeaderboardRow[]): Recommandations | null {
  const eligibles = rows.filter(recommandable);
  if (eligibles.length === 0) return null;

  const meilleureExactitude = Math.max(...eligibles.map((r) => r.exactitude));

  return {
    precision: best(eligibles, (r) => r.exactitude),
    // Points d'exactitude par euro, parmi les modèles assez précis pour compter.
    rapport: best(
      eligibles.filter((r) => r.exactitude >= meilleureExactitude * PLANCHER_RAPPORT),
      (r) => (r.costPerDoc === 0 ? r.exactitude : r.exactitude / r.costPerDoc),
    ),
    risque: best(eligibles, (r) => -r.hallucinations * 1000 + r.sansRelecture),
  };
}
