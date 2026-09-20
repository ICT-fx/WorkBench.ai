import type { Modality } from "@hub/schema";
import type { Selection } from "@/lib/comparison";

/**
 * Ce que la page serveur passe au comparateur : le strict nécessaire, déjà
 * traduit, sérialisable. Le client ne lit jamais `data/`.
 */
export type LaboCompare = { name: string; slot?: number; monogram: string; country: string };

export type ScoreBenchmark = {
  exactitude: number;
  ci: number | null;
  costPerDoc: number;
  latencyP50: number;
  hallucinations: number;
};

export type ModeleCompare = {
  slug: string;
  id: string;
  name: string;
  lab: LaboCompare;
  released: string;
  weights: "ouverts" | "fermes" | null;
  contextWindow: number | null;
  maxOutput: number | null;
  priceIn: number | null;
  priceOut: number | null;
  modalities: Modality[];
  reasoning: boolean;
  indice: number | null;
  ci: number | null;
  rank: number | null;
  cost: number | null;
  latency: number | null;
  hallucinations: number | null;
  byDomain: Record<string, number | null>;
  /** Marge d'erreur du score par métier, quand tous ses benchmarks en publient une. */
  ciByDomain: Record<string, number | null>;
  byBenchmark: Record<string, ScoreBenchmark>;
};

export type MetierCompare = { id: string; label: string; summary: string; icon: string };

export type BenchmarkCompare = { id: string; domain: string; label: string; question: string };

export type DonneesComparaison = {
  models: ModeleCompare[];
  domains: MetierCompare[];
  benchmarks: BenchmarkCompare[];
  defaults: Selection;
  /** Nombre de modèles classés à l'indice : le « sur 48 » d'un rang. */
  ranked: number;
  demo: boolean;
};

/**
 * Sur cette page seulement, la teinte suit l'ordre de sélection et non le labo :
 * on y compare des modèles, parfois du même labo, qu'il faut pouvoir distinguer.
 */
export const couleurSerie = (index: number): string => `var(--color-serie-${index + 1})`;
