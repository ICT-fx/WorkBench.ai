import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, href, isLocale, tr } from "@/i18n";
import { date, pct } from "@/lib/format";
import { modelSlug } from "@/lib/hub";
import { getNews } from "@/lib/news";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, hasIcon } from "@/components/ui/Icon";
import { Prose } from "@/components/news/Prose";

/** Les adresses sont les mêmes dans les deux langues, comptes rendus générés compris. */
export function generateStaticParams() {
  return getNews("fr").map((n) => ({ slug: n.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/news/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const item = getNews(lang).find((n) => n.slug === slug);
  if (item === undefined) return {};
  return {
    title: item.title,
    description: item.summary,
    alternates: { languages: { fr: `/fr/news/${slug}`, en: `/en/news/${slug}` } },
  };
}

const A_LIRE_AUSSI = 3;

export default async function PageArticle({ params }: PageProps<"/[lang]/news/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const news = getNews(lang);
  const item = news.find((n) => n.slug === slug);
  if (item === undefined) notFound();

  const dict = getDictionary(lang);
  const t = dict.news;
  const { hub, domains, benchmarks, leaderboards } = getHub();
  const score = item.model === undefined ? undefined : hub.scores.find((s) => s.model.id === item.model);
  const benchmark = benchmarks.find((b) => b.id === item.benchmark && leaderboards.has(b.id));

  // Un compte rendu généré en démonstration s'ouvre par l'avertissement : il sort de la liste pour qu'on ne puisse pas le manquer.
  const avertissement = item.auto && hub.demo ? item.body[0]?.replace(/^- /, "") : undefined;
  const corps = avertissement === undefined ? item.body : item.body.slice(1);
  const autres = news.filter((n) => n.slug !== slug).slice(0, A_LIRE_AUSSI);

  return (
    <main className="conteneur pb-8 pt-10">
      <nav aria-label={t.article.breadcrumb} className="flex flex-wrap items-center gap-2 text-sm text-encre-pale">
        <Link href={href(lang, "/news")} className="no-underline hover:underline">{dict.common.nav.news}</Link>
        <Icon name="chevron-right" size={14} />
        <Link href={href(lang, `/news?type=${item.kind}`)} className="no-underline hover:underline">{t.index.tabs[item.kind]}</Link>
      </nav>

      <article>
        <header className="mt-8 max-w-[52rem]">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-encre-pale">
            <span className="pastille">{t.kinds[item.kind]}</span>
            <time dateTime={item.date} className="chiffres">{date(item.date, lang, "long")}</time>
          </p>
          <h1 className="etendu mt-4 break-words text-4xl sm:text-5xl">{item.title}</h1>
          <p className="mt-5 text-xl text-encre-pale">{item.summary}</p>
          {item.auto && <p className="mt-4 max-w-[68ch] text-sm text-encre-muette">{t.article.autoNote}</p>}
        </header>

        {avertissement !== undefined && (
          <p role="note" className="mt-8 flex max-w-[68ch] gap-3 rounded-[var(--radius-m)] border border-ambre-filet bg-ambre-pale px-4 py-3 text-sm text-ambre">
            <Icon name="warning" className="mt-0.5" />
            <span>{avertissement}</span>
          </p>
        )}

        <Prose body={corps} locale={lang} className="mt-8 text-[1.05rem]" />

        {score !== undefined && (
          <section aria-labelledby="scores-par-metier" className="mt-14 max-w-[68ch]">
            <h2 id="scores-par-metier" className="etendu text-2xl">{t.article.domainScores}</h2>
            <div className="panneau mt-6">
              <div className="barre">
                <p className="text-sm text-encre-pale">{t.article.domainScoresNote}</p>
                <DemoTag dict={dict} show={hub.demo} />
              </div>
              <div className="overflow-x-auto">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col"><span className="etiquette">{t.article.domain}</span></th>
                      <th scope="col" className="droite"><span className="etiquette">{t.article.score}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map((d) => {
                      const valeur = score.byDomain[d.id];
                      return (
                        <tr key={d.id}>
                          <th scope="row">
                            <span className="flex items-center gap-2.5">
                              <Icon name={hasIcon(d.icon) ? d.icon : "indice"} size={16} className="text-encre-muette" />
                              {tr(d.label, lang)}
                            </span>
                          </th>
                          <td className="chiffres droite">
                            {valeur == null ? <span className="text-encre-muette">{dict.common.labels.notTested}</span> : pct(valeur, lang)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-filet-fort bg-creux">
                      <th scope="row" className="px-[0.9rem] py-3 text-left font-semibold">{dict.common.metrics.indice}</th>
                      <td className="chiffres px-[0.9rem] py-3 text-right font-semibold">
                        {score.indice === null ? dict.common.labels.notRanked : pct(score.indice, lang)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={href(lang, `/models/${modelSlug(score.model.id)}`)} className="bouton bouton-plein">
                {t.article.viewModel}
                <Icon name="arrow-right" size={15} />
              </Link>
              <Link href={href(lang, `/comparison?m=${modelSlug(score.model.id)}`)} className="bouton">
                <Icon name="swap" size={15} />
                {t.article.compare}
              </Link>
            </div>
          </section>
        )}

        {benchmark !== undefined && (
          <p className="mt-10">
            <Link href={href(lang, `/benchmarks/${benchmark.id}`)} className="bouton bouton-plein">
              {t.article.viewBenchmark} — {tr(benchmark.label, lang)}
              <Icon name="arrow-right" size={15} />
            </Link>
          </p>
        )}
      </article>

      {autres.length > 0 && (
        <aside aria-labelledby="a-lire-aussi" className="mt-20 border-t border-filet pt-10">
          <h2 id="a-lire-aussi" className="etendu text-2xl">{t.article.related}</h2>
          <ul className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-3">
            {autres.map((n) => (
              <li key={n.slug}>
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-encre-pale">
                  <span className="pastille">{t.kinds[n.kind]}</span>
                  <time dateTime={n.date} className="chiffres">{date(n.date, lang)}</time>
                </p>
                <h3 className="mt-2.5 font-medium leading-snug">
                  <Link href={href(lang, `/news/${n.slug}`)} className="no-underline hover:underline">{n.title}</Link>
                </h3>
              </li>
            ))}
          </ul>
          <Link href={href(lang, "/news")} className="bouton mt-8">
            <Icon name="chevron-left" size={15} />
            {t.article.allNews}
          </Link>
        </aside>
      )}
    </main>
  );
}
