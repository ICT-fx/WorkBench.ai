import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Criterion } from "@hub/schema";
import { fill, getDictionary, href, isLocale, tr, type Dictionary } from "@/i18n";
import { hasTask, loadLeaderboard, loadPrompt, loadQuestionsPosees, loadReponses, loadScores, loadTask } from "@/lib/data";
import { documentsClivants } from "@/lib/exemples";
import { date, num } from "@/lib/format";
import { typo } from "@/lib/news";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, hasIcon } from "@/components/ui/Icon";
import { AboutTabs } from "@/components/about/AboutTabs";
import { content } from "@/components/about/content";
import { Prose } from "@/components/news/Prose";

type Tache = keyof (typeof content)["fr"]["methodology"]["protocoles"];

/**
 * L'ancre d'une section de protocole. Celles des factures gardent leur forme
 * d'origine, parce que des liens y renvoient peut-être ; les autres portent le
 * nom de leur benchmark, pour qu'aucune ancre ne soit en double.
 */
const idSection = (id: string, tache: Tache): string => (tache === "facture-fcc" ? id : `${id}-${tache}`);

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

function comparaison(
  c: Criterion, t: Dictionary["about"]["methodology"]["kinds"], ecart: (n: number) => string, pourcent: (n: number) => string,
): string {
  if (c.kind === "number" && c.toleranceRelative !== undefined) return fill(t.numberRelative, { n: pourcent(c.toleranceRelative * 100) });
  if (c.kind === "number" && (c.tolerance ?? 0) > 0) return fill(t.numberTolerance, { n: ecart(c.tolerance!) });
  return t[c.kind];
}

