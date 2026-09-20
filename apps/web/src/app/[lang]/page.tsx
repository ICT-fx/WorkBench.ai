import Link from "next/link";
import { notFound } from "next/navigation";
import { fill, getDictionary, href, isLocale, tr } from "@/i18n";
import { getHub } from "@/lib/site";
import { getNews } from "@/lib/news";
import { bestPerLab, frontier, type ModelScore } from "@/lib/hub";
import { date } from "@/lib/format";
import { labView, modelHref, scatterPoints } from "@/lib/views";
import { Icon } from "@/components/ui/Icon";
import { serie } from "@/components/ui/LabMark";
import { BarresIndice } from "@/components/charts/BarresIndice";
import { CourbesTemps, type TimeMode, type TimeSerie } from "@/components/charts/CourbesTemps";
import { Ticker } from "@/components/home/Ticker";
import { DerniersRapports, type Report } from "@/components/home/DerniersRapports";
import { ClassementMetier, type DomainTab } from "@/components/home/ClassementMetier";

/** Le nuage de l'accueil se limite aux sorties récentes : au-delà, il devient illisible. */
const RECENTS = 24;

export default async function Accueil({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const site = getHub();
  const { hub, domains, benchmarks, labs, leaderboards } = site;
  const news = getNews(lang);
  const t = dict.home;

  const barres = bestPerLab(hub.scores).map((s) => ({
    id: s.model.id, name: s.model.name, href: modelHref(lang, s.model.id), lab: labView(s.lab),
    indice: s.indice!, cost: s.cost, latency: s.latency,
  }));

  const scoreById = new Map(hub.scores.map((s) => [s.model.id, s]));
  const rapports: Report[] = news.slice(0, 5).map((n) => {
    const lb = n.benchmark === undefined ? undefined : leaderboards.get(n.benchmark);
    const b = benchmarks.find((x) => x.id === n.benchmark);
    const s = n.model === undefined ? undefined : scoreById.get(n.model);
    const side: Report["side"] =
      lb !== undefined && b !== undefined
        ? {
            title: `${t.reports.topOf} — ${tr(b.label, lang)}`,
            href: href(lang, `/benchmarks/${b.id}`),
            demo: lb.status === "demo",
            rows: [...lb.rows].sort((x, y) => y.exactitude - x.exactitude).slice(0, 5).flatMap((row) => {
              const m = scoreById.get(row.model);
              return m === undefined ? [] : [{ label: m.model.name, value: row.exactitude, lab: labView(m.lab) }];
            }),
          }
        : s !== undefined
          ? {
              title: `${t.reports.bestDomains} — ${s.model.name}`,
              href: modelHref(lang, s.model.id),
              demo: hub.demo,
              rows: domains
                .flatMap((d) => (s.byDomain[d.id] == null ? [] : [{ label: tr(d.label, lang), value: s.byDomain[d.id]! }]))
                .sort((x, y) => y.value - x.value)
                .slice(0, 5),
            }
          : null;
    return {
      slug: n.slug, href: href(lang, `/news/${n.slug}`), date: date(n.date, lang), kind: dict.news.kinds[n.kind],
      title: n.title, summary: n.summary,
      bullets: n.body.filter((l) => l.startsWith("- ")).slice(0, 3).map((l) => l.slice(2)),
      side,
    };
  });

  const onglets: DomainTab[] = domains.map((d) => ({
    id: d.id, label: tr(d.label, lang), icon: d.icon,
    benchmarks: benchmarks.filter((b) => b.domain === d.id && leaderboards.has(b.id)).map((b) => {
      const lb = leaderboards.get(b.id)!;
      return {
        id: b.id, label: tr(b.label, lang), question: tr(b.question, lang), unit: tr(b.unit, lang),
        href: href(lang, `/benchmarks/${b.id}`), demo: lb.status === "demo",
        points: scatterPoints(site, lb, lang, RECENTS),
      };
    }),
  })).filter((d) => d.benchmarks.length > 0);

  // Trois lectures de la même frontière : par labo, par pays, par ouverture des poids.
  const groupe = (id: string, label: string, color: string, membres: ModelScore[]): TimeSerie => ({
    id, label, color,
    points: frontier(membres, (s) => s.indice).map((p) => ({ date: p.date, value: p.value, modelName: p.modelName })),
  });
  const pays = [...new Set(labs.map((l) => l.country))];
  const modes: TimeMode[] = [
    { id: "labs", label: t.time.labs, series: labs.map((l) => groupe(l.id, l.name, serie(l), hub.scores.filter((s) => s.lab.id === l.id))) },
    {
      id: "countries", label: t.time.countries,
      series: pays.map((c, i) => groupe(
        c, (dict.common.countries as Record<string, string>)[c] ?? c, `var(--color-serie-${i + 1})`,
        hub.scores.filter((s) => s.lab.country === c),
      )),
    },
    {
      id: "weights", label: t.time.weights,
      series: [
        groupe("fermes", dict.common.labels.closedWeights, "var(--color-serie-7)", hub.scores.filter((s) => s.model.weights === "fermes")),
        groupe("ouverts", dict.common.labels.openWeights, "var(--color-serie-3)", hub.scores.filter((s) => s.model.weights === "ouverts")),
      ],
    },
  ];

  return (
    <>
      <Ticker items={news.slice(0, 5).map((n) => ({ href: href(lang, `/news/${n.slug}`), date: date(n.date, lang), title: n.title }))} />

      <main>
        <section className="conteneur pb-14 pt-16 sm:pt-24">
          <h1 className="etendu max-w-[22ch] text-4xl sm:text-[3.4rem]">{t.hero.title}</h1>
          <p className="mt-6 max-w-[62ch] text-lg text-encre-pale">{t.hero.lead}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={href(lang, "/benchmarks")} className="bouton bouton-plein">
              {t.hero.ctaBenchmarks}
              <Icon name="arrow-right" size={15} />
            </Link>
            <Link href={href(lang, "/comparison")} className="bouton">
              <Icon name="swap" size={15} />
              {t.hero.ctaCompare}
            </Link>
          </div>
          <p className="chiffres mt-8 text-sm text-encre-muette">
            {fill(t.hero.facts, { models: site.models.length, labs: labs.length, benchmarks: benchmarks.length, domains: domains.length })}
          </p>
        </section>

        <div className="conteneur">
          <h2 className="sr-only">{t.index.title}</h2>
          <BarresIndice items={barres} updated={date(hub.updated, lang)} demo={hub.demo} />
        </div>

        {rapports.length > 0 && (
          <section className="conteneur mt-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="etendu text-3xl">{t.reports.title}</h2>
                <p className="mt-2 text-encre-pale">{t.reports.lead}</p>
              </div>
              <Link href={href(lang, "/news")} className="bouton">
                {t.reports.all}
                <Icon name="arrow-right" size={15} />
              </Link>
            </div>
            <div className="mt-8">
              <DerniersRapports reports={rapports} />
            </div>
          </section>
        )}

        <section className="conteneur mt-24">
          <h2 className="etendu text-3xl">{t.domains.title}</h2>
          <p className="mt-2 max-w-[64ch] text-encre-pale">{t.domains.lead}</p>
          <div className="mt-8">
            <ClassementMetier domains={onglets} shown={RECENTS} />
          </div>
        </section>

        <section className="conteneur mt-24">
          <h2 className="etendu text-3xl">{t.time.title}</h2>
          <p className="mt-2 max-w-[64ch] text-encre-pale">{t.time.lead}</p>
          <div className="mt-8">
            <CourbesTemps modes={modes} end={hub.updated} demo={hub.demo} />
          </div>
        </section>
      </main>
    </>
  );
}
