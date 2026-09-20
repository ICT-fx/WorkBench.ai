import { fill, type Dictionary, type Locale } from "@/i18n";
import { loadHistory } from "@/lib/data";
import { date, monthYear, pct } from "@/lib/format";
import type { ModelScore } from "@/lib/hub";
import { axisRange, runAverages, runDates, timePositions } from "@/lib/models";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon } from "@/components/ui/Icon";
import { serie } from "@/components/ui/LabMark";
import { StabilityChart, type StabilityPoint } from "./StabilityChart";

/**
 * L'exactitude moyenne du modèle, run après run. Un alias de modèle peut
 * changer sans prévenir : cette courbe est l'endroit où une dérive se verrait.
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
  const moyennes = runAverages(histories, score.model.id);
  const demo = hub.demo || histories.some((h) => h.runs.some((run) => run.status === "demo"));

  return (
    <section aria-labelledby="stabilite" className="mt-16">
      <h2 id="stabilite" className="etendu text-2xl">{t.title}</h2>
      <p className="mt-2 max-w-[68ch] text-sm text-encre-pale">{t.intro}</p>
      {moyennes.length < 2
        ? <p className="mt-5 border-y border-filet py-4">{t.onlyLastRun}</p>
        : <Courbe moyennes={moyennes} axe={runDates(histories)} couleur={serie(score.lab)} demo={demo} lang={lang} dict={dict} />}
    </section>
  );
}

function Courbe({ moyennes, axe, couleur, demo, lang, dict }: {
  moyennes: ReturnType<typeof runAverages>;
  /** Toutes les dates de run du hub : l'axe du temps ne bouge pas d'une fiche à l'autre. */
  axe: string[];
  couleur: string;
  demo: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.models.stability;
  const places = timePositions(axe);
  const { lo, hi, ticks } = axisRange(moyennes.map((m) => m.value));
  const surBenchmarks = (n: number) => fill(n === 1 ? t.benchmarks.one : t.benchmarks.other, { n });

  const points = moyennes.map((m): StabilityPoint => ({
    x: places[axe.indexOf(m.date)] ?? 0,
    y: (hi - m.value) / (hi - lo),
    date: date(m.date, lang, "long"),
    value: pct(m.value, lang),
    basis: fill(t.averageOver, { benchmarks: surBenchmarks(m.n) }),
    spoken: fill(t.point, { date: date(m.date, lang, "long"), value: pct(m.value, lang), benchmarks: surBenchmarks(m.n) }),
  }));

  return (
    <figure className="panneau mt-5">
      <figcaption className="barre">
        <span className="etiquette">{t.chartTitle}</span>
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
                <th scope="col" className="etiquette droite">{t.avgAccuracy}</th>
                <th scope="col" className="etiquette droite">{t.benchmarksColumn}</th>
              </tr>
            </thead>
            <tbody>
              {moyennes.map((m) => (
                <tr key={m.date}>
                  <th scope="row">{date(m.date, lang, "long")}</th>
                  <td className="chiffres droite">{pct(m.value, lang)}</td>
                  <td className="chiffres droite">{m.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
