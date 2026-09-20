import type { Locale } from "@/i18n";
import { monthYear, pct } from "@/lib/format";
import { linear, niceTicks, percentDomain } from "./scales";

export type RunPoint = { date: string; value: number; note: string };

const [L, H] = [720, 260];
const M = { haut: 34, droite: 36, bas: 52, gauche: 46 };

/**
 * Le meilleur score connu à chaque run. Six points au plus : chacun porte sa
 * valeur en clair, ce qui dispense d'infobulle et garde le graphique statique.
 */
export function LigneRuns({ points, locale, label }: { points: RunPoint[]; locale: Locale; label: string }) {
  if (points.length < 2) return null;
  const [vMin, vMax] = percentDomain(points.map((p) => p.value), 8);
  const x = linear(0, points.length - 1, M.gauche + 24, L - M.droite - 24);
  const y = linear(vMin, vMax, H - M.bas, M.haut);

  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="trame block h-auto w-full" role="img" aria-label={label}>
      {niceTicks(vMin, vMax, 4).map((v) => (
        <g key={v}>
          <line x1={M.gauche} x2={L - M.droite} y1={y(v)} y2={y(v)} stroke="var(--color-filet)" />
          <text x={M.gauche - 8} y={y(v) + 4} textAnchor="end" fontSize={11} className="chiffres" fill="var(--color-encre-muette)">
            {pct(v, locale, 0)}
          </text>
        </g>
      ))}
      <line x1={M.gauche} x2={L - M.droite} y1={H - M.bas} y2={H - M.bas} stroke="var(--color-filet-fort)" />
      <polyline
        points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
        fill="none" stroke="var(--color-vert)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.value)} r={4.5} fill="var(--color-vert)" stroke="var(--color-surface)" strokeWidth={2} />
          <text x={x(i)} y={y(p.value) - 12} textAnchor="middle" fontSize={12} fontWeight={600} className="chiffres" fill="var(--color-encre)">
            {pct(p.value, locale)}
          </text>
          <text x={x(i)} y={H - M.bas + 18} textAnchor="middle" fontSize={11} fill="var(--color-encre-pale)" className="uppercase">
            {monthYear(p.date, locale)}
          </text>
          <text x={x(i)} y={H - M.bas + 33} textAnchor="middle" fontSize={10.5} fill="var(--color-encre-muette)">
            {p.note}
          </text>
        </g>
      ))}
    </svg>
  );
}
