import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fill, getDictionary, href, isLocale, tr } from "@/i18n";
import { getHub } from "@/lib/site";
import {
  documentImages, hasTask, loadCases, loadGroundTruth, loadHistory, loadReponses, loadTask,
} from "@/lib/data";
import { stateOfTheArt } from "@/lib/hub";
import { takeaways } from "@/lib/takeaways";
import { date, pct } from "@/lib/format";
import { labView, modelHref, scatterPoints } from "@/lib/views";
import { Icon, hasIcon } from "@/components/ui/Icon";
import { LabMark, serie } from "@/components/ui/LabMark";
import { DemoTag } from "@/components/ui/DemoTag";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ValeurBrute } from "@/components/Chiffre";
import { Recommandations } from "@/components/Recommandations";
import { NuageCout } from "@/components/charts/NuageCout";
import { LigneRuns } from "@/components/charts/LigneRuns";
import { LeaderboardTable, type TableRow } from "@/components/benchmarks/LeaderboardTable";

export function generateStaticParams() {
  const { benchmarks, leaderboards } = getHub();
  return benchmarks.filter((b) => leaderboards.has(b.id)).map((b) => ({ id: b.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/benchmarks/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const b = getHub().benchmarks.find((x) => x.id === id);
  if (!isLocale(lang) || b === undefined) return {};
  return { title: tr(b.label, lang), description: tr(b.question, lang) };
}

/**
 * L'ordre dans lequel les pièges se racontent le mieux : d'abord celui qui met
 * une hallucination sous les yeux, puis ceux où un modèle peut lire le bon
 * chiffre au mauvais endroit, puis les difficultés de lecture pure.
 */
const PIEGES_MONTRES = [
  "franchise_293b", "acompte", "avoir", "multi_tva",
  "remise_pied", "scan_degrade", "autoliquidation", "devise_etrangere", "deux_pages",
];

/** Le champ dont la réponse est la plus parlante pour chaque piège. */
const CHAMP_MONTRE: Record<string, string> = {
  franchise_293b: "total_tva",
  autoliquidation: "total_tva",
  acompte: "total_ttc",
  multi_tva: "total_tva",
  remise_pied: "total_ht",
  avoir: "total_ttc",
  devise_etrangere: "total_ht",
  scan_degrade: "siret_emetteur",
  deux_pages: "total_ttc",
};

export default async function PageBenchmark({ params }: PageProps<"/[lang]/benchmarks/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const site = getHub();
  const benchmark = site.benchmarks.find((b) => b.id === id);
  const leaderboard = site.leaderboards.get(id);
  if (benchmark === undefined || leaderboard === undefined) notFound();

  const dict = getDictionary(lang);
  const t = dict.benchmarks.detail;
  const domaine = site.domains.find((d) => d.id === benchmark.domain)!;
  const unit = tr(benchmark.unit, lang);
  const demo = leaderboard.status === "demo";
  const scoreById = new Map(site.hub.scores.map((s) => [s.model.id, s]));
  const names = new Map(site.models.map((m) => [m.id, m.name]));
  const classees = [...leaderboard.rows].sort((a, b) => b.exactitude - a.exactitude);

  const lignes: TableRow[] = classees.flatMap((row) => {
    const s = scoreById.get(row.model);
    if (s === undefined) return [];
    return [{
      id: row.model, name: s.model.name, href: modelHref(lang, row.model), lab: labView(s.lab),
      weights: s.model.weights, exactitude: row.exactitude, ci: row.ci, sansRelecture: row.sansRelecture,
      hallucinations: row.hallucinations, cost: row.costPerDoc, priceIn: s.model.priceIn, priceOut: s.model.priceOut,
      latency: row.latencyP50, errorCount: row.errorCount, bySubtask: row.bySubtask ?? {},
    }];
  });

  const ecartes = benchmark.input === "document"
    ? site.models.filter((m) => !m.modalities.includes("image") && !m.modalities.includes("pdf")).length
    : 0;
  const phrases = takeaways({ benchmark, leaderboard, names, excluded: ecartes, locale: lang, dict });

  // Le meilleur de chaque sous-tâche, de la mieux maîtrisée à la plus dure.
  const meneurs = benchmark.subtasks.flatMap((s) => {
    const best = classees
      .filter((r) => r.bySubtask?.[s.id] !== undefined)
      .sort((a, b) => b.bySubtask![s.id]! - a.bySubtask![s.id]!)[0];
    const score = best === undefined ? undefined : scoreById.get(best.model);
    return best === undefined || score === undefined
      ? []
      : [{ id: s.id, label: tr(s.label, lang), value: best.bySubtask![s.id]!, score }];
  }).sort((a, b) => b.value - a.value);

  const history = loadHistory(id);
  const runs = history === null ? [] : stateOfTheArt(history).map((p, i) => ({
    date: p.date, value: p.value,
    note: fill(t.historyModels, { n: history.runs[i]?.rows.length ?? 0 }),
  }));

  const freres = site.benchmarks.filter((b) => b.domain === benchmark.domain && b.id !== id && site.leaderboards.has(b.id));
  const avecPieges = hasTask(id);

  return (
    <main className="conteneur pb-8 pt-10">
      <nav aria-label={t.breadcrumb} className="flex flex-wrap items-center gap-2 text-sm text-encre-pale">
        <Link href={href(lang, "/benchmarks")} className="no-underline hover:underline">{t.breadcrumb}</Link>
        <Icon name="chevron-right" size={14} />
        <Link href={`${href(lang, "/benchmarks")}#${domaine.id}`} className="flex items-center gap-1.5 no-underline hover:underline">
          <Icon name={hasIcon(domaine.icon) ? domaine.icon : "indice"} size={15} />
          {tr(domaine.label, lang)}
        </Link>
      </nav>

      <header className="mt-8 max-w-[52rem]">
        <p className="flex flex-wrap items-center gap-2">
          <span className="pastille">{benchmark.maturity === "pipeline" ? dict.common.labels.pipeline : dict.common.labels.draft}</span>
          <span className="pastille">
            <Icon name={benchmark.input === "document" ? "document" : "text"} size={12} />
            {benchmark.input === "document" ? dict.benchmarks.list.onDocuments : dict.benchmarks.list.onText}
          </span>
          <DemoTag dict={dict} show={demo} />
        </p>
        <h1 className="etendu mt-4 text-4xl sm:text-5xl">{tr(benchmark.label, lang)}</h1>
        <p className="mt-5 text-xl text-encre-pale">{tr(benchmark.question, lang)}</p>
        <p className="chiffres mt-4 text-sm text-encre-muette">
          {dict.common.labels.updated} {date(leaderboard.runDate, lang, "long")} ·{" "}
          {fill(t.runLine, { run: leaderboard.runId, n: leaderboard.rows.length, sample: leaderboard.sampleSize, unit })}
        </p>
      </header>

      <section className="panneau mt-10">
        <div className="barre">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-medium">{tr(benchmark.label, lang)}</span>
            <span className="text-sm text-encre-pale">{dict.common.metrics.accuracy} × {dict.common.metrics.cost.toLowerCase()}</span>
          </p>
          <DemoTag dict={dict} show={demo} />
        </div>
        <NuageCout points={scatterPoints(site, leaderboard, lang)} unit={unit} />
      </section>

      {phrases.length > 0 && (
        <section className="mt-16 max-w-[52rem]">
          <h2 className="etendu text-2xl">{t.takeaways}</h2>
          <div className="prose-hub mt-5">
            <ul>{phrases.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        </section>
      )}

      <section className="mt-16">
        <h2 className="etendu text-2xl">{t.choose}</h2>
        <div className="mt-6">
          <Recommandations rows={leaderboard.rows} names={names} unit={unit} locale={lang} dict={dict} />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="etendu text-2xl">{t.leaderboard}</h2>
        <p className="mt-2 max-w-[64ch] text-encre-pale">{t.leaderboardLead}</p>
        <div className="mt-6">
          <LeaderboardTable
            rows={lignes}
            subtasks={benchmark.subtasks.map((s) => ({ id: s.id, label: tr(s.label, lang) }))}
            title={tr(benchmark.label, lang)}
            subtitle={tr(domaine.label, lang)}
            unit={unit}
            demo={demo}
          />
        </div>
      </section>

      <div className="mt-16 grid gap-x-16 gap-y-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <section>
          <h2 className="etendu text-2xl">{t.about}</h2>
          <p className="mt-5 max-w-[64ch]">{tr(benchmark.description, lang)}</p>
          <dl className="chiffres mt-8 max-w-xl border-t border-filet text-sm">
            {[
              [t.facts.sample, `${leaderboard.sampleSize} ${unit}s`],
              [t.facts.input, benchmark.input === "document" ? t.facts.inputDocument : t.facts.inputText],
              [t.facts.tested, String(leaderboard.rows.length)],
              [t.facts.maturity, benchmark.maturity === "pipeline" ? dict.common.labels.pipeline : dict.common.labels.draft],
              [t.facts.status, demo ? t.facts.statusDemo : t.facts.statusReal],
              [t.facts.run, leaderboard.runId],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-b border-filet py-2.5">
                <dt className="text-encre-pale">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {meneurs.length > 0 && (
          <section>
            <h2 className="etendu text-2xl">{t.subtasks}</h2>
            <p className="mt-2 text-encre-pale">{t.subtasksLead}</p>
            <ul className="panneau mt-6 divide-y divide-filet">
              {meneurs.map((m) => (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="chiffres text-sm font-semibold">{pct(m.value, lang)}</span>
                  <span className="col-span-2"><ScoreBar value={m.value} color={serie(m.score.lab)} /></span>
                  <Link href={modelHref(lang, m.score.model.id)} className="col-span-2 flex items-center gap-2 text-sm text-encre-pale no-underline hover:text-encre hover:underline">
                    <LabMark lab={m.score.lab} size={16} />
                    {m.score.model.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {runs.length >= 2 && (
        <section className="mt-16">
          <h2 className="etendu text-2xl">{t.history}</h2>
          <p className="mt-2 max-w-[64ch] text-encre-pale">{t.historyLead}</p>
          <div className="panneau mt-6 max-w-[54rem]">
            <div className="barre">
              <span className="etiquette">{dict.common.metrics.accuracy}</span>
              <DemoTag dict={dict} show={demo} />
            </div>
            <LigneRuns points={runs} locale={lang} label={t.history} />
          </div>
        </section>
      )}

      {avecPieges && <CasPieges taskId={id} runId={leaderboard.runId} lang={lang} names={names} />}

      <p className="mt-16 max-w-[64ch]">
        <Link href={href(lang, "/about/methodology")} className="text-vert underline">{t.methodology}</Link> {t.methodologyTail}
      </p>

      {freres.length > 0 && (
        <nav aria-label={t.siblings} className="mt-16 border-t border-filet pt-8">
          <h2 className="etiquette">{t.siblings}</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {freres.map((b) => (
              <li key={b.id}>
                <Link href={href(lang, `/benchmarks/${b.id}`)} className="bouton">
                  {tr(b.label, lang)}
                  <Icon name="arrow-right" size={15} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}

/**
 * Les réponses brutes sur les documents pièges. Réservé aux benchmarks dotés
 * d'une tâche exécutable : c'est la seule source de réponses brutes.
 */
function CasPieges({ taskId, runId, lang, names }: {
  taskId: string; runId: string; lang: "fr" | "en"; names: Map<string, string>;
}) {
  const dict = getDictionary(lang);
  const t = dict.benchmarks.detail;
  const task = loadTask(taskId);
  const labels = Object.fromEntries(task.criteria.map((c) => [c.id, c.label]));

  // Un document par piège, jamais deux fois le même : trois exemples du même
  // cas donneraient l'impression d'un jeu de test pauvre.
  const parPiege = new Map<string, ReturnType<typeof loadCases>[number]>();
  for (const cas of loadCases(taskId)) {
    const piege = cas.traps[0]?.id;
    if (piege !== undefined && !parPiege.has(piege)) parPiege.set(piege, cas);
  }
  const cases = PIEGES_MONTRES.map((p) => parPiege.get(p)).filter((c) => c !== undefined).slice(0, 4);
  if (cases.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="etendu text-2xl">{t.traps}</h2>
      <p className="mt-2 max-w-[64ch] text-encre-pale">{t.trapsLead}</p>

      <div className="mt-8 space-y-10">
        {cases.map((cas) => {
          const piege = cas.traps[0]!;
          const champ = CHAMP_MONTRE[piege.id] ?? "total_ttc";
          const attendu = loadGroundTruth(taskId, cas.docId).fields[champ] ?? null;
          const reponses = loadReponses(runId, cas.docId, champ);
          const image = documentImages(taskId, cas.docId)[0];

          return (
            <article key={cas.docId} className="panneau">
              <div className="barre">
                <h3 className="max-w-[60ch] font-medium">{piege.label}</h3>
                <span className="chiffres text-xs text-encre-pale">
                  {fill(t.trapDoc, { doc: cas.docId, field: labels[champ] ?? champ })}
                </span>
              </div>
              <div className="grid gap-8 p-5 sm:p-7 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:items-start">
                {image !== undefined && (
                  <figure className="overflow-hidden rounded-[var(--radius-m)] border border-filet">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={fill(t.invoiceAlt, { doc: cas.docId })} className="w-full" loading="lazy" />
                  </figure>
                )}
                <dl className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-filet-fort pb-2.5">
                    <dt className="font-semibold">{t.rightAnswer}</dt>
                    <dd className="chiffres font-semibold text-vert">
                      {attendu === null ? t.nothingToFind : <ValeurBrute valeur={attendu} abstention={t.abstains} />}
                    </dd>
                  </div>
                  {reponses.map((r) => {
                    const invente = attendu === null && !r.enEchec && r.valeur !== null;
                    return (
                      <div key={r.model} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-filet py-2.5">
                        <dt>{names.get(r.model) ?? r.model}</dt>
                        <dd className={invente ? "font-semibold text-rouge" : undefined}>
                          {r.enEchec ? t.callFailed : <ValeurBrute valeur={r.valeur} abstention={t.abstains} />}
                          {invente && ` — ${t.invented}`}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
