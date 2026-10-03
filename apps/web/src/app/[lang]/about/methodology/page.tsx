import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Criterion } from "@hub/schema";
import { fill, getDictionary, href, isLocale, tr, type Dictionary } from "@/i18n";
import { loadLeaderboard, loadPrompt, loadReponses, loadScores, loadTask } from "@/lib/data";
import { documentsClivants } from "@/lib/exemples";
import { date, num } from "@/lib/format";
import { typo } from "@/lib/news";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon } from "@/components/ui/Icon";
import { AboutTabs } from "@/components/about/AboutTabs";
import { content } from "@/components/about/content";
import { Prose } from "@/components/news/Prose";

/** Le seul protocole mesuré à ce jour : c'est lui que la page documente en détail. */
const TACHE = "facture-fcc";

export async function generateMetadata({ params }: PageProps<"/[lang]/about/methodology">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).about.methodology;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { languages: { fr: "/fr/about/methodology", en: "/en/about/methodology" } },
  };
}

function comparaison(c: Criterion, t: Dictionary["about"]["methodology"]["kinds"], ecart: (n: number) => string): string {
  if (c.kind === "number" && (c.tolerance ?? 0) > 0) return fill(t.numberTolerance, { n: ecart(c.tolerance!) });
  return t[c.kind];
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`titre-${id}`} className="scroll-mt-32 lg:scroll-mt-24">
      <h2 id={`titre-${id}`} className="etendu text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export default async function PageMethodologie({ params }: PageProps<"/[lang]/about/methodology">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.about.methodology;
  const c = content[lang].methodology;
  const { benchmarks, leaderboards, pricesSyncedAt } = getHub();

  const task = loadTask(TACHE);
  const classement = loadLeaderboard(TACHE);
  const prompt = loadPrompt(TACHE, classement.runId);

  const publies = [...leaderboards.values()];
  const demos = publies.filter((lb) => lb.status === "demo").length;
  const executables = benchmarks.filter((b) => b.maturity === "pipeline");
  const avancement = {
    executables: executables.length, total: benchmarks.length,
    names: executables.map((b) => tr(b.label, lang)).join(", "),
  };

  // Le panel se compte dans le dépôt, pas de mémoire : un dossier de réponses par modèle.
  const premierDocument = documentsClivants(loadScores(classement.runId), 1)[0]?.docId;
  const panel = premierDocument === undefined || task.criteria[0] === undefined
    ? 0
    : loadReponses(classement.runId, premierDocument, task.criteria[0].id).length;

  const demo = [
    ...c.demo.body,
    ...(panel > 0 ? [fill(c.demo.panel, { panel })] : []),
    c.demo.ending,
    demos > 0 ? fill(c.demo.statusSome, { demo: demos, total: publies.length }) : c.demo.statusNone,
  ];

  const sommaire = [c.index, c.margin, c.costs, c.demo, c.maturity, c.limits, c.scoring, c.verdicts, c.prompt, c.run];

  return (
    <main className="conteneur pb-8">
      <AboutTabs locale={lang} dict={dict} current="methodology" />

      <header className="max-w-[48rem] pb-12 pt-10 sm:pt-12">
        <h1 className="etendu text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-xl text-encre-pale">{typo(t.lead, lang)}</p>
      </header>

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Même sommaire que la page des benchmarks : colonne collante sur grand écran, ruban défilant ailleurs. */}
        <nav aria-label={t.toc} className="sticky top-16 z-20 -mx-4 self-start overflow-x-auto bg-papier/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:overflow-visible lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <ul className="flex gap-1 lg:flex-col">
            {sommaire.map((s) => (
              <li key={s.id} className="flex-none">
                <a
                  href={`#${s.id}`}
                  className="block whitespace-nowrap rounded-full px-3.5 py-2 text-sm text-encre-pale no-underline transition-colors hover:bg-creux hover:text-encre lg:whitespace-normal lg:rounded-[var(--radius-m)]"
                >
                  {s.toc}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-16">
          <Section id={c.index.id} title={c.index.title}>
            <Prose body={c.index.body} locale={lang} className="mt-5" />
          </Section>

          <Section id={c.margin.id} title={c.margin.title}>
            <Prose body={c.margin.body} locale={lang} className="mt-5" />
          </Section>

          <Section id={c.costs.id} title={c.costs.title}>
            <Prose body={c.costs.body.map((l) => fill(l, { syncedAt: date(pricesSyncedAt, lang, "long") }))} locale={lang} className="mt-5" />
          </Section>

          <Section id={c.demo.id} title={c.demo.title}>
            <Prose body={demo} locale={lang} className="mt-5" />
          </Section>

          <Section id={c.maturity.id} title={c.maturity.title}>
            <Prose body={c.maturity.body.map((l) => fill(l, avancement))} locale={lang} className="mt-5" />
          </Section>

          <p className="max-w-[68ch] border-t border-filet pt-8 text-encre-pale">{typo(c.invoiceIntro, lang)}</p>

          <Section id={c.limits.id} title={c.limits.title}>
            <Prose body={c.limits.body} locale={lang} className="mt-5" />
          </Section>

          <Section id={c.scoring.id} title={c.scoring.title}>
            <Prose body={c.scoring.body} locale={lang} className="mt-5" />
            <div className="panneau mt-6 max-w-[52rem]">
              <div className="overflow-x-auto">
                <table className="tableau">
                  <caption className="sr-only">{t.scoringCaption}</caption>
                  <thead>
                    <tr>
                      <th scope="col"><span className="etiquette">{t.table.field}</span></th>
                      <th scope="col"><span className="etiquette">{t.table.comparison}</span></th>
                      <th scope="col" className="droite"><span className="etiquette">{t.table.weight}</span></th>
                      <th scope="col" className="droite"><span className="etiquette">{t.table.critical}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.criteria.map((critere) => (
                      <tr key={critere.id}>
                        <th scope="row" lang="fr">{critere.label}</th>
                        <td className="text-encre-pale">{comparaison(critere, t.kinds, (n) => num(n, lang, 2))}</td>
                        <td className="chiffres droite">{critere.weight}</td>
                        <td className={`droite ${critere.critical ? "font-semibold" : "text-encre-muette"}`}>
                          {critere.critical ? t.table.yes : t.table.no}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {lang !== "fr" && <p className="mt-3 text-sm text-encre-muette">{t.originalLabels}</p>}
            <Prose body={c.scoring.after} locale={lang} className="mt-6" />
          </Section>

          <Section id={c.verdicts.id} title={c.verdicts.title}>
            <Prose body={c.verdicts.body} locale={lang} className="mt-5" />
          </Section>

          <Section id={c.prompt.id} title={c.prompt.title}>
            <Prose body={c.prompt.body} locale={lang} className="mt-5" />
            <pre lang="fr" className="mt-6 max-w-[52rem] whitespace-pre-wrap break-words rounded-[var(--radius-m)] border border-filet bg-creux p-5 font-sans text-sm leading-relaxed">
              {prompt}
            </pre>
          </Section>

          <Section id={c.run.id} title={c.run.title}>
            <div className="panneau mt-6 max-w-[36rem]">
              <table className="tableau">
                <caption className="sr-only">{t.run.caption}</caption>
                <tbody>
                  <tr>
                    <th scope="row" className="text-encre-pale">{t.run.run}</th>
                    <td className="droite break-all">{classement.runId}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="text-encre-pale">{t.run.date}</th>
                    <td className="chiffres droite">{date(classement.runDate, lang, "long")}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="text-encre-pale">{t.run.documents}</th>
                    <td className="chiffres droite">{classement.sampleSize}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="text-encre-pale">{t.run.models}</th>
                    <td className="chiffres droite">{classement.rows.length}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="text-encre-pale">{t.run.status}</th>
                    <td className="droite">
                      <span className="inline-flex items-center gap-2">
                        {classement.status === "demo" ? t.run.demo : t.run.real}
                        <DemoTag dict={dict} show={classement.status === "demo"} />
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {leaderboards.has(TACHE) && (
              <Link href={href(lang, `/benchmarks/${TACHE}`)} className="bouton mt-6">
                {t.viewBenchmark}
                <Icon name="arrow-right" size={15} />
              </Link>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
