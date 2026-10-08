import { fill, tr, type Dictionary, type Locale } from "@/i18n";
import { loadHistory } from "@/lib/data";
import { date, monthYear, pct } from "@/lib/format";
import type { ModelScore } from "@/lib/hub";
import { axisRange, runsByBenchmark, timePositions, type BenchmarkRuns } from "@/lib/models";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon } from "@/components/ui/Icon";
import { serie } from "@/components/ui/LabMark";
import { StabilityChart, type StabilityPoint } from "./StabilityChart";

/**
 * L'exactitude du modèle, run après run, benchmark par benchmark. Un alias de
 * modèle peut changer sans prévenir : ces courbes sont l'endroit où une dérive se
 * verrait. Chaque benchmark a la sienne — une courbe commune ferait passer un
 * changement de tâche pour un changement de modèle.
 */
export function Stability({ score, lang, dict }: { score: ModelScore; lang: Locale; dict: Dictionary }) {
  // Un modèle jamais testé n'a pas d'histoire à raconter.
  if (score.benchmarksTaken === 0) return null;

  const { hub, benchmarks } = getHub();
  const t = dict.models.stability;
  const histories = benchmarks.flatMap((b) => {
    const history = loadHistory(b.id);
    return history === null ? [] : [history];
  });
  const nom = (id: string): string => {
    const b = benchmarks.find((x) => x.id === id);
    return b === undefined ? id : tr(b.label, lang);
  };
  const series = runsByBenchmark(histories, score.model.id);
  // Une courbe demande au moins deux runs du même benchmark.
  const suivies = series.filter((s) => s.points.length >= 2);
  const uniques = series.filter((s) => s.points.length === 1);
  const demo = hub.demo || histories.some((h) => h.runs.some((run) => run.status === "demo"));

  return (
    <section aria-labelledby="stabilite" className="mt-16">
      <h2 id="stabilite" className="etendu text-2xl">{t.title}</h2>
      <p className="mt-2 max-w-[68ch] text-sm text-encre-pale">{t.intro}</p>
      {suivies.length === 0 && <p className="mt-5 border-y border-filet py-4">{t.onlyLastRun}</p>}
      {suivies.map((s) => (
        <Courbe key={s.benchmarkId} serie={s} titre={nom(s.benchmarkId)} couleur={serie(score.lab)} demo={demo} lang={lang} dict={dict} />
      ))}
      {suivies.length > 0 && uniques.length > 0 && (
        <p className="mt-4 max-w-[68ch] text-sm text-encre-pale">
          {fill(t.singleRun, { benchmarks: uniques.map((s) => nom(s.benchmarkId)).join(", ") })}
        </p>
      )}
    </section>
  );
}

function Courbe({ serie: runs, titre, couleur, demo, lang, dict }: {
  serie: BenchmarkRuns;
  /** Le nom du benchmark : une courbe ne porte que sur lui. */
  titre: string;
  couleur: string;
  demo: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.models.stability;
  const axe = runs.points.map((p) => p.date);
  const places = timePositions(axe);
  const { lo, hi, ticks } = axisRange(runs.points.map((p) => p.value));

  const points = runs.points.map((p, i): StabilityPoint => ({
    x: places[i] ?? 0,
    y: (hi - p.value) / (hi - lo),
    date: date(p.date, lang, "long"),
    value: pct(p.value, lang),
    basis: titre,
    spoken: fill(t.point, { date: date(p.date, lang, "long"), value: pct(p.value, lang), benchmark: titre }),
  }));

  return (
    <figure className="panneau mt-5">
      <figcaption className="barre">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-medium">{titre}</span>
          <span className="etiquette">{t.chartTitle}</span>
        </p>
        <DemoTag dict={dict} show={demo} />
      </figcaption>

      <StabilityChart
        points={points}
        yTicks={ticks.map((tick) => ({ at: (hi - tick) / (hi - lo), label: pct(tick, lang, 0) }))}
        xTicks={axe.map((d, i) => ({ at: places[i] ?? 0, label: monthYear(d, lang) }))}
        color={couleur}
        step={1 / Math.max(1, axe.length - 1)}
      />

      <p className="border-t border-filet px-4 py-3 text-xs text-encre-pale sm:px-5">{t.caption}</p>

      {/* Le jumeau du graphique : les mêmes valeurs, lisibles sans survol ni souris. */}
      <details className="group border-t border-filet">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ease-sortie hover:bg-vert-brume sm:px-5 [&::-webkit-details-marker]:hidden">
          <Icon name="chevron-down" size={16} className="text-encre-pale transition-transform duration-200 ease-sortie group-open:rotate-180" />
          {t.showTable}
        </summary>
        <div className="overflow-x-auto border-t border-filet">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col" className="etiquette">{t.run}</th>
                <th scope="col" className="etiquette droite">{t.accuracy}</th>
              </tr>
            </thead>
            <tbody>
              {runs.points.map((p) => (
                <tr key={p.date}>
                  <th scope="row">{date(p.date, lang, "long")}</th>
                  <td className="chiffres droite">{pct(p.value, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
