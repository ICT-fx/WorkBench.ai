import type { Criterion, FieldVerdict, Value } from "@hub/schema";

/** Formules par lesquelles un modèle signale qu'il n'a rien trouvé. */
const ABSTENTIONS = new Set([
  "", "-", "—", "–", "n/a", "na", "null", "none", "nil", "aucun", "aucune",
  "non trouvé", "non trouve", "non renseigné", "non renseigne", "non précisé",
  "non precise", "non spécifié", "non specifie", "non applicable", "inconnu",
  "absent", "absente", "vide", "?",
]);

const deaccent = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Ramène une réponse de modèle à `null` quand elle exprime une absence.
 *
 * Sans cette normalisation, un modèle qui répond « non trouvé » — donc qui
 * s'abstient correctement — serait compté comme ayant halluciné une chaîne.
 */
export function normalizeGot(got: unknown): Value | null {
  if (got === null || got === undefined) return null;
  if (typeof got === "string") {
    const t = got.trim();
    if (ABSTENTIONS.has(deaccent(t.toLowerCase()))) return null;
    return t === "" ? null : t;
  }
  if (Array.isArray(got)) return got.length === 0 ? null : (got as Value);
  return got as Value;
}

/** Lit un montant, quel que soit le format de rendu du modèle. */
export function parseNumber(v: Value): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  let s = v.replace(/[\s   ]/g, "");
  s = s.replace(/(eur|euros?|chf|usd|dollars?|francs?)/gi, "");
  s = s.replace(/[€$£]/g, "");

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    // Le séparateur le plus à droite est le décimal, l'autre marque les milliers.
    const [decimal, thousands] = lastComma > lastDot ? [",", "."] : [".", ","];
    s = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // Un séparateur seul ne marque les milliers que s'il découpe des groupes
    // réguliers de trois chiffres, le premier ne commençant pas par zéro :
    // « 1,234 » vaut 1234, mais « 0,125 » vaut 0,125.
    s = /^[1-9]\d{0,2}(,\d{3})+$/.test(s) ? s.split(",").join("") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  }

  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

const MONTHS = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"];

/** Retrouve un mois écrit en toutes lettres, en français ou en anglais. */
function moisEcrit(mot: string): number {
  const debut = mot.slice(0, 3);
  const i = MOIS.findIndex((m) => m.startsWith(debut));
  if (i >= 0) return i + 1;
  const j = MONTHS.findIndex((m) => m.startsWith(debut));
  return j >= 0 ? j + 1 : 0;
}

/** Une année à deux chiffres désigne le siècle courant. */
const anneePleine = (a: number): number => (a < 100 ? 2000 + a : a);

const iso = (y: number, m: number, d: number): string | null =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31
    ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : null;

/**
 * Normalise une date en AAAA-MM-JJ.
 *
 * Une seule lecture est admise, celle du pays du document : accepter les deux
 * rendrait le comparateur incapable de détecter une inversion jour/mois, qui
 * est précisément l'erreur la plus coûteuse en comptabilité.
 */
export function parseDate(v: Value, order: "DMY" | "MDY" = "DMY"): string | null {
  if (typeof v !== "string") return null;
  const s = deaccent(v.trim().toLowerCase());

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (numeric) {
    const [a, b] = [Number(numeric[1]), Number(numeric[2])];
    const [jour, mois] = order === "MDY" ? [b, a] : [a, b];
    return iso(anneePleine(Number(numeric[3])), mois, jour);
  }

  // « 3 février 2026 » ou « 3rd February 2026 »
  const ecritJourDabord = /^(\d{1,2})(?:er|st|nd|rd|th)?\s+([a-z]+)\.?,?\s+(\d{2}|\d{4})$/.exec(s);
  if (ecritJourDabord) {
    const mois = moisEcrit(ecritJourDabord[2]!);
    if (mois > 0) return iso(anneePleine(Number(ecritJourDabord[3])), mois, Number(ecritJourDabord[1]));
  }

  // « February 3, 2026 »
  const ecritMoisDabord = /^([a-z]+)\.?\s+(\d{1,2})(?:er|st|nd|rd|th)?,?\s+(\d{2}|\d{4})$/.exec(s);
  if (ecritMoisDabord) {
    const mois = moisEcrit(ecritMoisDabord[1]!);
    if (mois > 0) return iso(anneePleine(Number(ecritMoisDabord[3])), mois, Number(ecritMoisDabord[2]));
  }

  return null;
}

