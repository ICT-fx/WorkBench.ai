"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { date, monthYear, pct } from "@/lib/format";
import { DemoTag } from "@/components/ui/DemoTag";
import { useMeasure } from "./useMeasure";
import { linear, niceTicks, percentDomain } from "./scales";

export type TimeSerie = {
  id: string;
  label: string;
  /** Une variable CSS de la palette des séries. */
  color: string;
  points: { date: string; value: number; modelName: string }[];
};

export type TimeMode = { id: string; label: string; series: TimeSerie[] };

const jour = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** Le premier de chaque mois entre deux dates : les graduations de l'axe du temps. */
function debutsDeMois(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/**
 * La frontière de chaque groupe dans le temps : une marche à chaque sortie qui
 * bat le record du groupe. Des marches et non des pentes — entre deux sorties,
 * le meilleur modèle disponible ne change pas.
 */
export function CourbesTemps({ modes, end, demo }: { modes: TimeMode[]; end: string; demo: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.home.time;
  const [ref, largeur] = useMeasure<HTMLDivElement>();
  const [modeId, setModeId] = useState(modes[0]?.id ?? "");
  const [groupe, setGroupe] = useState<string | null>(null);
  const [point, setPoint] = useState<{ serie: string; i: number } | null>(null);

  const mode = modes.find((m) => m.id === modeId) ?? modes[0];
  const series = useMemo(() => (mode?.series ?? []).filter((s) => s.points.length > 0), [mode]);
  const etroit = largeur > 0 && largeur < 720;
  const hauteur = etroit ? 340 : 440;

  const geo = useMemo(() => {
    const tous = series.flatMap((s) => s.points);
    if (tous.length === 0 || largeur === 0) return null;
    const debut = tous.map((p) => p.date).sort()[0]!;
    const [x0, x1] = [46, largeur - (etroit ? 18 : 150)];
    const [y0, y1] = [hauteur - 40, 24];
    const [vMin, vMax] = percentDomain(tous.map((p) => p.value));
    const mois = debutsDeMois(debut, end);
    const pas = Math.ceil(mois.length / (etroit ? 4 : 10));
    return {
      x0, x1, y0, y1,
      x: (iso: string) => linear(jour(debut) - 8, jour(end), x0, x1)(jour(iso)),
      y: linear(vMin, vMax, y0, y1),
      ticksY: niceTicks(vMin, vMax, 5),
      ticksX: mois.filter((_, i) => i % pas === 0),
    };
  }, [series, largeur, hauteur, etroit, end]);

  // Étiquettes directes en bout de ligne : seulement celles qui ne se marchent pas dessus.
  const etiquettes = useMemo(() => {
    if (geo === null || etroit) return [];
    const places: { id: string; label: string; y: number }[] = [];
    // Dans l'ordre reçu : les séries principales d'abord, qui prennent donc la place disponible.
    for (const s of series) {
      const y = geo.y(s.points.at(-1)!.value);
      if (places.every((p) => Math.abs(p.y - y) >= 15)) places.push({ id: s.id, label: s.label, y });
    }
    return places;
  }, [series, geo, etroit]);

  const survole = point === null ? undefined : series.find((s) => s.id === point.serie);
  const pointSurvole = survole?.points[point?.i ?? 0];

  return (
    <section className="panneau" aria-label={t.title}>
      <div className="barre">
        <div className="segment" role="group" aria-label={t.groupBy}>
          {modes.map((m) => (
            <button key={m.id} type="button" aria-pressed={m.id === mode?.id} onClick={() => { setModeId(m.id); setGroupe(null); }}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2.5 text-xs text-encre-pale">
          <DemoTag dict={dict} show={demo} />
          <span className="etiquette">{dict.common.metrics.indice}</span>
          <span aria-hidden>·</span>
          <span className="chiffres">{date(end, locale)}</span>
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 border-b border-filet px-5 py-3" aria-label={dict.common.labels.legend}>
        {series.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-encre-pale transition-opacity hover:text-encre"
              style={{ opacity: groupe === null || groupe === s.id ? 1 : 0.4 }}
              onMouseEnter={() => { setGroupe(s.id); }}
              onMouseLeave={() => { setGroupe(null); }}
              onFocus={() => { setGroupe(s.id); }}
              onBlur={() => { setGroupe(null); }}
            >
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          </li>
        ))}
      </ul>

      <div ref={ref} className="trame relative" style={{ height: hauteur }}>
        {geo !== null && (
          <svg width={largeur} height={hauteur} role="img" aria-label={t.chartLabel}>
            {geo.ticksY.map((v) => (
              <g key={v}>
                <line x1={geo.x0} x2={geo.x1} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--color-filet)" />
                <text x={geo.x0 - 8} y={geo.y(v) + 4} textAnchor="end" fontSize={11} className="chiffres" fill="var(--color-encre-muette)">
                  {pct(v, locale, 0)}
                </text>
              </g>
            ))}
            {geo.ticksX.map((iso) => (
              <text key={iso} x={geo.x(iso)} y={geo.y0 + 20} textAnchor="middle" fontSize={11} fill="var(--color-encre-muette)" className="uppercase">
                {monthYear(iso, locale)}
              </text>
            ))}
            <line x1={geo.x0} x2={geo.x1} y1={geo.y0} y2={geo.y0} stroke="var(--color-filet-fort)" />

            {series.map((s) => {
              const estompe = groupe !== null && groupe !== s.id;
              const d = s.points
                .map((p, i) => (i === 0 ? `M${geo.x(p.date)},${geo.y(p.value)}` : `H${geo.x(p.date)}V${geo.y(p.value)}`))
                .join("") + `H${geo.x1}`;
              return (
                <g key={s.id} style={{ opacity: estompe ? 0.15 : 1, transition: "opacity 160ms" }}>
                  <path d={d} fill="none" stroke={s.color} strokeWidth={groupe === s.id ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
                  {s.points.map((p, i) => (
                    <g
                      key={p.date + p.modelName}
                      tabIndex={0}
                      role="img"
                      aria-label={`${s.label} — ${p.modelName}, ${date(p.date, locale)} : ${pct(p.value, locale)}`}
                      onMouseEnter={() => { setPoint({ serie: s.id, i }); setGroupe(s.id); }}
                      onMouseLeave={() => { setPoint(null); setGroupe(null); }}
                      onFocus={() => { setPoint({ serie: s.id, i }); setGroupe(s.id); }}
                      onBlur={() => { setPoint(null); setGroupe(null); }}
                    >
                      <circle cx={geo.x(p.date)} cy={geo.y(p.value)} r={13} fill="transparent" />
                      <circle cx={geo.x(p.date)} cy={geo.y(p.value)} r={4.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
                    </g>
                  ))}
                </g>
              );
            })}

            {etiquettes.map((e) => (
              <text key={e.id} x={geo.x1 + 8} y={e.y + 4} fontSize={12} fill="var(--color-encre)" style={{ opacity: groupe !== null && groupe !== e.id ? 0.3 : 1 }}>
                {e.label}
              </text>
            ))}
          </svg>
        )}

        {geo !== null && survole !== undefined && pointSurvole !== undefined && (
          <div
            className="infobulle"
            style={{
              left: Math.min(Math.max(geo.x(pointSurvole.date) - 90, 8), largeur - 200),
              top: geo.y(pointSurvole.value) > 130 ? geo.y(pointSurvole.value) - 92 : geo.y(pointSurvole.value) + 18,
            }}
          >
            <p className="chiffres text-base font-semibold">{pct(pointSurvole.value, locale)}</p>
            <p className="font-medium">{pointSurvole.modelName}</p>
            <p className="flex items-center gap-1.5 text-encre-pale">
              <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: survole.color }} />
              {survole.label} · {date(pointSurvole.date, locale)}
            </p>
          </div>
        )}
      </div>

      <p className="border-t border-filet px-5 py-2.5 text-xs text-encre-pale">{t.note}</p>
    </section>
  );
}
