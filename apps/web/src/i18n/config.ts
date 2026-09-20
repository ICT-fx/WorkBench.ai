export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Le hub s'adresse d'abord aux entreprises françaises : le français est la langue par défaut. */
export const DEFAULT_LOCALE: Locale = "fr";

export const isLocale = (x: string): x is Locale => (LOCALES as readonly string[]).includes(x);

export const INTL: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };
