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

export type LecturesDocument = {
  docId: string;
  /** Nombre de modèles notés sur ce document. */
  models: number;
  /** Modèles ayant lu correctement le champ décisif. */
  corrects: number;
  /** Modèles ayant inventé une valeur là où le document n'en porte aucune. */
  hallucinations: number;
};

/**
 * Ce que le panel a produit sur chaque document, du plus disputé au plus consensuel.
 *
 * Le classement agrège 2 700 lectures en 27 lignes ; cette vue les rend au
 * document, pour qu'un lecteur voie où la difficulté s'est trouvée plutôt que
 * de devoir nous croire sur le mot « difficile ». Le champ décisif est celui
 * dont dépend le classement ; les hallucinations sont comptées sur tous les
 * champs, parce qu'inventer une valeur absente est une faute en soi.
 *
 * Module pur, sans accès disque : les comptes viennent des notations du run,
 * jamais d'un recalcul.
 */
export function lecturesParDocument(scores: DocScore[], criterionId: string): LecturesDocument[] {
  const parDoc = new Map<string, LecturesDocument>();

  for (const score of scores) {
    const doc = parDoc.get(score.docId)
      ?? { docId: score.docId, models: 0, corrects: 0, hallucinations: 0 };
    doc.models++;
    if (score.byCriterion[criterionId]?.verdict === "correct") doc.corrects++;
    if (Object.values(score.byCriterion).some((f) => f.verdict === "hallucine")) doc.hallucinations++;
    parDoc.set(score.docId, doc);
  }

  // À égalité de fautes, l'identifiant tranche : l'ordre du tableau doit être
  // le même d'un build à l'autre.
  return [...parDoc.values()].sort(
    (a, b) => (b.models - b.corrects) - (a.models - a.corrects) || a.docId.localeCompare(b.docId),
  );
}
