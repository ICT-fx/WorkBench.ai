"use client";

import { useState } from "react";

/** Un run où le modèle figure. Textes et positions arrivent prêts du serveur. */
export type StabilityPoint = {
  /** Place sur l'axe du temps, de 0 à 1. */
  x: number;
  /** Place sur l'axe des valeurs, 0 en haut et 1 en bas. */
  y: number;
  date: string;
  value: string;
  /** « Moyenne sur 21 benchmarks » : ce que la valeur résume. */
  basis: string;
  /** La lecture complète du point, pour le clavier et les lecteurs d'écran. */
  spoken: string;
};

export type AxisTick = { at: number; label: string };

const pourcent = (t: number): string => `${t * 100}%`;

/**
 * La courbe de stabilité d'un modèle. Seul le tracé est un SVG étiré ; points,
 * graduations et étiquettes sont du HTML placé en pourcentage : le texte garde
 * sa taille à toutes les largeurs, sans rien mesurer ni redessiner au
 * redimensionnement.
 */
export function StabilityChart({ points, yTicks, xTicks, color, step }: {
  points: StabilityPoint[];
  yTicks: AxisTick[];
  xTicks: AxisTick[];
  color: string;
  /** Largeur d'un run sur l'axe du temps, de 0 à 1 : celle de la zone sensible de chaque point. */
  step: number;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const dernier = points.at(-1);
  const vise = actif === null ? undefined : points[actif];

  return (
    <div className="trame px-4 pb-4 pt-10 sm:px-5">
      <div className="relative ml-10 mr-16 h-44" onPointerLeave={() => { setActif(null); }}>
        {yTicks.map((tick) => (
          <div key={tick.at} aria-hidden className="absolute inset-x-0 h-px bg-filet" style={{ top: pourcent(tick.at) }}>
            <span className="chiffres absolute right-full mr-2.5 -translate-y-1/2 whitespace-nowrap text-[0.72rem] text-encre-pale">
              {tick.label}
            </span>
          </div>
        ))}

        {vise !== undefined && (
          <div aria-hidden className="absolute inset-y-0 w-px bg-filet-fort" style={{ left: pourcent(vise.x) }} />
        )}

        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <polyline
            points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {points.map((p, i) => (
          <span
            key={p.date}
            aria-hidden
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 ease-sortie"
            style={{
              left: pourcent(p.x),
              top: pourcent(p.y),
              background: color,
              // L'anneau couleur surface détache le point de la courbe qu'il recouvre.
              boxShadow: "0 0 0 2px var(--color-surface)",
              scale: actif === i ? "1.5" : undefined,
            }}
          />
        ))}

        {dernier !== undefined && (
          <span
            aria-hidden
            className="absolute ml-3 -translate-y-1/2 whitespace-nowrap text-sm font-semibold"
            style={{ left: pourcent(dernier.x), top: pourcent(dernier.y) }}
          >
            {dernier.value}
          </span>
        )}

        {/* La zone sensible est la colonne entière du run : on vise une date, pas un point de 8 px. */}
        {points.map((p, i) => (
          <button
            key={p.date}
            type="button"
            aria-label={p.spoken}
            className="absolute inset-y-0 -translate-x-1/2 cursor-default rounded-[var(--radius-s)] focus-visible:outline-offset-0"
            style={{ left: pourcent(p.x), width: `max(${pourcent(step)}, 1.5rem)` }}
            onPointerEnter={() => { setActif(i); }}
            onFocus={() => { setActif(i); }}
            onBlur={() => { setActif(null); }}
            onKeyDown={(e) => { if (e.key === "Escape") setActif(null); }}
          />
        ))}

        {vise !== undefined && (
          <div
            aria-hidden
            className="infobulle"
            style={{
              left: pourcent(vise.x),
              top: pourcent(vise.y),
              // Près d'un bord, l'infobulle s'aligne sur le point au lieu de se centrer dessus.
              transform: `translate(${vise.x < 0.3 ? "-0.75rem" : vise.x > 0.7 ? "calc(-100% + 0.75rem)" : "-50%"}, calc(-100% - 0.9rem))`,
            }}
          >
            <p className="text-encre-pale">{vise.date}</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="h-0.5 w-3 flex-none rounded-full" style={{ background: color }} />
              <strong className="text-base font-semibold">{vise.value}</strong>
            </p>
            <p className="mt-1 text-encre-pale">{vise.basis}</p>
          </div>
        )}
      </div>

      {/* Sur un écran étroit, une date sur deux suffit — en gardant toujours la dernière. */}
      <div aria-hidden className="relative ml-10 mr-16 mt-2.5 h-4">
        {xTicks.map((tick, i) => (
          <span
            key={tick.at}
            className={`chiffres absolute -translate-x-1/2 whitespace-nowrap text-[0.72rem] leading-none text-encre-pale ${(xTicks.length - 1 - i) % 2 === 1 ? "max-sm:hidden" : ""}`}
            style={{ left: pourcent(tick.at) }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
