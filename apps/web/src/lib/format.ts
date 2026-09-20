import { INTL, type Locale } from "@/i18n/config";

/** « 72,6 % » en français, « 72.6% » en anglais : l'espace insécable suit la langue. */
export const pct = (n: number, locale: Locale, digits = 1): string =>
  new Intl.NumberFormat(INTL[locale], { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(n / 100);

export const num = (n: number, locale: Locale, digits = 1): string =>
  new Intl.NumberFormat(INTL[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

/**
 * Un coût par cas de test, en dollars : les tarifs publics sont en dollars, les
 * convertir daterait le chiffre. La précision suit l'ordre de grandeur — un coût
 * se compte souvent en fractions de centime.
 */
export function usd(n: number | null, locale: Locale): string {
  if (n === null || n === 0) return "—";
  const digits = n >= 100 ? 0 : n >= 1 ? 2 : n >= 0.01 ? 3 : 4;
  return new Intl.NumberFormat(INTL[locale], {
    style: "currency", currency: "USD", currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(n);
}

/** Un tarif au million de tokens : « 5 $ », « 0,15 $ ». */
export function price(n: number | null, locale: Locale): string {
  if (n === null) return "—";
  return new Intl.NumberFormat(INTL[locale], {
    style: "currency", currency: "USD", currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0, maximumFractionDigits: 3,
  }).format(n);
}

export function duration(ms: number | null, locale: Locale): string {
  if (ms === null || ms === 0) return "—";
  const s = ms / 1000;
  if (s < 60) return `${num(s, locale, 1)} s`;
  return `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
}

/** Le premier du mois s'écrit « 1er » en français : Intl ignore cet usage. */
export const date = (iso: string, locale: Locale, month: "short" | "long" = "short"): string => {
  const texte = new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString(INTL[locale], { day: "numeric", month, year: "numeric", timeZone: "UTC" });
  return locale === "fr" ? texte.replace(/^1 /, "1er ") : texte;
};

export const monthYear = (iso: string, locale: Locale): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(INTL[locale], { month: "short", year: "2-digit", timeZone: "UTC" });

/** « 1 M », « 128 k » : une fenêtre de contexte se lit en ordre de grandeur. */
export function tokens(n: number | null, locale: Locale = "fr"): string {
  if (n === null) return "—";
  const [valeur, unite] = n >= 1e6 ? [Math.round(n / 1e5) / 10, "M"] : [Math.round(n / 1000), "k"];
  const texte = new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 1 }).format(valeur);
  // Le français sépare le nombre de son unité par une espace insécable ; l'anglais les accole.
  return locale === "fr" ? `${texte}\u00a0${unite}` : `${texte}${unite}`;
}
