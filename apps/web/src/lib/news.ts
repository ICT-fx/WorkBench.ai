import type { Benchmark, Domain, News } from "@hub/schema";
import { INTL, fill, getDictionary, tr, type Locale } from "@/i18n";
import { loadNews } from "./data";
import { date, num, pct, usd } from "./format";
import { modelSlug, type Hub, type ModelScore } from "./hub";
import { getHub } from "./site";

export type NewsItem = {
  slug: string;
  date: string;
  kind: "modele" | "benchmark" | "analyse" | "annonce";
  title: string;
  summary: string;
  /** Paragraphes ; une ligne commençant par « - » est une puce. */
  body: string[];
  featured: boolean;
  /** Identifiant du modèle ou du benchmark concerné, s'il y en a un. */
  model?: string;
  benchmark?: string;
  /** Article rédigé par le hub à partir des classements, et non à la main. */
  auto: boolean;
};

/** Un modèle sorti depuis plus longtemps n'est plus une actualité : sa fiche suffit. */
export const REPORT_WINDOW_DAYS = 120;

/** Le compte rendu paraît deux jours après la sortie — jamais après la dernière publication du hub. */
const REPORT_DELAY_DAYS = 2;

const JOUR = 24 * 3600 * 1000;

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * JOUR).toISOString().slice(0, 10);

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Les espaces insécables du français : sans elles, un deux-points ou un guillemet
 * fermant passe seul à la ligne sur un écran étroit. Posées au rendu plutôt que
 * dans les textes sources, où un caractère invisible ne survit pas à une relecture.
 */
export function typo(text: string, locale: Locale): string {
  const lie = text.replace(/± /g, "±\u00a0");
  return locale === "fr" ? lie.replace(/ ([:;!?%»])/g, "\u00a0$1").replace(/« /g, "«\u00a0") : lie;
}

export type BodyBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

/** Regroupe les lignes d'un corps d'article : une suite de lignes « - » forme une liste. */
export function bodyBlocks(body: string[]): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const line of body) {
    if (!line.startsWith("- ")) {
      blocks.push({ type: "p", text: line });
      continue;
    }
    const last = blocks.at(-1);
    if (last?.type === "ul") last.items.push(line.slice(2));
    else blocks.push({ type: "ul", items: [line.slice(2)] });
  }
  return blocks;
}

/** Ce qu'il faut du catalogue pour rédiger : le nom des métiers et la liste des benchmarks. */
export type ReportCatalogue = { domains: Domain[]; benchmarks: Benchmark[] };

const lisDocuments = (s: ModelScore): boolean =>
  s.model.modalities.includes("image") || s.model.modalities.includes("pdf");

/**
 * Le modèle précédent du même labo : sa sortie la plus récente avant celle-ci.
 * Quand le labo en a sorti plusieurs le même jour, on retient le mieux classé :
 * c'est la comparaison qui dit si la nouvelle sortie fait mieux que l'ancienne gamme.
 */
function predecessor(s: ModelScore, scores: ModelScore[]): ModelScore | undefined {
  return scores
    .filter((o) => o.lab.id === s.lab.id && o.model.released < s.model.released)
    .sort((a, b) => b.model.released.localeCompare(a.model.released) || (b.indice ?? -1) - (a.indice ?? -1))[0];
}

/**
 * Les comptes rendus que le hub rédige seul, à partir des classements : un par
 * modèle sorti dans les 120 jours qui précèdent la dernière publication.
 *
 * Fonction pure — ni disque ni horloge — et chaque phrase est calculée : aucune
 * n'avance sur un modèle autre chose que ce que portent les données.
 */
