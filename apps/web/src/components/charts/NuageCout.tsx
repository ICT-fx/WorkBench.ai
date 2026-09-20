"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { paretoFront } from "@/lib/hub";
import { pct, usd } from "@/lib/format";
import { LabMark, serie, surSerie } from "@/components/ui/LabMark";
import { useMeasure } from "./useMeasure";
import { linear, log, logTicks, niceTicks, percentDomain } from "./scales";

export type ScatterPoint = {
  id: string;
  name: string;
  href: string;
  lab: { id: string; name: string; slot?: number; monogram: string };
  cost: number;
  accuracy: number;
  ci?: number;
};

const MARGES = { haut: 30, droite: 28, bas: 46, gauche: 50 };
const COTE = 18;

/**
 * Exactitude contre coût par test. La question d'une entreprise n'est pas « quel
 * est le meilleur modèle » mais « lequel vaut son prix » : la frontière relie
 * les modèles qu'aucun autre ne bat à la fois en prix et en précision.
 */
export function NuageCout({ points, unit }: { points: ScatterPoint[]; unit: string }) {
  const { locale, dict } = useI18n();
  const t = dict.benchmarks.chart;
  const router = useRouter();
  const [ref, largeur] = useMeasure<HTMLDivElement>();
  const [actif, setActif] = useState<string | null>(null);
  const [labo, setLabo] = useState<string | null>(null);

  const visibles = useMemo(() => points.filter((p) => p.cost > 0), [points]);
  const hauteur = largeur > 0 && largeur < 640 ? 360 : 460;

  const geo = useMemo(() => {
    if (visibles.length === 0 || largeur === 0) return null;
    const couts = visibles.map((p) => p.cost);
    const [cMin, cMax] = [Math.min(...couts), Math.max(...couts)];
    // Les coûts s'étalent sur plusieurs ordres de grandeur : en linéaire, tous
    // les modèles économes s'écraseraient contre l'axe.
    const enLog = cMax / cMin >= 8;
    const [x0, x1] = [MARGES.gauche, largeur - MARGES.droite];
    const [y0, y1] = [hauteur - MARGES.bas, MARGES.haut];
    const x = enLog ? log(cMin * 0.7, cMax * 1.45, x0, x1) : linear(0, cMax * 1.1, x0, x1);
    const [aMin, aMax] = percentDomain(visibles.map((p) => p.accuracy));
    const y = linear(aMin, aMax, y0, y1);
    const front = paretoFront(visibles.map((p) => ({ id: p.id, x: p.cost, y: p.accuracy })));
    const ticksX = enLog ? logTicks(cMin * 0.7, cMax * 1.45) : niceTicks(0, cMax * 1.1, 5);
    // Une graduation tous les 64 px au plus : en deçà, les montants se chevauchent.
    const pas = Math.ceil(ticksX.length / Math.max(2, Math.floor((x1 - x0) / 64)));
    return {
      x, y, x0, x1, y0, y1, enLog,
      ticksX: ticksX.filter((_, i) => i % pas === 0),
      ticksY: niceTicks(aMin, aMax, 5),
      front: new Set(front.map((p) => p.id)),
      trace: front.map((p) => `${x(p.x)},${y(p.y)}`).join(" "),
      meilleur: visibles.reduce((a, b) => (b.accuracy > a.accuracy ? b : a)),
      econome: visibles.reduce((a, b) => (b.cost < a.cost ? b : a)),
    };
  }, [visibles, largeur, hauteur]);

  const labos = useMemo(() => {
    const vus = new Map<string, ScatterPoint["lab"]>();
    for (const p of visibles) if (!vus.has(p.lab.id)) vus.set(p.lab.id, p.lab);
    return [...vus.values()].sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99) || a.name.localeCompare(b.name));
  }, [visibles]);

  const survole = actif === null ? undefined : visibles.find((p) => p.id === actif);
  // On n'étiquette que la frontière, du plus précis au moins précis, et seulement
  // tant que les noms ne se marchent pas dessus : un nom illisible ne sert à rien.
  const etiquetes = useMemo(() => {
    if (geo === null) return [];
    const poses: { p: ScatterPoint; x: number; y: number; ancre: "start" | "end"; x0: number; x1: number }[] = [];
    const candidats = visibles.filter((p) => geo.front.has(p.id)).sort((a, b) => b.accuracy - a.accuracy);
    for (const p of candidats) {
      if (poses.length >= (largeur < 640 ? 2 : 4)) break;
      const largeurTexte = p.name.length * 6.6;
      const aDroite = geo.x(p.cost) + 14 + largeurTexte < largeur - 8;
      const x = geo.x(p.cost) + (aDroite ? 14 : -14);
      for (const y of [geo.y(p.accuracy) - 12, geo.y(p.accuracy) + 21]) {
        const [x0, x1] = aDroite ? [x, x + largeurTexte] : [x - largeurTexte, x];
        const libre = poses.every((o) => Math.abs(o.y - y) > 14 || x1 < o.x0 - 6 || x0 > o.x1 + 6);
        if (libre && y > geo.y1 + 10) {
          poses.push({ p, x, y, ancre: aDroite ? "start" : "end", x0, x1 });
          break;
        }
      }
    }
    return poses;
  }, [geo, visibles, largeur]);

  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 border-b border-filet px-5 py-3" aria-label={dict.common.labels.legend}>
        {labos.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-encre-pale transition-opacity hover:text-encre"
              style={{ opacity: labo === null || labo === l.id ? 1 : 0.4 }}
              onMouseEnter={() => { setLabo(l.id); }}
              onMouseLeave={() => { setLabo(null); }}
              onFocus={() => { setLabo(l.id); }}
              onBlur={() => { setLabo(null); }}
            >
              <LabMark lab={l} size={14} />
              {l.name}
            </button>
          </li>
        ))}
      </ul>

      <div ref={ref} className="trame relative" style={{ height: hauteur }}>
        {geo !== null && (
          <svg width={largeur} height={hauteur} role="img" aria-label={t.scatterLabel}>
            {/* Les deux coins qui veulent dire quelque chose : précis et bon marché, imprécis et cher. */}
            <rect
              x={geo.x0} y={geo.y1} width={(geo.x1 - geo.x0) / 2} height={(geo.y0 - geo.y1) / 2}
              fill="var(--color-vert-pale)" opacity={0.6}
            />
            <rect
              x={(geo.x0 + geo.x1) / 2} y={(geo.y0 + geo.y1) / 2} width={(geo.x1 - geo.x0) / 2} height={(geo.y0 - geo.y1) / 2}
              fill="var(--color-rouge-pale)" opacity={0.7}
            />
            <text x={geo.x0 + 10} y={geo.y1 + 18} className="etiquette" fill="var(--color-vert)">{t.efficient}</text>
            <text x={geo.x1 - 10} y={geo.y0 - 10} textAnchor="end" className="etiquette" fill="var(--color-rouge)">{t.inefficient}</text>

            {geo.ticksY.map((v) => (
              <g key={v}>
                <line x1={geo.x0} x2={geo.x1} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--color-filet)" />
                <text x={geo.x0 - 8} y={geo.y(v) + 4} textAnchor="end" fontSize={11} className="chiffres" fill="var(--color-encre-muette)">
                  {pct(v, locale, 0)}
                </text>
              </g>
            ))}
            {geo.ticksX.map((v) => (
              <text key={v} x={geo.x(v)} y={geo.y0 + 18} textAnchor="middle" fontSize={11} className="chiffres" fill="var(--color-encre-muette)">
                {usd(v, locale)}
              </text>
            ))}
            <line x1={geo.x0} x2={geo.x1} y1={geo.y0} y2={geo.y0} stroke="var(--color-filet-fort)" />
            <text x={(geo.x0 + geo.x1) / 2} y={hauteur - 8} textAnchor="middle" fontSize={11} fill="var(--color-encre-pale)">
              {t.costAxis.replace("{unit}", unit)}{geo.enLog ? ` · ${t.logScale}` : ""}
            </text>

            {/* Repères : ce ne sont pas des graduations mais des seuils, d'où le tireté. */}
            <line
              x1={geo.x0} x2={geo.x1} y1={geo.y(geo.meilleur.accuracy)} y2={geo.y(geo.meilleur.accuracy)}
              stroke="var(--color-encre-muette)" strokeDasharray="3 4"
            />
            {/* À gauche : les modèles les plus précis, et leurs noms, se tiennent à droite. */}
            <text x={geo.x0 + 10} y={geo.y(geo.meilleur.accuracy) - 6} className="etiquette" fill="var(--color-encre-pale)">
              {t.bestAccuracy}
            </text>
            <line
              x1={geo.x(geo.econome.cost)} x2={geo.x(geo.econome.cost)} y1={geo.y1} y2={geo.y0}
              stroke="var(--color-encre-muette)" strokeDasharray="3 4"
            />

            <polyline points={geo.trace} fill="none" stroke="var(--color-vert-vif)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* Les modèles dominés d'abord : la frontière se dessine par-dessus. */}
            {[...visibles].sort((a, b) => Number(geo.front.has(a.id)) - Number(geo.front.has(b.id))).map((p) => {
              const surFrontiere = geo.front.has(p.id);
              const estompe = (labo !== null && labo !== p.lab.id) || (actif !== null && actif !== p.id);
              return (
                <g
                  key={p.id}
                  role="link"
                  // Seule la frontière entre dans l'ordre de tabulation : le tableau
                  // sous le graphique donne tous les modèles au clavier.
                  tabIndex={surFrontiere ? 0 : -1}
                  aria-label={`${p.name} : ${pct(p.accuracy, locale)}, ${usd(p.cost, locale)}`}
                  transform={`translate(${geo.x(p.cost)}, ${geo.y(p.accuracy)})`}
                  style={{ cursor: "pointer", opacity: estompe ? 0.25 : surFrontiere || actif === p.id ? 1 : 0.62, transition: "opacity 160ms" }}
                  onMouseEnter={() => { setActif(p.id); }}
                  onMouseLeave={() => { setActif(null); }}
                  onFocus={() => { setActif(p.id); }}
                  onBlur={() => { setActif(null); }}
                  onClick={() => { router.push(p.href); }}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(p.href); }}
                >
                  {/* La cible dépasse la marque : un carré de 18 px est trop petit pour un doigt. */}
                  <rect x={-14} y={-14} width={28} height={28} fill="transparent" />
                  <rect
                    x={-COTE / 2} y={-COTE / 2} width={COTE} height={COTE} rx={5}
                    fill={serie(p.lab)} stroke="var(--color-surface)" strokeWidth={surFrontiere ? 2 : 1}
                  />
                  <text y={3.5} textAnchor="middle" fontSize={p.lab.monogram.length > 1 ? 8 : 10} fontWeight={600} fill={surSerie(p.lab)}>
                    {p.lab.monogram}
                  </text>
                </g>
              );
            })}

            {etiquetes.map(({ p, x, y, ancre }) => (
              <text
                key={p.id}
                x={x}
                y={y}
                textAnchor={ancre}
                fontSize={12}
                fontWeight={500}
                fill="var(--color-encre)"
                stroke="var(--color-surface)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {p.name}
              </text>
            ))}
          </svg>
        )}

        {geo !== null && survole !== undefined && (
          <div
            className="infobulle"
            style={{
              left: Math.min(Math.max(geo.x(survole.cost) - 90, 8), largeur - 200),
              top: geo.y(survole.accuracy) > 150 ? geo.y(survole.accuracy) - 104 : geo.y(survole.accuracy) + 22,
            }}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <LabMark lab={survole.lab} size={16} />
              {survole.name}
            </p>
            <p className="text-encre-pale">{survole.lab.name}</p>
            <dl className="chiffres mt-1.5 grid grid-cols-[auto_auto] justify-between gap-x-4">
              <dt className="text-encre-pale">{dict.common.metrics.accuracy}</dt>
              <dd className="text-right font-semibold">
                {pct(survole.accuracy, locale)}
                {survole.ci !== undefined && <span className="font-normal text-encre-muette"> ±{survole.ci.toLocaleString(locale)}</span>}
              </dd>
              <dt className="text-encre-pale">{dict.common.metrics.costShort}</dt>
              <dd className="text-right font-semibold">{usd(survole.cost, locale)}</dd>
            </dl>
            {geo.front.has(survole.id) && <p className="mt-1.5 text-vert">{t.onFrontier}</p>}
          </div>
        )}
      </div>

      <p className="border-t border-filet px-5 py-2.5 text-xs text-encre-pale">{t.scatterNote}</p>
    </div>
  );
}
