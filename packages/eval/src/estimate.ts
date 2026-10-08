import { computeCost, type Catalogue } from "./models";

/**
 * Hypothèses de volume. Elles sont volontairement prudentes et affichées avec
 * l'estimation : un chiffre de coût sans ses hypothèses ne permet pas de décider.
 */
export type Hypotheses = {
  /** Tokens facturés pour une page de facture en image (~1240 × 900 px). */
  imageTokens: number;
  /** Tokens d'une réponse JSON à dix champs, lignes comprises. */
  outputTokens: number;
  /** Rapport caractères/token pour un texte français. */
  charsPerToken: number;
};

export const HYPOTHESES_PAR_DEFAUT: Hypotheses = {
  imageTokens: 1600,
  outputTokens: 500,
  charsPerToken: 3.5,
};

/**
 * Un modèle qui raisonne avant de répondre facture ses tokens de réflexion comme
 * des tokens de sortie. Le plafond suppose une sortie quatre fois plus longue.
 */
const FACTEUR_RAISONNEMENT = 4;

export type EstimationModele = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  ceilingUsd: number;
};

export type Estimation = {
  calls: number;
  totalUsd: number;
  ceilingUsd: number;
  perModel: EstimationModele[];
  hypotheses: Hypotheses;
};

/** Estime le coût d'un run sans passer le moindre appel. */
export function estimateRunCost(
  catalogue: Catalogue,
  models: readonly string[],
  /** `promptChars` : la longueur du prompt propre au document, quand il en a un. */
  documents: { images: number; promptChars?: number }[],
  promptText: string,
  hypotheses: Hypotheses = HYPOTHESES_PAR_DEFAUT,
): Estimation {
  const promptTokens = Math.ceil(promptText.length / hypotheses.charsPerToken);

  const perModel = models.map((model) => {
    const entry = catalogue.get(model);
    const inputTokens = documents.reduce(
      (acc, d) => acc
        + (d.promptChars === undefined ? promptTokens : Math.ceil(d.promptChars / hypotheses.charsPerToken))
        + d.images * hypotheses.imageTokens, 0);
    const outputTokens = documents.length * hypotheses.outputTokens;
    return {
      model,
      calls: documents.length,
      inputTokens,
      outputTokens,
      usd: computeCost(entry, inputTokens, outputTokens),
      ceilingUsd: computeCost(entry, inputTokens, outputTokens * FACTEUR_RAISONNEMENT),
    };
  }).sort((a, b) => b.usd - a.usd);

  return {
    calls: perModel.reduce((a, m) => a + m.calls, 0),
    totalUsd: perModel.reduce((a, m) => a + m.usd, 0),
    ceilingUsd: perModel.reduce((a, m) => a + m.ceilingUsd, 0),
    perModel,
    hypotheses,
  };
}
