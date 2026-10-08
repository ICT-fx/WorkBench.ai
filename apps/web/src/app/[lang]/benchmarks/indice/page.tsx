import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fill, getDictionary, href, isLocale, tr } from "@/i18n";
import { getHub } from "@/lib/site";
import { bestPerLab } from "@/lib/hub";
import { date, pct } from "@/lib/format";
import { labView, modelHref } from "@/lib/views";
import { Icon } from "@/components/ui/Icon";
import { DemoTag } from "@/components/ui/DemoTag";
import { BarresIndice } from "@/components/charts/BarresIndice";
import { TableauIndice } from "@/components/benchmarks/TableauIndice";

export async function generateMetadata({ params }: PageProps<"/[lang]/benchmarks/indice">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).benchmarks.index;
  return { title: t.metaTitle, description: t.lead };
}

export default async function PageIndice({ params }: PageProps<"/[lang]/benchmarks/indice">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.benchmarks.index;
  const { hub, domains, benchmarks } = getHub();

  const classes = hub.scores.filter((s) => s.indice !== null);
  const [premier, deuxieme, troisieme] = classes;
  const ouvert = classes.find((s) => s.model.weights === "ouverts");
  const francais = classes.find((s) => s.lab.country === "FR");
  // Combien de modèles différents occupent la première place d'au moins un métier.
  const specialistes = new Set(domains.map((d) =>
    [...hub.scores].sort((a, b) => (b.byDomain[d.id] ?? -1) - (a.byDomain[d.id] ?? -1))[0]?.model.id)).size;

  const phrases = [
    premier !== undefined && deuxieme !== undefined && troisieme !== undefined && fill(t.leader, {
      first: premier.model.name, score: pct(premier.indice!, lang),
      second: deuxieme.model.name, score2: pct(deuxieme.indice!, lang),
      third: troisieme.model.name, score3: pct(troisieme.indice!, lang),
    }),
    ouvert !== undefined && fill(t.bestOpen, { model: ouvert.model.name, rank: ouvert.rank!, score: pct(ouvert.indice!, lang) }),
    francais !== undefined && fill(t.bestFrench, { model: francais.model.name, rank: francais.rank!, score: pct(francais.indice!, lang) }),
    specialistes > 1 && fill(t.specialists, { n: specialistes }),
  ].filter((p): p is string => typeof p === "string");

  return (
    <main className="conteneur pb-8 pt-10">
      <nav aria-label={dict.benchmarks.detail.breadcrumb} className="flex items-center gap-2 text-sm text-encre-pale">
        <Link href={href(lang, "/benchmarks")} className="no-underline hover:underline">{dict.benchmarks.detail.breadcrumb}</Link>
        <Icon name="chevron-right" size={14} />
        <span>{t.title}</span>
      </nav>

      <header className="mt-8 max-w-[52rem]">
        <p><DemoTag dict={dict} show={hub.demo} /></p>
        <h1 className="etendu mt-4 text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-xl text-encre-pale">{t.lead}</p>
        {/* L'étendue réelle de l'indice, à côté de son nom : « indice métier » sur
            un seul métier mesuré ne veut pas dire la même chose que sur dix. */}
        <p className="chiffres mt-4 text-sm text-encre-muette">
          {dict.common.labels.updated} {date(hub.updated, lang, "long")} ·{" "}
          {fill(t.scope, {
            domains: hub.coverage.domainsMeasured, domainsTotal: hub.coverage.domainsTotal,
            measured: hub.coverage.benchmarksMeasured, total: hub.coverage.benchmarksTotal,
            // Le français accorde : « 1 métier », « 2 métiers ».
            domainsS: hub.coverage.domainsMeasured > 1 ? "s" : "",
            measuredS: hub.coverage.benchmarksMeasured > 1 ? "s" : "",
          })}
        </p>
      </header>

      <div className="mt-10">
        <BarresIndice
          items={bestPerLab(hub.scores).map((s) => ({
            id: s.model.id, name: s.model.name, href: modelHref(lang, s.model.id), lab: labView(s.lab),
            indice: s.indice!, cost: s.cost, latency: s.latency,
          }))}
          updated={date(hub.updated, lang)}
          demo={hub.demo}
        />
      </div>

      <section className="mt-16 max-w-[52rem]">
        <h2 className="etendu text-2xl">{t.takeaways}</h2>
        <div className="prose-hub mt-5">
          <ul>{phrases.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="etendu text-2xl">{t.table}</h2>
        <p className="mt-2 max-w-[64ch] text-encre-pale">{t.tableLead}</p>
        <div className="mt-6">
          <TableauIndice
            rows={hub.scores.map((s) => ({
              id: s.model.id, name: s.model.name, href: modelHref(lang, s.model.id), lab: labView(s.lab),
              indice: s.indice, ci: s.ci, byDomain: s.byDomain, taken: s.benchmarksTaken,
            }))}
            domains={domains.map((d) => ({ id: d.id, label: tr(d.label, lang), icon: d.icon }))}
            total={benchmarks.length}
            demo={hub.demo}
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="etendu text-2xl">{t.how}</h2>
        <div className="prose-hub mt-5">{t.howBody.map((p) => <p key={p}>{p}</p>)}</div>
        <p className="mt-6">
          <Link href={href(lang, "/about/methodology")} className="bouton">
            {dict.common.footer.methodology}
            <Icon name="arrow-right" size={15} />
          </Link>
        </p>
      </section>
    </main>
  );
}
