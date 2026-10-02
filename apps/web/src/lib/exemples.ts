import type { DocScore } from "@hub/schema";

/**
 * Les documents sur lesquels les modèles ne sont pas d'accord.
 *
 * Un benchmark bâti sur des documents réels n'a pas de pièges posés à dessein :
 * la difficulté est là où elle est, et c'est la dispersion des réponses qui la
 * révèle. Montrer ces documents-là, avec la réponse de chaque modèle à côté de
 * l'annotation d'origine, est la seule façon de rendre la notation vérifiable
 * par un lecteur : il voit la page, il voit ce qui était attendu, il voit ce que
 * le modèle a répondu, et il juge sans nous croire sur parole.
 *
 * Module pur, sans accès disque, pour que la sélection affichée par le site et
 * celle des images copiées dans `public/` ne puissent pas diverger.
 */

export type DocumentClivant = {
  docId: string;
  /** Le champ qui a produit le plus de désaccords sur ce document. */
  criterionId: string;
  /** Nombre de modèles qui se sont trompés sur ce champ. */
  errors: number;
  /** Nombre de modèles notés sur ce document. */
  models: number;
};

/**
 * Les `limit` documents les plus clivants, du plus au moins disputé.
 *
 * Un document que tout le monde réussit n'apprend rien ; il n'est pas retenu.
 */
export function documentsClivants(scores: DocScore[], limit = 3): DocumentClivant[] {
  const parDoc = new Map<string, { models: number; champs: Map<string, number> }>();

  for (const score of scores) {
    const doc = parDoc.get(score.docId) ?? { models: 0, champs: new Map<string, number>() };
    doc.models++;
    for (const [id, field] of Object.entries(score.byCriterion)) {
      if (field.verdict === "correct") continue;
      doc.champs.set(id, (doc.champs.get(id) ?? 0) + 1);
    }
    parDoc.set(score.docId, doc);
  }

  return [...parDoc]
    .flatMap(([docId, doc]) => {
      const pire = [...doc.champs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return pire === undefined
        ? []
        : [{ docId, criterionId: pire[0], errors: pire[1], models: doc.models }];
    })
    // À égalité de désaccords, l'identifiant tranche : la sélection doit être
    // la même d'un build à l'autre, sinon les images copiées ne correspondent plus.
    .sort((a, b) => b.errors - a.errors || a.docId.localeCompare(b.docId))
    .slice(0, limit);
}
