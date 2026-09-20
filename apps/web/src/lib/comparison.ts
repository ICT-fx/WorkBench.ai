import type { Domain, Lab, Model } from "@hub/schema";
import { modelSlug } from "./hub";

/**
 * L'état de la page Comparaison et les règles qui le gouvernent.
 *
 * Module pur, sans DOM : une comparaison se partage en copiant son adresse,
 * l'URL est donc la seule mémoire de la page. Tout ce qui la lit, l'écrit ou la
 * complète vit ici, et se teste.
 */

/** Au-delà de cinq colonnes, plus personne ne compare : on parcourt un classement. */
export const MAX_MODELS = 5;

/** Une ligne de la grille : l'indice, un métier (`d:<id>`) ou un benchmark (`b:<id>`). */
export const INDICE_ROW = "indice";
export const domainRow = (id: string): string => `d:${id}`;
export const benchmarkRow = (id: string): string => `b:${id}`;

export type Selection = { models: string[]; rows: string[] };

/** Ce que dit l'URL une fois nettoyée, avant tout complément par défaut. */
export type ParsedSelection = Selection & {
  /** Le visiteur a lui-même réduit la comparaison à un seul modèle. */
  solo: boolean;
};

export type Known = { models: ReadonlySet<string>; rows: ReadonlySet<string> };

type Params = { get(name: string): string | null };

const list = (raw: string | null, known: ReadonlySet<string>, max = Infinity): string[] => {
  if (raw === null) return [];
  // Un Set garde l'ordre d'arrivée : le premier exemplaire d'un doublon l'emporte.
  const seen = new Set(raw.split(",").map((item) => item.trim()).filter((item) => known.has(item)));
  return [...seen].slice(0, max);
};

/**
 * Lit `?m=<slug>,<slug>…` et `?l=<ligne>,<ligne>…`. Une adresse se recopie, se
 * tronque, vieillit : ce qui n'existe pas (ou plus) est ignoré sans bruit.
 */
export function parseSelection(params: Params, known: Known): ParsedSelection {
  return {
    models: list(params.get("m"), known.models, MAX_MODELS),
    rows: list(params.get("l"), known.rows),
    solo: params.get("seul") === "1",
  };
}

/**
 * Complète ce que l'URL ne dit pas. Un modèle seul est l'adresse que portent les
 * fiches (« Comparer ce modèle ») : on l'entoure des modèles par défaut, lui en
 * tête — sauf si le visiteur a lui-même tout retiré autour de lui.
 */
export function resolveSelection(parsed: ParsedSelection, defaults: Selection): Selection {
  const [only] = parsed.models;
  const models = only === undefined
    ? defaults.models
    : parsed.models.length === 1 && !parsed.solo
      ? [only, ...defaults.models.filter((slug) => slug !== only)].slice(0, MAX_MODELS)
      : parsed.models;
  return { models, rows: parsed.rows.length === 0 ? defaults.rows : parsed.rows };
}

export const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i]);

// Virgule et deux-points sont légaux dans une requête : les laisser lisibles
// garde une adresse que l'on peut dicter ou corriger à la main.
const encode = (item: string): string => encodeURIComponent(item).replaceAll("%3A", ":");

/**
 * La requête qui restitue une sélection. Les modèles y figurent toujours (un lien
 * partagé doit montrer les mêmes modèles dans six mois, quel que soit le
 * classement du jour) ; les lignes seulement si elles s'écartent du défaut.
 */
export function serializeSelection(selection: Selection, defaultRows: readonly string[] = []): string {
  const parts = [`m=${selection.models.map(encode).join(",")}`];
  if (!sameList(selection.rows, defaultRows)) parts.push(`l=${selection.rows.map(encode).join(",")}`);
  if (selection.models.length === 1) parts.push("seul=1");
  return parts.join("&");
}

type Candidate = {
  model: Pick<Model, "id" | "weights">;
  lab: Pick<Lab, "country">;
  indice: number | null;
};

/**
 * La comparaison qu'ouvrirait une entreprise française : le podium, puis ce
 * qu'elle peut héberger elle-même (poids ouverts) et ce qui se fait de mieux en
 * France. Un même modèle peut cocher plusieurs cases : il n'apparaît qu'une fois.
 */
export function defaultModels(scores: readonly Candidate[]): string[] {
  const ranked = scores
    .filter((s): s is Candidate & { indice: number } => s.indice !== null)
    .sort((a, b) => b.indice - a.indice);
  // Sans indice publié, la page s'ouvre quand même sur quelque chose.
  const pool: readonly Candidate[] = ranked.length > 0 ? ranked : scores;
  const picks = [
    ...pool.slice(0, 3),
    pool.find((s) => s.model.weights === "ouverts"),
    pool.find((s) => s.lab.country === "FR"),
  ].filter((s): s is Candidate => s !== undefined);
  return [...new Set(picks.map((s) => modelSlug(s.model.id)))].slice(0, MAX_MODELS);
}