export function modelReports(hub: Hub, catalogue: ReportCatalogue, locale: Locale): NewsItem[] {
  if (hub.updated === "") return [];
  const t = getDictionary(locale).news.report;
  const depuis = addDays(hub.updated, -REPORT_WINDOW_DAYS);

  // Un benchmark du catalogue sans classement publié n'a été passé par personne :
  // le compter ferait croire qu'il manque à chaque modèle.
  const publies = catalogue.benchmarks.filter((b) => hub.scores.some((s) => s.byBenchmark[b.id] !== undefined)).length;
  const classes = hub.scores.filter((s) => s.indice !== null).length;
  const parCout = hub.scores.filter((s) => s.cost !== null).sort((a, b) => a.cost! - b.cost!);

  const ordinal = (n: number): string => {
    const forme = new Intl.PluralRules(INTL[locale], { type: "ordinal" }).select(n);
    return fill(forme === "one" || forme === "two" || forme === "few" ? t.ordinal[forme] : t.ordinal.other, { n });
  };
  // « 1,5 point » mais « 1.5 points » : l'accord suit la langue, sur la valeur affichée.
  const points = (x: number): string =>
    new Intl.PluralRules(INTL[locale]).select(round1(x)) === "one" ? t.point.one : t.point.other;

  return hub.scores
    .filter((s) => s.benchmarksTaken > 0 && s.model.released >= depuis && s.model.released <= hub.updated)
    .map((s): NewsItem => {
      const puces: string[] = [];

      if (s.indice === null || s.rank === null) {
        puces.push(t.noIndex);
      } else {
        const valeurs = { rank: ordinal(s.rank), of: classes, indice: pct(s.indice, locale) };
        puces.push(s.ci === null
          ? fill(t.rank, valeurs)
          : fill(t.rankMargin, { ...valeurs, ci: num(s.ci, locale), unit: points(s.ci) }));
      }

      const avant = predecessor(s, hub.scores);
      if (avant !== undefined && s.indice !== null && avant.indice !== null) {
        const ecart = round1(s.indice - avant.indice);
        const valeurs = {
          points: num(Math.abs(ecart), locale), unit: points(Math.abs(ecart)),
          previous: avant.model.name, lab: s.lab.name, date: date(avant.model.released, locale, "long"),
        };
        const phrase = fill(ecart > 0 ? t.deltaUp : ecart < 0 ? t.deltaDown : t.deltaFlat, valeurs);
        const marge = s.ci !== null && avant.ci !== null ? Math.max(s.ci, avant.ci) : null;
        puces.push(ecart !== 0 && marge !== null && Math.abs(ecart) < marge ? `${phrase} ${t.deltaWithinMargin}` : phrase);
      }

      const metiers = catalogue.domains
        .flatMap((d) => (s.byDomain[d.id] == null ? [] : [{ label: tr(d.label, locale), score: s.byDomain[d.id]! }]))
        .sort((a, b) => b.score - a.score);
      const [premier, deuxieme] = metiers;
      const dernier = metiers.at(-1);
      if (metiers.length >= 3 && premier !== undefined && deuxieme !== undefined && dernier !== undefined) {
        puces.push(fill(t.domains, {
          first: premier.label, firstScore: pct(premier.score, locale),
          second: deuxieme.label, secondScore: pct(deuxieme.score, locale),
          last: dernier.label, lastScore: pct(dernier.score, locale),
        }));
      }

      if (s.cost === null) {
        puces.push(t.costUnknown);
      } else if (parCout.length >= 2) {
        const rang = parCout.indexOf(s) + 1;
        const gabarit = rang === 1 ? t.costCheapest : rang === parCout.length ? t.costPriciest : t.cost;
        puces.push(fill(gabarit, { cost: usd(s.cost, locale), rank: ordinal(rang), of: parCout.length }));
      }

      if (s.hallucinations !== null) puces.push(fill(t.hallucinations, { rate: pct(s.hallucinations, locale) }));

      const complet = s.benchmarksTaken >= publies;
      puces.push(fill(
        complet ? t.takenAll : lisDocuments(s) ? t.takenPartial : t.takenTextOnly,
        { taken: s.benchmarksTaken, n: publies },
      ));

      const sortie = addDays(s.model.released, REPORT_DELAY_DAYS);
      // L'avertissement est la première puce, pas un paragraphe : quiconque n'affiche
      // que les puces d'un compte rendu (l'accueil, par exemple) l'emporte avec elles.
      const lignes = hub.demo ? [t.demoWarning, ...puces] : puces;

      return {
        slug: `evaluation-${modelSlug(s.model.id)}`,
        date: sortie > hub.updated ? hub.updated : sortie,
        kind: "modele",
        title: fill(complet ? t.titleAll : t.titlePartial, { name: s.model.name, taken: s.benchmarksTaken, n: publies }),
        summary: fill(hub.demo ? t.summaryDemo : t.summary, {
          name: s.model.name, lab: s.lab.name, date: date(s.model.released, locale, "long"),
        }),
        body: lignes.map((l) => `- ${l}`),
        featured: false,
        model: s.model.id,
        auto: true,
      };
    });
}

/** Les articles de `data/news.json`, dans la langue demandée. */
export const editorialNews = (news: News[], locale: Locale): NewsItem[] =>
  news.map((n) => ({
    slug: n.slug, date: n.date, kind: n.kind,
    title: n.title[locale], summary: n.summary[locale], body: n.body[locale],
    featured: n.featured, model: n.model, benchmark: n.benchmark, auto: false,
  }));

/**
 * Réunit articles rédigés et comptes rendus générés, du plus récent au plus ancien.
 * À date égale, l'adresse départage : l'ordre ne dépend pas de celui des fichiers.
 */
export function mergeNews(items: NewsItem[], locale: Locale): NewsItem[] {
  const slugs = new Set(items.map((n) => n.slug));
  if (slugs.size !== items.length) {
    throw new Error("Deux actualités portent la même adresse : un article rédigé ne peut pas s'appeler comme un compte rendu généré.");
  }
  return items
    .map((n) => ({
      ...n,
      title: typo(n.title, locale), summary: typo(n.summary, locale), body: n.body.map((l) => typo(l, locale)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

/** Toutes les actualités dans la langue demandée, de la plus récente à la plus ancienne. */
export function getNews(locale: Locale): NewsItem[] {
  const { hub, domains, benchmarks } = getHub();
  return mergeNews([...editorialNews(loadNews(), locale), ...modelReports(hub, { domains, benchmarks }, locale)], locale);
}
