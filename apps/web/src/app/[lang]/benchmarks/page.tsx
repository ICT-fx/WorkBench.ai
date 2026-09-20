import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, href, isLocale, tr } from "@/i18n";
import { getHub } from "@/lib/site";
import { date } from "@/lib/format";
import { Icon, hasIcon, type IconName } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import { DemoTag } from "@/components/ui/DemoTag";

export async function generateMetadata({ params }: PageProps<"/[lang]/benchmarks">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).benchmarks.list;
  return { title: t.metaTitle, description: t.lead };
}

type Carte = {
  href: string;
  label: string;
  description: string;
  updated: string;
  tested: number;
  badges: { icon?: IconName; label: string }[];
  demo: boolean;
  top: { name: string; lab: { slot?: number; monogram: string; name: string } }[];
};

export default async function PageBenchmarks({ params }: PageProps<"/[lang]/benchmarks">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.benchmarks.list;
  const { hub, domains, benchmarks, leaderboards } = getHub();
  const scoreById = new Map(hub.scores.map((s) => [s.model.id, s]));

  const icone = (name: string): IconName => (hasIcon(name) ? name : "indice");

  const sections = domains.map((d) => ({
    id: d.id,
    label: tr(d.label, lang),
    summary: tr(d.summary, lang),
    icon: icone(d.icon),
    cartes: benchmarks.filter((b) => b.domain === d.id && leaderboards.has(b.id)).map((b): Carte => {
      const lb = leaderboards.get(b.id)!;
      return {
        href: href(lang, `/benchmarks/${b.id}`),
        label: tr(b.label, lang),
        description: tr(b.description, lang),
        updated: date(lb.runDate, lang),
        tested: lb.rows.length,
        demo: lb.status === "demo",
        badges: [
          { label: b.maturity === "pipeline" ? dict.common.labels.pipeline : dict.common.labels.draft },
          { icon: b.input === "document" ? "document" : "text", label: b.input === "document" ? t.onDocuments : t.onText },
        ],
        top: [...lb.rows].sort((x, y) => y.exactitude - x.exactitude).slice(0, 3).flatMap((r) => {
          const s = scoreById.get(r.model);
          return s === undefined ? [] : [{ name: s.model.name, lab: s.lab }];
        }),
      };
    }),
  })).filter((s) => s.cartes.length > 0);

  const indice: Carte = {
    href: href(lang, "/benchmarks/indice"),
    label: t.indexTitle,
    description: t.indexDescription,
    updated: date(hub.updated, lang),
    tested: hub.scores.filter((s) => s.indice !== null).length,
    demo: hub.demo,
    badges: [],
    top: hub.scores.slice(0, 3).map((s) => ({ name: s.model.name, lab: s.lab })),
  };

  const sommaire = [{ id: "indice", label: t.indexBand, icon: "indice" as IconName }, ...sections];

  return (
    <main className="conteneur pb-8">
      <header className="max-w-[48rem] pb-14 pt-16 sm:pt-20">
        <h1 className="etendu text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-xl text-encre-pale">{t.lead}</p>
      </header>

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Le sommaire des métiers : une colonne collante sur grand écran, un ruban défilant ailleurs. */}
        <nav aria-label={t.jump} className="sticky top-16 z-20 -mx-4 self-start overflow-x-auto bg-papier/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:overflow-visible lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <ul className="flex gap-1 lg:flex-col">
            {sommaire.map((s) => (
              <li key={s.id} className="flex-none">
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm text-encre-pale no-underline transition-colors hover:bg-creux hover:text-encre lg:rounded-[var(--radius-m)]"
                >
                  <Icon name={s.icon} size={16} />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-10">
          <Section id="indice" icon="indice" label={t.indexBand} cartes={[indice]} dict={dict} />
          {sections.map((s) => (
            <Section key={s.id} id={s.id} icon={s.icon} label={s.label} summary={s.summary} cartes={s.cartes} dict={dict} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Section({ id, icon, label, summary, cartes, dict }: {
  id: string; icon: IconName; label: string; summary?: string; cartes: Carte[];
  dict: ReturnType<typeof getDictionary>;
}) {
  return (
    <section id={id} className="panneau scroll-mt-32 lg:scroll-mt-24">
      <div className="bandeau flex-wrap">
        <Icon name={icon} size={17} />
        <h2>{label}</h2>
        {summary !== undefined && (
          <p className="w-full text-[0.82rem] font-normal normal-case tracking-normal text-sur-vert/80 sm:ml-auto sm:w-auto">{summary}</p>
        )}
      </div>
      {/* Des cellules séparées par des filets, pas des cartes posées dans une carte. */}
      <ul className="grid gap-px bg-filet md:grid-cols-2 xl:grid-cols-3">
        {cartes.map((c) => (
          <li key={c.href} className="flex bg-surface">
            <Link href={c.href} className="group flex w-full flex-col no-underline transition-colors hover:bg-vert-brume">
              <div className="flex flex-1 flex-col px-6 pb-5 pt-6">
                <p className="flex flex-wrap items-center gap-1.5">
                  {c.badges.map((b) => (
                    <span key={b.label} className="pastille">
                      {b.icon !== undefined && <Icon name={b.icon} size={12} />}
                      {b.label}
                    </span>
                  ))}
                  <DemoTag dict={dict} show={c.demo} />
                </p>
                <h3 className="etendu mt-4 text-xl">{c.label}</h3>
                <dl className="chiffres mt-3 space-y-0.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="etiquette !text-vert">{dict.common.labels.updated}</dt>
                    <dd className="text-encre-pale">{c.updated}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="etiquette !text-vert">{dict.common.labels.modelsTested}</dt>
                    <dd className="text-encre-pale">{c.tested}</dd>
                  </div>
                </dl>
                <p className="mt-4 line-clamp-3 text-sm text-encre-pale">{c.description}</p>

                <p className="etiquette mt-6 !text-vert">{dict.common.labels.topModels}</p>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {c.top.map((m, i) => (
                    <li key={m.name} className="flex items-center gap-2.5">
                      <span className="chiffres w-3 text-xs text-encre-muette">{i + 1}</span>
                      <LabMark lab={m.lab} size={17} />
                      <span className="truncate">{m.name}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="etiquette flex items-center gap-2 border-t border-filet px-6 py-3 transition-colors group-hover:!text-encre">
                {dict.common.labels.viewDetails}
                <Icon name="arrow-right" size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </p>
            </Link>
          </li>
        ))}
        {/* Les cases vides d'une dernière rangée incomplète restent à la couleur du panneau. */}
        {cartes.length % 2 === 1 && <li aria-hidden className="hidden bg-surface md:block xl:hidden" />}
        {Array.from({ length: (3 - (cartes.length % 3)) % 3 }, (_, i) => (
          <li key={`vide-${i}`} aria-hidden className="hidden bg-surface xl:block" />
        ))}
      </ul>
    </section>
  );
}