export const defaultRows = (domains: readonly Pick<Domain, "id">[]): string[] =>
  [INDICE_ROW, ...domains.map((d) => domainRow(d.id))];

/**
 * Les cellules à surligner dans une ligne : toutes les ex æquo. Il faut au moins
 * deux valeurs connues — être le meilleur de soi seul ne dit rien.
 */
export function bestOfRow(
  values: readonly (number | null)[],
  { lowerIsBetter = false }: { lowerIsBetter?: boolean } = {},
): number[] {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return [];
  const target = lowerIsBetter ? Math.min(...known) : Math.max(...known);
  return values.flatMap((v, i) => (v === target ? [i] : []));
}

/**
 * L'avance du premier sur le deuxième tient-elle dans la marge d'erreur ? Même
 * règle que `indistinguishable` : la plus large des deux marges fait foi.
 */
export function leadWithinMargin(values: readonly (number | null)[], margins: readonly (number | null)[]): boolean {
  const [first, second] = values
    .flatMap((v, i) => (v === null ? [] : [{ v, margin: margins[i] ?? 0 }]))
    .sort((a, b) => b.v - a.v);
  if (first === undefined || second === undefined) return false;
  return first.v - second.v < Math.max(first.margin, second.margin);
}

/** Un coût ou un tarif nul est un coût inconnu : il ne concourt pas au « moins cher ». */
export const knownAmount = (n: number | null): number | null => (n === null || n <= 0 ? null : n);

/**
 * La marge d'une moyenne de scores indépendants — la formule de l'indice dans
 * `buildHub`, appliquée à un métier. Inconnue dès qu'une seule marge manque.
 */
export function meanMargin(margins: readonly (number | null | undefined)[]): number | null {
  const known = margins.filter((m): m is number => typeof m === "number");
  if (known.length === 0 || known.length !== margins.length) return null;
  return Math.round((Math.sqrt(known.reduce((sum, m) => sum + m * m, 0)) / known.length) * 10) / 10;
}

/** Ajoute en fin de liste ; sans effet si la valeur y est déjà ou si la liste est pleine. */
export const added = (items: readonly string[], value: string, max = Infinity): string[] =>
  items.includes(value) || items.length >= max ? [...items] : [...items, value];

/** Retire une valeur ; la dernière reste, une comparaison vide ne montre rien. */
export const removed = (items: readonly string[], value: string): string[] =>
  items.length <= 1 ? [...items] : items.filter((item) => item !== value);

/** Remplace en gardant la place — donc la colonne et la couleur — du modèle sortant. */
export const replaced = (items: readonly string[], index: number, value: string): string[] =>
  items.includes(value) || index < 0 || index >= items.length
    ? [...items]
    : items.map((item, i) => (i === index ? value : item));

const fold = (text: string): string => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Recherche tolérante : sans accents ni casse, chaque mot de la requête doit apparaître. */
export function matchesQuery(query: string, ...fields: string[]): boolean {
  const haystack = fold(fields.join(" "));
  return fold(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/**
 * Le centre du radar. Partir de zéro écraserait des scores tous compris entre
 * 50 et 90 en un même décagone ; on part de cinq points sous le plus bas,
 * arrondis à la dizaine inférieure — et l'échelle est écrite sous le graphique.
 */
export function radarFloor(values: readonly (number | null)[]): number {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return 0;
  return Math.max(0, Math.floor((Math.min(...known) - 5) / 10) * 10);
}

/**
 * Le bord du radar : cinq points au-dessus du plus haut, arrondis à la dizaine
 * supérieure, sans dépasser 100. Un bord figé à 100 tasserait au centre des
 * scores qui culminent à 80.
 */
export function radarCeiling(values: readonly (number | null)[]): number {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return 100;
  return Math.min(100, Math.ceil((Math.max(...known) + 5) / 10) * 10);
}

/** Des graduations rondes de zéro jusqu'au-dessus du maximum : un histogramme part toujours de zéro. */
export function ticksFromZero(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw * (1 - 1e-9)) ?? raw;
  const count = Math.ceil(max / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}

/** Coupe un libellé d'axe en deux lignes équilibrées ; un mot seul reste entier. */
export function splitLabel(label: string, maxChars = 12): string[] {
  const words = label.split(" ");
  if (label.length <= maxChars || words.length < 2) return [label];
  let best: [string, string] = [label, ""];
  for (let i = 1; i < words.length; i++) {
    const pair: [string, string] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    // Une esperluette ou un article en tête de seconde ligne se lit mal.
    if (/^(&|et|and|de|of)$/i.test(words[i]!) && i + 1 < words.length) continue;
    if (Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length)) best = pair;
  }
  return best[1] === "" ? [label] : best;
}
