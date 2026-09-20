import { fill, type Dictionary, type Locale } from "@/i18n";
import { date, duration, num, pct, usd } from "@/lib/format";
import type { ModelScore } from "@/lib/hub";
import { ordinal, readsDocuments, standing } from "@/lib/models";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reglette } from "./Reglette";

/** Au-delà de ce taux moyen d'éléments inventés, le chiffre passe au rouge. */
const SEUIL_HALLUCINATIONS = 5;

function Tuile({ icon, label, value, detail, note, accent = false, children }: {
  icon: IconName;
  label: string;
  value: string;
  /** Ce qui nuance la valeur, à sa droite : la marge d'erreur. */
  detail?: { text: string; spoken: string };
  note: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`panneau flex flex-col p-4 sm:p-5 ${accent ? "bg-vert-brume" : ""}`}>
      <h3 className="etiquette flex items-center gap-1.5">
        <Icon name={icon} size={15} />
        {label}
      </h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold leading-none tracking-tight">{value}</span>
        {detail !== undefined && (
          <span className="text-sm text-encre-pale">
            <span aria-hidden>{detail.text}</span>
            <span className="sr-only">{detail.spoken}</span>
          </span>
        )}
      </p>
      <p className="mb-4 mt-2 text-sm text-encre-pale">{note}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

/** Les trois chiffres qui résument un modèle, chacun situé parmi tous les autres. */
export function Overview({ score, lang, dict }: { score: ModelScore; lang: Locale; dict: Dictionary }) {
  const { hub, benchmarks, leaderboards } = getHub();
  const t = dict.models.overview;
  const { metrics, labels } = dict.common;
  const rang = (n: number) => ordinal(n, lang, dict.models.ordinals);

  const indices = hub.scores.flatMap((s) => (s.indice === null ? [] : [s.indice]));
  const couts = hub.scores.flatMap((s) => (s.cost === null || s.cost <= 0 ? [] : [s.cost]));
  const temps = hub.scores.flatMap((s) => (s.latency === null || s.latency <= 0 ? [] : [s.latency]));
  const cout = score.cost !== null && score.cost > 0 ? score.cost : null;
  const latence = score.latency !== null && score.latency > 0 ? score.latency : null;

  const parCout = cout === null ? null : standing(couts, cout, "croissant");
  const parTemps = latence === null ? null : standing(temps, latence, "croissant");

  const publies = benchmarks.filter((b) => leaderboards.has(b.id));
  const documentsManques = publies.filter((b) => b.input === "document" && score.byBenchmark[b.id] === undefined).length;
  const aveugle = !readsDocuments(score.model.modalities) && documentsManques > 0;
  const inquietant = score.hallucinations !== null && score.hallucinations > SEUIL_HALLUCINATIONS;

  return (
    <section aria-labelledby="apercu" className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="apercu" className="etendu text-2xl">{t.title}</h2>
        <p className="flex items-center gap-3 text-sm text-encre-pale">
          {hub.updated !== "" && <span>{labels.updated} {date(hub.updated, lang, "long")}</span>}
          <DemoTag dict={dict} show={hub.demo} />
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Tuile
          accent
          icon="indice"
          label={metrics.indice}
          value={score.indice === null ? "—" : pct(score.indice, lang)}
          detail={score.ci === null ? undefined : {
            text: `±\u00a0${num(score.ci, lang)}`,
            spoken: `±\u00a0${num(score.ci, lang)} (${metrics.margin})`,
          }}
          note={score.rank === null ? labels.notRanked : fill(t.rank, { rank: score.rank, of: indices.length })}
        >
          <Reglette
            values={indices}
            current={score.indice}
            label={score.rank === null
              ? fill(t.stripUnknown, { of: indices.length })
              : fill(t.stripIndex, { ordinal: rang(score.rank), of: indices.length })}
            format={(v) => pct(v, lang)}
          />
        </Tuile>

        <Tuile
          icon="coin"
          label={t.avgCost}
          value={usd(cout, lang)}
          note={parCout === null ? t.costUnknown : fill(t.cheapest, { ordinal: rang(parCout.rank), of: parCout.of })}
        >
          <Reglette
            values={couts}
            current={cout}
            scale="log"
            label={parCout === null
              ? fill(t.stripUnknown, { of: couts.length })
              : fill(t.stripCost, { ordinal: rang(parCout.rank), of: parCout.of })}
            format={(v) => usd(v, lang)}
          />
        </Tuile>

        <Tuile
          icon="clock"
          label={metrics.latency}
          value={duration(latence, lang)}
          note={parTemps === null ? labels.notTested : fill(t.fastest, { ordinal: rang(parTemps.rank), of: parTemps.of })}
        >
          <Reglette
            values={temps}
            current={latence}
            label={parTemps === null
              ? fill(t.stripUnknown, { of: temps.length })
              : fill(t.stripLatency, { ordinal: rang(parTemps.rank), of: parTemps.of })}
            format={(v) => duration(v, lang)}
          />
        </Tuile>
      </div>

      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-2 text-sm">
        {score.hallucinations !== null && (
          <div className="flex items-center gap-2">
            <dt className="text-encre-pale">{t.avgHallucinations}</dt>
            <dd className={`flex items-center gap-1.5 font-semibold ${inquietant ? "text-rouge" : ""}`}>
              {inquietant && <Icon name="warning" size={16} />}
              {pct(score.hallucinations, lang)}
            </dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <dt className="text-encre-pale">{t.benchmarksTaken}</dt>
          <dd className="font-semibold">{score.benchmarksTaken}&nbsp;/&nbsp;{publies.length}</dd>
        </div>
        {aveugle && (
          <div className="flex items-center gap-2">
            <dt className="text-encre-pale">{labels.textOnly}</dt>
            <dd className="font-semibold">
              {fill(documentsManques === 1 ? t.untested.one : t.untested.other, { n: documentsManques })}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
