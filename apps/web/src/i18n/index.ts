import type { Localized } from "@hub/schema";
import type { Locale } from "./config";
import { common } from "./dict/common";
import { home } from "./dict/home";
import { benchmarks } from "./dict/benchmarks";
import { models } from "./dict/models";
import { comparison } from "./dict/comparison";
import { news } from "./dict/news";
import { about } from "./dict/about";

export * from "./config";

/**
 * Un fichier par espace de noms, les deux langues côte à côte : une clé ajoutée
 * en français sans son pendant anglais est une erreur de type, pas un trou
 * découvert en production.
 */
const dictionaries = {
  fr: { common: common.fr, home: home.fr, benchmarks: benchmarks.fr, models: models.fr, comparison: comparison.fr, news: news.fr, about: about.fr },
  en: { common: common.en, home: home.en, benchmarks: benchmarks.en, models: models.en, comparison: comparison.en, news: news.en, about: about.en },
};

export type Dictionary = (typeof dictionaries)["fr"];

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

/** Le texte éditorial d'une donnée, dans la langue de la page. */
export const tr = (text: Localized, locale: Locale): string => text[locale];

/** Remplace les `{jetons}` d'une phrase du dictionnaire. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));

/** Préfixe un chemin interne par la langue courante. */
export const href = (locale: Locale, path = ""): string => `/${locale}${path}`;