/** Compare des identifiants : la ponctuation et la casse ne comptent pas, les chiffres si. */
const normalizeExact = (v: Value): string =>
  deaccent(String(v).toLowerCase()).replace(/[^a-z0-9]/g, "");

const tokens = (v: Value): string[] =>
  deaccent(String(v).toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);

const STOPWORDS = new Set(["le", "la", "les", "de", "des", "du", "un", "une", "et",
  "sur", "non", "pas", "au", "aux", "par", "pour", "avec", "cette", "ce"]);

const significant = (v: Value): string[] =>
  [...new Set(tokens(v).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))];

/** Deux termes concordent si l'un est l'abréviation de l'autre (« art. » ↔ « article »). */
const tokenMatches = (a: string, b: string): boolean =>
  a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

function compareText(expected: Value, got: Value): FieldVerdict {
  const wanted = significant(expected);
  const found = tokens(got);
  const ok = wanted.every((w) => found.some((g) => tokenMatches(w, g)));
  return ok ? "correct" : "faux";
}

type LineLike = Record<string, Value>;

const asLines = (v: Value): LineLike[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null && !Array.isArray(x))
    ? (v as LineLike[])
    : null;

const numbersAgree = (a: Value | undefined, b: Value | undefined): boolean => {
  const na = a === undefined || a === null ? null : parseNumber(a);
  const nb = b === undefined || b === null ? null : parseNumber(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) <= 0.01;
};

/** Similarité de désignation : proportion des termes attendus retrouvés. */
function designationOverlap(a: Value | undefined, b: Value | undefined): number {
  const ta = significant(a ?? "");
  const tb = tokens(b ?? "");
  if (ta.length === 0) return 1;
  return ta.filter((t) => tb.some((u) => tokenMatches(t, u))).length / ta.length;
}

/**
 * Apparie les lignes produites aux lignes attendues et calcule un score F1.
 * L'ordre n'a pas d'importance, la reformulation d'un libellé non plus, mais
 * les chiffres doivent concorder.
 */
export function compareLines(expected: Value, got: Value): FieldVerdict {
  const exp = asLines(expected);
  const obtained = asLines(got);
  if (exp === null) return "faux";
  if (obtained === null) return "faux";

  const used = new Set<number>();
  let matched = 0;
  for (const e of exp) {
    const idx = obtained.findIndex((o, i) =>
      !used.has(i) &&
      numbersAgree(e.quantite, o.quantite) &&
      numbersAgree(e.prix_unitaire_ht, o.prix_unitaire_ht) &&
      numbersAgree(e.taux_tva, o.taux_tva) &&
      designationOverlap(e.designation, o.designation) >= 0.5);
    if (idx >= 0) {
      used.add(idx);
      matched++;
    }
  }
  const precision = obtained.length === 0 ? 0 : matched / obtained.length;
  const recall = exp.length === 0 ? 0 : matched / exp.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return f1 >= 0.9 ? "correct" : "faux";
}

/**
 * Le verdict d'un champ.
 *
 * L'ordre de décision est imposé : l'absence se juge avant le contenu, car
 * c'est elle qui distingue un modèle prudent d'un modèle qui invente.
 */
export function compareField(criterion: Criterion, expected: Value | null, got: unknown): FieldVerdict {
  const g = normalizeGot(got);

  if (expected === null && g === null) return "correct";
  if (expected === null) return "hallucine";
  if (g === null) return "manquant";

  switch (criterion.kind) {
    case "number": {
      const e = parseNumber(expected);
      const o = parseNumber(g);
      if (e === null || o === null) return "faux";
      return Math.abs(e - o) <= (criterion.tolerance ?? 0) ? "correct" : "faux";
    }
    case "date": {
      const e = parseDate(expected, criterion.dateOrder);
      const o = parseDate(g, criterion.dateOrder);
      if (e === null || o === null) return "faux";
      return e === o ? "correct" : "faux";
    }
    case "exact":
      return normalizeExact(expected) === normalizeExact(g) ? "correct" : "faux";
    case "lines":
      return compareLines(expected, g);
    case "text":
      return compareText(expected, g);
  }
}
