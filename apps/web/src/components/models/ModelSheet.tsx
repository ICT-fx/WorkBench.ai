import Link from "next/link";
import { fill, href, type Dictionary, type Locale } from "@/i18n";
import { date } from "@/lib/format";
import { modelSlug, type ModelScore } from "@/lib/hub";
import { getNews } from "@/lib/news";
import { getHub } from "@/lib/site";
import { Icon } from "@/components/ui/Icon";
import { LabMark, serie } from "@/components/ui/LabMark";
import { BenchmarkResults } from "./BenchmarkResults";
import { DomainScores } from "./DomainScores";
import { Overview } from "./Overview";
import { SpecGrid } from "./SpecGrid";
import { Stability } from "./Stability";
import { benchmarkGroups } from "./results";

/** La fiche d'un modèle : ce qu'en dit le catalogue, puis ce qu'en disent les classements. */
export function ModelSheet({ score, lang, dict }: { score: ModelScore; lang: Locale; dict: Dictionary }) {
  const site = getHub();
  const { model, lab } = score;
  const t = dict.models;
  const actualites = getNews(lang).filter((n) => n.model === model.id);

  const sortie = date(model.released, lang, "long");

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
        <div className="min-w-0">
          <a
            href={lab.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-full text-encre-pale no-underline transition-colors duration-150 ease-sortie hover:text-encre"
          >
            <LabMark lab={lab} size={28} />
            <span className="font-medium group-hover:underline">{lab.name}</span>
            <Icon name="arrow-up-right" size={16} />
            <span className="sr-only">({t.sheet.external})</span>
          </a>
          <h1 className="etendu mt-4 break-words text-4xl sm:text-5xl">{model.name}</h1>
          <p className="mt-3 text-sm text-encre-pale">{fill(t.sheet.released, { date: sortie })}</p>
        </div>
        <Link href={`${href(lang, "/comparison")}?m=${modelSlug(model.id)}`} className="bouton">
          <Icon name="swap" size={16} />
          {t.sheet.compare}
        </Link>
      </header>

      <SpecGrid model={model} lab={lab} lang={lang} dict={dict} />
      <Overview score={score} lang={lang} dict={dict} />
      <DomainScores score={score} lang={lang} dict={dict} />

      <section aria-labelledby="resultats" className="mt-16">
        <h2 id="resultats" className="etendu text-2xl">{t.results.title}</h2>
        <div className="mt-5">
          <BenchmarkResults groups={benchmarkGroups(score, site, lang, dict)} color={serie(lab)} demo={site.hub.demo} />
        </div>
      </section>

      <Stability score={score} lang={lang} dict={dict} />

      {actualites.length > 0 && (
        <section aria-labelledby="mises-a-jour" className="mt-16">
          <h2 id="mises-a-jour" className="etendu text-2xl">{t.updates.title}</h2>
          <ul className="mt-5 border-t border-filet">
            {actualites.map((article) => (
              <li key={article.slug} className="flex flex-col gap-x-6 gap-y-1 border-b border-filet py-3.5 sm:flex-row sm:items-baseline">
                <time dateTime={article.date} className="chiffres flex-none text-sm text-encre-pale sm:w-32">
                  {date(article.date, lang)}
                </time>
                <Link
                  href={href(lang, `/news/${article.slug}`)}
                  className="font-medium underline decoration-filet-fort transition-colors duration-150 ease-sortie hover:decoration-vert"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
