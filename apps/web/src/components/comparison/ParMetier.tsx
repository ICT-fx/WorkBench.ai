"use client";

import { useState } from "react";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { pct } from "@/lib/format";
import { bestOfRow, leadWithinMargin, radarCeiling, radarFloor, splitLabel } from "@/lib/comparison";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, hasIcon, type IconName } from "@/components/ui/Icon";
import { Legende, Pastille } from "./Legende";
import { CelluleScore, EnTeteLigne, TableauModeles } from "./TableauModeles";
import { couleurSerie, type MetierCompare, type ModeleCompare } from "./types";
import { useLargeur } from "./useLargeur";

const ANNEAUX = 4;
const INTERLIGNE = 13;
/** Largeur moyenne d'un caractère de `.etiquette` (capitales espacées), avec une marge de sûreté. */
const CARACTERE = 8.6;
const BULLE = 208;

const icone = (name: string): IconName => (hasIcon(name) ? name : "indice");

type Point = [number, number];

/**
 * Le profil de chaque modèle d'un seul regard, et les mêmes chiffres en tableau.
 * Le radar part d'un plancher, pas de zéro : l'échelle est écrite dessous, et le
 * tableau donne les valeurs exactes — le dessin montre des formes, pas des mesures.
 */
export function ParMetier({ modeles, domains, demo }: { modeles: ModeleCompare[]; domains: MetierCompare[]; demo: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.comparison.domains;
  const [survol, setSurvol] = useState<number | null>(null);
  const [epingle, setEpingle] = useState<number | null>(null);
  const [axe, setAxe] = useState<{ index: number; clavier: boolean } | null>(null);
  const [ref, cote] = useLargeur<HTMLDivElement>();

  const enAvant = survol ?? (epingle !== null && epingle < modeles.length ? epingle : null);
  const n = domains.length;
  const score = (m: ModeleCompare, d: MetierCompare): number | null => m.byDomain[d.id] ?? null;
  const valeurs = modeles.flatMap((m) => domains.map((d) => score(m, d)));
  const plancher = radarFloor(valeurs);
  const plafond = radarCeiling(valeurs);
  const vide = modeles.every((m) => domains.every((d) => score(m, d) === null));

  // Sous 420 px, des libellés en toutes lettres ne laisseraient qu'un radar
  // minuscule : les icônes des métiers prennent le relais, le tableau les nomme.
  const enTexte = cote >= 420;
  const lignesDe = domains.map((d) => splitLabel(d.label));
  const direction = (i: number): Point => {
    const a = (i / n) * 2 * Math.PI;
    return [Math.sin(a), -Math.cos(a)];
  };
  const rayon = Math.max(60, enTexte
    ? Math.min(
      cote / 2 - 48,
      ...domains.map((_, i) => {
        const [ux] = direction(i);
        if (Math.abs(ux) < 0.2) return Infinity;
        const largeur = Math.max(...(lignesDe[i] ?? [""]).map((l) => l.length)) * CARACTERE;
        return (cote / 2 - 4 - largeur) / Math.abs(ux) - 14;
      }),
    )
    : cote / 2 - 38);
  const c = cote / 2;
  const point = (i: number, r: number): Point => {
    const [ux, uy] = direction(i);
    return [c + ux * r, c + uy * r];
  };
  const r = (v: number): number => (rayon * (Math.min(plafond, Math.max(plancher, v)) - plancher)) / (plafond - plancher);
  const trace = (points: Point[]): string => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const secteur = (i: number): string => {
    const demi = Math.PI / n;
    const a = (i / n) * 2 * Math.PI;
    const R = rayon + 34;
    const bord = (angle: number): string => `${(c + Math.sin(angle) * R).toFixed(1)},${(c - Math.cos(angle) * R).toFixed(1)}`;
    return `M${c},${c}L${bord(a - demi)}A${R},${R} 0 0 1 ${bord(a + demi)}Z`;
  };

  // La série mise en avant se dessine en dernier : elle passe au-dessus des autres.
  const ordre = modeles.map((_, i) => i).sort((a, b) => Number(a === enAvant) - Number(b === enAvant));
  const bout = axe === null ? null : point(axe.index, rayon);

  return (
    <div className="panneau">
      <div className="barre">
        <Legende
          modeles={modeles}
          actif={enAvant}
          epingle={epingle}
          onSurvol={setSurvol}
          onEpingle={(i) => { setEpingle((courant) => (courant === i ? null : i)); }}
        />
        <DemoTag dict={dict} show={demo} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="trame border-b border-filet p-3 sm:p-5 lg:border-b-0 lg:border-r">
          <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[520px]">
            {cote > 0 && !vide && (
              <svg width={cote} height={cote} role="group" aria-label={t.radar}>
                {Array.from({ length: ANNEAUX }, (_, k) => {
                  const rk = (rayon * (k + 1)) / ANNEAUX;
                  const v = plancher + ((plafond - plancher) * (k + 1)) / ANNEAUX;
                  return (
                    <g key={k}>
                      <polygon
                        points={trace(domains.map((_, i) => point(i, rk)))}
                        fill="none"
                        stroke={k === ANNEAUX - 1 ? "var(--color-filet-fort)" : "var(--color-filet)"}
                      />
                      <text
                        x={c + 5} y={c - rk + 12} fontSize={10} className="chiffres" fill="var(--color-encre-muette)"
                        stroke="var(--color-surface)" strokeWidth={3} paintOrder="stroke"
                      >
                        {pct(v, locale, Number.isInteger(v) ? 0 : 1)}
                      </text>
                    </g>
                  );
                })}

                {domains.map((d, i) => {
                  const [x, y] = point(i, rayon);
                  const vise = axe?.index === i;
                  // Au clavier, l'axe visé porte l'indication de focus que le secteur, invisible, ne peut pas porter.
                  const auClavier = vise && axe?.clavier === true;
                  return (
                    <line
                      key={d.id} x1={c} y1={c} x2={x} y2={y}
                      stroke={auClavier ? "var(--color-vert-vif)" : vise ? "var(--color-filet-fort)" : "var(--color-filet)"}
                      strokeWidth={auClavier ? 2 : 1}
                    />
                  );
                })}

                {ordre.map((mi) => {
                  const m = modeles[mi];
                  if (m === undefined) return null;
                  const points = domains.map((d, i): Point | null => {
                    const v = score(m, d);
                    return v === null ? null : point(i, r(v));
                  });
                  const complets = points.filter((p): p is Point => p !== null);
                  // Un métier sans score ouvre le tracé : le refermer par le centre inventerait un zéro.
                  const ouvert = points
                    .map((p, i) => {
                      const q = points[(i + 1) % n];
                      return p === null || q === null || q === undefined ? "" : `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`;
                    })
                    .join("");
                  return (
                    <g
                      key={m.slug}
                      style={{ opacity: enAvant === null || enAvant === mi ? 1 : 0.25, transition: "opacity 160ms var(--ease-sortie)" }}
                    >
                      {complets.length === n ? (
                        <polygon
                          points={trace(complets)} fill={couleurSerie(mi)} fillOpacity={0.1}
                          stroke={couleurSerie(mi)} strokeWidth={2} strokeLinejoin="round"
                        />
                      ) : (
                        <path d={ouvert} fill="none" stroke={couleurSerie(mi)} strokeWidth={2} strokeLinecap="round" />
                      )}
                      {points.map((p, i) => p !== null && (
                        <circle
                          key={domains[i]?.id ?? i} cx={p[0]} cy={p[1]} r={axe?.index === i ? 4.5 : 3}
                          fill={couleurSerie(mi)} stroke="var(--color-surface)" strokeWidth={2}
                        />
                      ))}
                    </g>
                  );
                })}

                {domains.map((d, i) => {
                  const [ux, uy] = direction(i);
                  if (!enTexte) {
                    const [x, y] = point(i, rayon + 20);
                    return (
                      <g key={d.id} transform={`translate(${x - 9}, ${y - 9})`} className="text-encre-pale">
                        <Icon name={icone(d.icon)} size={18} />
                      </g>
                    );
                  }
                  const [x, y] = point(i, rayon + 14);
                  const lignes = lignesDe[i] ?? [d.label];
                  const premiere = uy < -0.5 ? y - (lignes.length - 1) * INTERLIGNE
                    : uy > 0.5 ? y + 10
                    : y + 4 - ((lignes.length - 1) * INTERLIGNE) / 2;
                  return (
                    <text
                      key={d.id}
                      textAnchor={Math.abs(ux) < 0.2 ? "middle" : ux > 0 ? "start" : "end"}
                      className="etiquette fill-current"
                    >
                      {lignes.map((ligne, k) => <tspan key={k} x={x} y={premiere + k * INTERLIGNE}>{ligne}</tspan>)}
                    </text>
                  );
                })}

                {/* Un secteur par métier : une cible large, au survol comme au clavier. */}
                {domains.map((d, i) => (
                  <path
                    key={d.id}
                    d={secteur(i)}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.label} : ${modeles.map((m) => {
                      const v = score(m, d);
                      return `${m.name} ${v === null ? dict.common.labels.notTested : pct(v, locale)}`;
                    }).join(", ")}`}
                    className="outline-none"
                    onMouseEnter={() => { setAxe({ index: i, clavier: false }); }}
                    onMouseLeave={() => { setAxe(null); }}
                    onFocus={() => { setAxe({ index: i, clavier: true }); }}
                    onBlur={() => { setAxe(null); }}
                  />
                ))}
              </svg>
            )}

            {vide && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-encre-pale">{t.empty}</p>}

            {axe !== null && bout !== null && domains[axe.index] !== undefined && (
              <div
                className="infobulle w-52"
                style={{
                  left: Math.min(Math.max(bout[0] - BULLE / 2, 0), Math.max(0, cote - BULLE)),
                  top: bout[1] < c ? bout[1] + 18 : bout[1] - 18,
                  transform: bout[1] < c ? undefined : "translateY(-100%)",
                }}
              >
                <p className="font-semibold">{domains[axe.index]?.label}</p>
                <dl className="chiffres mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
                  {modeles.map((m, mi) => {
                    const d = domains[axe.index];
                    const v = d === undefined ? null : score(m, d);
                    return (
                      <div key={m.slug} className="contents">
                        <dt className="flex min-w-0 items-center gap-1.5 text-encre-pale">
                          <Pastille index={mi} />
                          <span className="truncate">{m.name}</span>
                        </dt>
                        <dd className="text-right font-semibold">{v === null ? "—" : pct(v, locale)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}
          </div>
          <p className="chiffres mt-3 text-center text-xs text-encre-pale">
            {fill(t.scale, { min: pct(plancher, locale, 0), max: pct(plafond, locale, 0) })}
          </p>
        </div>

        <TableauModeles
          compact
          caption={t.caption}
          coin={t.column}
          modeles={modeles}
          entete={(m, i) => (
            <span className="flex items-start gap-1.5 text-xs font-medium leading-tight">
              <Pastille index={i} className="mt-[0.2rem]" />
              <span className="min-w-0 break-words">{m.name}</span>
            </span>
          )}
        >
          {domains.map((d) => {
            const valeurs = modeles.map((m) => score(m, d));
            const meilleurs = bestOfRow(valeurs);
            const serre = leadWithinMargin(valeurs, modeles.map((m) => m.ciByDomain[d.id] ?? null));
            return (
              <tr key={d.id} className="group">
                <EnTeteLigne icon={icone(d.icon)} label={d.label} />
                {modeles.map((m, i) => (
                  <CelluleScore
                    key={m.slug}
                    compact
                    valeur={valeurs[i] ?? null}
                    meilleur={meilleurs.includes(i)}
                    exAequo={serre}
                    absent="—"
                  />
                ))}
              </tr>
            );
          })}
        </TableauModeles>
      </div>
    </div>
  );
}
