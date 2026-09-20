"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { duration, num, pct, price, usd } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import { DemoTag } from "@/components/ui/DemoTag";
import type { LabView } from "@/lib/views";

export type TableRow = {
  id: string;
  name: string;
  href: string;
  lab: LabView;
  weights: "ouverts" | "fermes" | null;
  exactitude: number;
  ci?: number;
  sansRelecture: number;
  hallucinations: number;
  cost: number;
  priceIn: number | null;
  priceOut: number | null;
  latency: number;
  errorCount: number;
  bySubtask: Record<string, number>;
};

type Tri = "exactitude" | "sansRelecture" | "hallucinations" | "cost" | "latency";
type Poids = "tous" | "ouverts" | "fermes";

const MOINS_EST_MIEUX: Record<Tri, boolean> = {
  exactitude: false, sansRelecture: false, hallucinations: true, cost: true, latency: true,
};

const VISIBLES = 15;

export function LeaderboardTable({ rows, subtasks, title, subtitle, unit, demo }: {
  rows: TableRow[];
  subtasks: { id: string; label: string }[];
  title: string;
  subtitle: string;
  unit: string;
  demo: boolean;
}) {
  const { locale, dict } = useI18n();
  const t = dict.benchmarks.detail;
  const m = dict.common.metrics;
  const [tri, setTri] = useState<Tri>("exactitude");
  const [poids, setPoids] = useState<Poids>("tous");
  const [tache, setTache] = useState("");
  const [deplie, setDeplie] = useState(false);

  // Sur une sous-tâche, la colonne d'exactitude montre le score de cette sous-tâche.
  const exactitude = (r: TableRow): number => (tache === "" ? r.exactitude : r.bySubtask[tache] ?? 0);

  const triees = useMemo(() => {
    const valeur = (r: TableRow): number => (tri === "exactitude" ? exactitude(r) : r[tri]);
    return rows
      .filter((r) => poids === "tous" || r.weights === poids)
      // Un coût inconnu vaut 0 dans les données : il ne doit pas passer pour le moins cher.
      .sort((a, b) => {
        if (tri === "cost" && (a.cost === 0 || b.cost === 0)) return Number(a.cost === 0) - Number(b.cost === 0);
        return MOINS_EST_MIEUX[tri] ? valeur(a) - valeur(b) : valeur(b) - valeur(a);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tri, poids, tache]);

  const affichees = deplie ? triees : triees.slice(0, VISIBLES);

  const enTete = (id: Tri, libelle: string, aide: string, classe = "") => (
    <th scope="col" className={`droite ${classe}`} aria-sort={tri === id ? (MOINS_EST_MIEUX[id] ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        title={aide}
        onClick={() => { setTri(id); }}
        className={`etiquette inline-flex items-center gap-1 ${tri === id ? "!text-encre" : ""}`}
      >
        {libelle}
        <Icon name="chevron-down" size={12} className={tri === id ? "" : "opacity-30"} />
      </button>
    </th>
  );

  return (
    <section className="panneau">
      <div className="barre">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-encre-pale">{subtitle}</span>
        </p>
        <DemoTag dict={dict} show={demo} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-filet px-5 py-3">
        <div className="segment" role="group" aria-label={dict.common.labels.weights}>
          {([["tous", t.filterAll], ["ouverts", dict.common.labels.openWeights], ["fermes", dict.common.labels.closedWeights]] as const).map(([id, libelle]) => (
            <button key={id} type="button" aria-pressed={poids === id} onClick={() => { setPoids(id); }}>{libelle}</button>
          ))}
        </div>
        {subtasks.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="etiquette">{t.task}</span>
            <select className="champ !w-auto !py-1.5 !text-sm" value={tache} onChange={(e) => { setTache(e.target.value); setTri("exactitude"); }}>
              <option value="">{t.overall}</option>
              {subtasks.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="tableau chiffres">
          <thead>
            <tr>
              <th scope="col" className="w-10"><span className="sr-only">{m.rank}</span></th>
              <th scope="col"><span className="etiquette">{dict.common.labels.model} ({triees.length})</span></th>
              {enTete("exactitude", m.accuracy, m.accuracyHelp)}
              {enTete("sansRelecture", m.noReview, m.noReviewHelp, "hidden lg:table-cell")}
              {enTete("hallucinations", m.hallucinations, m.hallucinationsHelp)}
              {enTete("cost", `${m.costShort} / ${unit}`, m.costHelp)}
              <th scope="col" className="droite hidden xl:table-cell"><span className="etiquette" title={m.perMillion}>{m.tokenPrice}</span></th>
              {enTete("latency", m.latency, m.latencyHelp, "hidden md:table-cell")}
            </tr>
          </thead>
          <tbody>
            {affichees.map((r, i) => (
              <tr key={r.id} data-rang={tri === "exactitude" && poids === "tous" ? i + 1 : undefined}>
                <td className="text-xs text-encre-muette">{i + 1}</td>
                <th scope="row">
                  <Link href={r.href} className="flex items-center gap-2.5 no-underline hover:underline" style={{ fontVariantNumeric: "normal" }}>
                    <LabMark lab={r.lab} size={20} />
                    <span className="font-medium">{r.name}</span>
                  </Link>
                  {r.errorCount > 0 && (
                    <span className="ml-[1.9rem] block text-xs text-encre-pale">{fill(t.errors, { n: r.errorCount })}</span>
                  )}
                </th>
                <td className="droite whitespace-nowrap">
                  <span className="font-semibold">{pct(exactitude(r), locale)}</span>
                  {tache === "" && r.ci !== undefined && (
                    <span className="ml-1.5 text-xs text-encre-muette" title={m.margin}>±{num(r.ci, locale)}</span>
                  )}
                </td>
                <td className="droite hidden lg:table-cell">{pct(r.sansRelecture, locale)}</td>
                <td className={`droite ${r.hallucinations > 0 ? "font-semibold text-rouge" : "text-encre-pale"}`}>{pct(r.hallucinations, locale)}</td>
                <td className="droite whitespace-nowrap">{usd(r.cost, locale)}</td>
                <td className="droite hidden whitespace-nowrap text-encre-pale xl:table-cell">
                  {r.priceIn === null ? dict.common.labels.unknown : `${price(r.priceIn, locale)} / ${price(r.priceOut, locale)}`}
                </td>
                <td className="droite hidden whitespace-nowrap md:table-cell">{duration(r.latency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {triees.length > VISIBLES && (
        <button
          type="button"
          aria-expanded={deplie}
          onClick={() => { setDeplie((d) => !d); }}
          className="etiquette flex w-full items-center justify-center gap-2 border-t border-filet bg-vert-brume py-3 transition-colors hover:bg-vert-pale hover:!text-encre"
        >
          {deplie ? dict.common.labels.viewLess : fill(dict.common.labels.viewMore, { n: triees.length - VISIBLES })}
          <Icon name="chevron-down" size={14} className={deplie ? "rotate-180" : ""} />
        </button>
      )}
    </section>
  );
}