function Section({ id, title, eyebrow, children }: {
  id: string; title: string; eyebrow?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`titre-${id}`} className="scroll-mt-32 lg:scroll-mt-24">
      {/* Qui arrive par une ancre du sommaire tombe au milieu de la page : la
          section dit elle-même de quel benchmark elle parle. */}
      {eyebrow !== undefined && <p className="etiquette text-vert">{eyebrow}</p>}
      <h2 id={`titre-${id}`} className={`etendu text-2xl${eyebrow === undefined ? "" : " mt-1"}`}>{title}</h2>
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
  const { benchmarks, domains, leaderboards, pricesSyncedAt } = getHub();

  // Un protocole par benchmark mesuré : une tâche à venir n'a pas de section ici.
  const taches = (Object.keys(c.protocoles) as Tache[]).filter((id) => leaderboards.has(id) && hasTask(id));
  const protocoles = taches.map((tache) => {
    const benchmark = benchmarks.find((b) => b.id === tache);
    const classement = loadLeaderboard(tache);
    return {
      tache,
      p: c.protocoles[tache],
      nom: benchmark === undefined ? tache : tr(benchmark.label, lang),
      icone: domains.find((d) => d.id === benchmark?.domain)?.icon,
      task: loadTask(tache),
      classement,
      prompt: loadPrompt(tache, classement.runId),
      surQuestions: loadQuestionsPosees(tache).length > 0,
    };
  });

  const publies = [...leaderboards.values()];
  const demos = publies.filter((lb) => lb.status === "demo").length;
  const executables = benchmarks.filter((b) => b.maturity === "pipeline");
  const avancement = {
    executables: executables.length, total: benchmarks.length,
    names: executables.map((b) => tr(b.label, lang)).join(", "),
  };

  // Le panel se compte dans le dépôt, pas de mémoire : un dossier de réponses par modèle.
  const premier = protocoles[0];
  const premierDocument = premier === undefined ? undefined : documentsClivants(loadScores(premier.classement.runId), 1)[0]?.docId;
  const premierCritere = premier?.task.criteria[0];
  const panel = premier === undefined || premierDocument === undefined || premierCritere === undefined
    ? 0
    : loadReponses(premier.classement.runId, premierDocument, premierCritere.id).length;

  const demo = [
    ...c.demo.body,
    ...(panel > 0 ? [fill(c.demo.panel, { panel })] : []),
    c.demo.ending,
    demos > 0 ? fill(c.demo.statusSome, { demo: demos, total: publies.length }) : c.demo.statusNone,
  ];

  // Le sommaire sépare ce qui vaut pour tout le hub de ce qui n'appartient
  // qu'à un benchmark : lu à plat, le barème d'une tâche passait pour une règle
  // générale. Chaque benchmark mesuré y a son propre groupe.
  const groupes = [
    { label: t.tocHub, items: [c.index, c.margin, c.costs, c.demo, c.maturity] },
    ...protocoles.map(({ tache, p, nom }) => ({
      label: fill(t.tocTask, { benchmark: nom }),
      items: [p.limits, p.scoring, p.verdicts, p.prompt, p.run].map((s) => ({ ...s, id: idSection(s.id, tache) })),
    })),
  ];

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
          <div className="flex gap-1 lg:flex-col">
            {groupes.map((g) => (
              <div key={g.label} className="flex flex-none items-center gap-1 lg:mt-5 lg:flex-col lg:items-stretch lg:gap-0 lg:first:mt-0">
                <p className="etiquette flex-none whitespace-nowrap px-3.5 py-2 text-encre-muette lg:whitespace-normal">{g.label}</p>
                <ul className="flex gap-1 lg:flex-col">
                  {g.items.map((s) => (
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
              </div>
            ))}
          </div>
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

          <section id="protocole-par-benchmark" aria-labelledby="titre-protocole-par-benchmark" className="scroll-mt-32 lg:scroll-mt-24">
            <p className="etiquette text-vert">{c.taskPart.eyebrow}</p>
            <h2 id="titre-protocole-par-benchmark" className="etendu mt-1 text-2xl">{c.taskPart.title}</h2>
            <Prose body={c.taskPart.body} locale={lang} className="mt-5" />
          </section>

          {protocoles.map(({ tache, p, nom, icone, task, classement, prompt, surQuestions }) => (
            <div key={tache} className="space-y-16">
              <section id={idSection("protocole", tache)} aria-labelledby={`titre-protocole-${tache}`} className="scroll-mt-32 lg:scroll-mt-24">
                <div className="panneau border-l-4 border-l-vert p-5 sm:p-7">
                  <p className="etiquette flex items-center gap-2 text-vert">
                    {icone !== undefined && hasIcon(icone) && <Icon name={icone} size={16} />}
                    {nom}
                  </p>
                  <h2 id={`titre-protocole-${tache}`} className="etendu mt-3 text-2xl">
                    {fill(p.title, { benchmark: nom })}
                  </h2>
                  <Prose body={p.intro} locale={lang} className="mt-4" />
                  <Link href={href(lang, `/benchmarks/${tache}`)} className="bouton mt-6">
                    {t.viewBenchmark}
                    <Icon name="arrow-right" size={15} />
                  </Link>
                </div>
              </section>

              <Section id={idSection(p.limits.id, tache)} title={p.limits.title} eyebrow={nom}>
                <Prose body={p.limits.body} locale={lang} className="mt-5" />
              </Section>

              <Section id={idSection(p.scoring.id, tache)} title={p.scoring.title} eyebrow={nom}>
                <Prose body={p.scoring.body} locale={lang} className="mt-5" />
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
                            <td className="text-encre-pale">{comparaison(critere, t.kinds, (n) => num(n, lang, 2), (n) => num(n, lang, 1))}</td>
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
                <Prose body={p.scoring.after} locale={lang} className="mt-6" />
              </Section>

              <Section id={idSection(p.verdicts.id, tache)} title={p.verdicts.title} eyebrow={nom}>
                <Prose body={p.verdicts.body} locale={lang} className="mt-5" />
              </Section>

              <Section id={idSection(p.prompt.id, tache)} title={p.prompt.title} eyebrow={nom}>
                <Prose body={p.prompt.body} locale={lang} className="mt-5" />
                <pre lang={surQuestions ? "en" : "fr"} className="mt-6 max-w-[52rem] whitespace-pre-wrap break-words rounded-[var(--radius-m)] border border-filet bg-creux p-5 font-sans text-sm leading-relaxed">
                  {prompt}
                </pre>
              </Section>

              <Section id={idSection(p.run.id, tache)} title={p.run.title} eyebrow={nom}>
                {p.run.body.length > 0 && <Prose body={p.run.body} locale={lang} className="mt-5" />}
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
                        <th scope="row" className="text-encre-pale">{surQuestions ? t.run.questions : t.run.documents}</th>
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
                <Link href={href(lang, `/benchmarks/${tache}`)} className="bouton mt-6">
                  {t.viewBenchmark}
                  <Icon name="arrow-right" size={15} />
                </Link>
              </Section>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
