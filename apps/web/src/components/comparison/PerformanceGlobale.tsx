"use client";

import { useState } from "react";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { duration, num, pct, usd } from "@/lib/format";
import { knownAmount, ticksFromZero } from "@/lib/comparison";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Legende, Pastille } from "./Legende";
import { couleurSerie, type ModeleCompare } from "./types";
import { useLargeur } from "./useLargeur";

type Mesure = "indice" | "cost" | "latency";

const MESURES: { id: Mesure; icon: IconName }[] = [
  { id: "indice", icon: "bars" },
  { id: "cost", icon: "coin" },
  { id: "latency", icon: "clock" },
];

const MARGES = { haut: 36, droite: 16, bas: 8, gauche: 58 };
const BULLE = 208;

/** Une colonne aux sommets arrondis et à la base carrée : elle est posée sur l'axe. */
const colonne = (x: number, y: number, w: number, h: number): string => {
  const r = Math.min(6, w / 2, h);
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`;
};

/**
 * Trois lectures des mêmes modèles. Les colonnes gardent l'ordre et la teinte de
 * la sélection d'un onglet à l'autre : on lit ce que coûte le plus précis, au
 * lieu de voir les colonnes se réordonner.
 */
export function PerformanceGlobale({ modeles, ranked, demo }: { modeles: ModeleCompare[]; ranked: number; demo: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.comparison.overall;
  const { metrics, labels } = dict.common;
  const [mesure, setMesure] = useState<Mesure>("indice");
  const [actif, setActif] = useState<number | null>(null);
  const [ref, largeur] = useLargeur<HTMLDivElement>();

  const libelles: Record<Mesure, string> = { indice: metrics.indice, cost: metrics.cost, latency: metrics.latency };
  const aides: Record<Mesure, string> = { indice: metrics.indiceHelp, cost: metrics.costHelp, latency: metrics.latencyHelp };

  const valeur = (m: ModeleCompare): number | null =>
    mesure === "indice" ? m.indice : knownAmount(mesure === "cost" ? m.cost : m.latency);
  const affiche = (v: number): string =>
    mesure === "indice" ? pct(v, locale) : mesure === "cost" ? usd(v, locale) : duration(v, locale);
  const graduation = (v: number): string =>
    v === 0 ? num(0, locale, 0) : mesure === "indice" ? pct(v, locale, 0) : affiche(v);
  const absent = mesure === "indice" ? labels.notRanked : labels.unknown;

  const valeurs = modeles.map(valeur);
  // L'indice se lit sur 100 ; un coût ou un temps n'a pas de plafond naturel. Le
  // temps se gradue en secondes rondes, pas en millisecondes rondes.
  const unite = mesure === "latency" ? 1000 : 1;
  const graduations = mesure === "indice"
    ? [0, 25, 50, 75, 100]
    : ticksFromZero(Math.max(0, ...valeurs.map((v) => v ?? 0)) / unite).map((g) => g * unite);
  const max = graduations.at(-1) ?? 1;

  const hauteur = largeur > 0 && largeur < 520 ? 280 : 340;
  const [x0, x1] = [MARGES.gauche, largeur - MARGES.droite];
  const [y0, y1] = [hauteur - MARGES.bas, MARGES.haut];
  const bande = Math.min(176, (x1 - x0) / modeles.length);
  const debut = x0 + (x1 - x0 - bande * modeles.length) / 2;
  const epaisseur = Math.min(72, bande * 0.62);
  const y = (v: number): number => y0 - (v / max) * (y0 - y1);
  const centre = (i: number): number => debut + bande * (i + 0.5);

  const survole = actif === null ? undefined : modeles[actif];
  const sommet = actif === null ? y0 : y(valeurs[actif] ?? 0);

  return (
    <div className="panneau">
      <div className="barre">
        <div className="segment" role="group" aria-label={t.measure}>
          {MESURES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mesure === m.id} onClick={() => { setMesure(m.id); }}>
              <Icon name={m.icon} size={14} />
              {libelles[m.id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Legende modeles={modeles} />
          <DemoTag dict={dict} show={demo} />
        </div>
      </div>

      <div className="trame px-3 pb-4 pt-2 sm:px-5">
        <div ref={ref} className="relative" style={{ height: hauteur }}>
          {largeur > 0 && (
            <svg width={largeur} height={hauteur} role="group" aria-label={fill(t.chart, { metric: libelles[mesure] })}>
              {graduations.map((g) => (
                <g key={g}>
                  <line x1={x0} x2={x1} y1={y(g)} y2={y(g)} stroke={g === 0 ? "var(--color-filet-fort)" : "var(--color-filet)"} />
                  <text x={x0 - 8} y={y(g) + 4} textAnchor="end" fontSize={11} className="chiffres" fill="var(--color-encre-muette)">
                    {graduation(g)}
                  </text>
                </g>
              ))}

              {modeles.map((m, i) => {
                const v = valeurs[i] ?? null;
                const haut = v === null ? y0 : Math.min(y(v), y0 - 2);
                return (
                  <g
                    key={`${mesure}-${m.slug}`}
                    role="img"
                    tabIndex={0}
                    aria-label={`${m.name} : ${v === null ? absent : affiche(v)}`}
                    onMouseEnter={() => { setActif(i); }}
                    onMouseLeave={() => { setActif(null); }}
                    onFocus={() => { setActif(i); }}
                    onBlur={() => { setActif(null); }}
                  >
                    {/* La cible couvre toute la bande : une colonne basse reste facile à viser. */}
                    <rect x={centre(i) - bande / 2} y={y1 - 24} width={bande} height={y0 - y1 + 24} fill="transparent" />
                    {v !== null && (
                      <path
                        d={colonne(centre(i) - epaisseur / 2, haut, epaisseur, y0 - haut)}
                        fill={couleurSerie(i)}
                        className="origin-bottom animate-[pousse_250ms_var(--ease-sortie)] [transform-box:fill-box]"
                        style={{ opacity: actif === null || actif === i ? 1 : 0.55, transition: "opacity 160ms var(--ease-sortie)" }}
                      />
                    )}
                    <text
                      x={centre(i)} y={haut - 9} textAnchor="middle" fontSize={bande < 64 ? 11 : 12.5} fontWeight={600}
                      className="chiffres" fill={v === null ? "var(--color-encre-muette)" : "var(--color-encre)"}
                    >
                      {v === null ? "—" : affiche(v)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {survole !== undefined && actif !== null && (
            <div
              className="infobulle w-52"
              style={{
                left: Math.min(Math.max(centre(actif) - BULLE / 2, 4), Math.max(4, largeur - BULLE - 4)),
                top: sommet > 170 ? sommet - 34 : sommet + 14,
                transform: sommet > 170 ? "translateY(-100%)" : undefined,
              }}
            >
              <p className="flex items-center gap-1.5 font-semibold">
                <Pastille index={actif} />
                {survole.name}
              </p>
              <p className="text-encre-pale">{survole.lab.name}</p>
              <dl className="chiffres mt-1.5 grid grid-cols-[auto_auto] justify-between gap-x-4 gap-y-0.5">
                <dt className="text-encre-pale">{metrics.indice}</dt>
                <dd className="text-right font-semibold">
                  {survole.indice === null ? labels.notRanked : pct(survole.indice, locale)}
                  {survole.indice !== null && survole.ci !== null && <span className="font-normal text-encre-pale"> ±{num(survole.ci, locale)}</span>}
                </dd>
                {survole.rank !== null && (
                  <>
                    <dt className="text-encre-pale">{metrics.rank}</dt>
                    <dd className="text-right">{fill(t.rankOf, { rank: survole.rank, of: ranked })}</dd>
                  </>
                )}
                <dt className="text-encre-pale">{metrics.costShort}</dt>
                <dd className="text-right">{knownAmount(survole.cost) === null ? labels.unknown : usd(survole.cost, locale)}</dd>
                <dt className="text-encre-pale">{metrics.latencyShort}</dt>
                <dd className="text-right">{knownAmount(survole.latency) === null ? labels.unknown : duration(survole.latency, locale)}</dd>
              </dl>
            </div>
          )}
        </div>

        {/* Les noms sont du HTML sous le tracé : ils passent à la ligne d'eux-mêmes quand la bande rétrécit. */}
        <ol
          aria-hidden
          className="flex pt-1"
          style={{ paddingLeft: Math.max(0, debut), paddingRight: Math.max(0, largeur - debut - bande * modeles.length) }}
        >
          {modeles.map((m) => (
            <li key={m.slug} className="min-w-0 flex-1 break-words px-1 text-center text-[0.72rem] leading-tight text-encre-pale">
              {m.name}
            </li>
          ))}
        </ol>
      </div>

      <p className="border-t border-filet px-5 py-2.5 text-xs text-encre-pale">
        {aides[mesure]}. {mesure === "indice" ? t.higherBetter : t.lowerBetter}
      </p>
    </div>
  );
}
