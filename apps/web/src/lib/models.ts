import type { BenchmarkHistory, Modality } from "@hub/schema";
import { modelHistory } from "./hub";

/**
 * La logique de la page « Modèles » : filtrer et trier la liste, situer un
 * modèle dans une distribution, suivre sa stabilité d'un run à l'autre.
 *
 * Module pur, sans accès disque ni dépendance au site : le composant client de
 * la liste l'importe tel quel, et les tests aussi.
 */

/** Ce que la liste sait d'un modèle : le strict nécessaire, car tout est envoyé au navigateur. */
export type ModelListItem = {
  slug: string;
  name: string;
  labId: string;
  labName: string;
  slot?: number;
  monogram: string;
  country: string;
  weights: "ouverts" | "fermes" | null;
  released: string;
  /**
   * La date déjà mise en forme par le serveur : Intl ne rend pas les mêmes
   * abréviations d'un moteur à l'autre, et un écart casserait l'hydratation.
   */
  releasedLabel: string;
  indice: number | null;
  rank: number | null;
};

export type ListFilters = {
  weights: "tous" | "ouverts" | "fermes";
  /** Identifiant du labo, ou chaîne vide pour tous. */
  lab: string;
  /** Code pays ISO, ou chaîne vide pour tous. */
  country: string;
  query: string;
};

export type ListSort = "date" | "indice";

export const NO_FILTER: ListFilters = { weights: "tous", lab: "", country: "", query: "" };

/** « Propriétaire » et « proprietaire » doivent trouver la même chose. */
const fold = (text: string): string =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterModels(items: ModelListItem[], filters: ListFilters): ModelListItem[] {
  const mots = fold(filters.query).split(/\s+/).filter((mot) => mot !== "");
  return items.filter((m) => {
    // Des poids non vérifiés (`null`) ne rangent le modèle dans aucune des deux familles.
    if (filters.weights !== "tous" && m.weights !== filters.weights) return false;
    if (filters.lab !== "" && m.labId !== filters.lab) return false;
    if (filters.country !== "" && m.country !== filters.country) return false;
    const texte = fold(`${m.name} ${m.labName}`);
    return mots.every((mot) => texte.includes(mot));
  });
}

/**
 * Les comparaisons restent sur des chaînes ASCII et des nombres : un tri qui
 * dépendrait de la langue du navigateur n'ordonnerait pas la liste comme le
 * serveur l'a rendue.
 */
export function sortModels(items: ModelListItem[], sort: ListSort): ModelListItem[] {
  const parRang = (a: ModelListItem, b: ModelListItem): number => {
    if (a.rank === b.rank) return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  };
  return [...items].sort((a, b) => {
    if (sort === "date" && a.released !== b.released) return a.released < b.released ? 1 : -1;
    return parRang(a, b);
  });
}

/** Un benchmark sur documents demande de lire des pages : images ou PDF. */
export const readsDocuments = (modalities: Modality[]): boolean =>
  modalities.includes("image") || modalities.includes("pdf");

/**
 * La place d'une valeur sur une réglette, de 0 (minimum) à 1 (maximum).
 * L'échelle logarithmique sert aux coûts, qui s'étalent sur trois ordres de
 * grandeur : en linéaire, tous les modèles sauf les plus chers se tasseraient à gauche.
 */
export function position(value: number, min: number, max: number, scale: "lineaire" | "log" = "lineaire"): number {
  if (max <= min) return 0.5;
  const log = scale === "log" && min > 0 && value > 0;
  const t = log
    ? (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min))
    : (value - min) / (max - min);
  return Math.min(1, Math.max(0, t));
}

/** Le rang d'une valeur parmi les autres ; les ex æquo partagent le même rang. */
export function standing(
  values: number[], value: number, order: "croissant" | "decroissant",
): { rank: number; of: number } {
  const devant = values.filter((v) => (order === "croissant" ? v < value : v > value)).length;
  return { rank: devant + 1, of: values.length };
}

export type BenchmarkRuns = {
  benchmarkId: string;
  /** L'exactitude du modèle à chaque publication de ce benchmark, de la plus ancienne à la plus récente. */
  points: { date: string; value: number }[];
};

/**
 * L'exactitude d'un modèle run après run, benchmark par benchmark.
 *
 * Deux benchmarks ne partagent jamais une courbe. Une moyenne par date mêlait les
 * runs de factures et celui des questions financières dès que leurs dates
 * différaient : la courbe d'un modèle passait de 98 % à 53 % sans qu'il ait changé,
 * parce que c'est la tâche qui avait changé.
 */
export function runsByBenchmark(histories: BenchmarkHistory[], modelId: string): BenchmarkRuns[] {
  return histories.flatMap((history) => {
    const points = [...modelHistory(history, modelId)].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return points.length === 0 ? [] : [{ benchmarkId: history.benchmarkId, points }];
  });
}

/** La place de chaque date entre la première (0) et la dernière (1). */
export function timePositions(dates: string[]): number[] {
  const temps = dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  const debut = Math.min(...temps);
  const duree = Math.max(...temps) - debut;
  return temps.map((t) => (duree === 0 ? 0.5 : (t - debut) / duree));
}

/**
 * Les bornes d'un axe tronqué : la plage des valeurs, élargie d'une marge et
 * calée sur des nombres ronds. Une courbe d'exactitude n'a pas besoin de partir
 * de zéro, mais ses graduations doivent dire où elle commence.
 */
export function axisRange(values: number[], margin = 5): { lo: number; hi: number; ticks: number[] } {
  const bas = Math.min(...values) - margin;
  const haut = Math.max(...values) + margin;
  const pas = haut - bas <= 20 ? 5 : haut - bas <= 50 ? 10 : 20;
  const lo = Math.max(0, Math.floor(bas / pas) * pas);
  const hi = Math.min(100, Math.ceil(haut / pas) * pas);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += pas) ticks.push(t);
  return { lo, hi, ticks };
}

export type OrdinalSuffixes = { one: string; two: string; few: string; other: string };

/** « 1er », « 2e » ; “1st”, “2nd”, “3rd”, “11th” : Intl connaît la règle, le dictionnaire les terminaisons. */
export function ordinal(n: number, locale: string, suffixes: OrdinalSuffixes): string {
  const regle = new Intl.PluralRules(locale, { type: "ordinal" }).select(n);
  const suffixe = regle === "one" || regle === "two" || regle === "few" ? suffixes[regle] : suffixes.other;
  return `${n}${suffixe}`;
}
