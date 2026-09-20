"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Bar } from "./Bar";

export type MetricId = "exactitude" | "cost" | "latency" | "hallucinations";

const METRIQUES: MetricId[] = ["exactitude", "cost", "latency", "hallucinations"];

/**
 * Une mesure d'un benchmark, déjà mise en forme par le serveur : le navigateur
 * ne fait que choisir laquelle montrer, il ne reformate aucun nombre.
 */
export type MetricCell = {
  value: string;
  /** « ± 2,8 » : la marge d'erreur, pour l'exactitude seulement. */
  detail?: string;
  /** Longueur de la barre, de 0 à 1. */
  ratio: number;
  /** « 4 / 39 », et sa lecture à voix haute ; `null` quand la valeur est inconnue. */
  rank: { text: string; spoken: string } | null;
};

export type BenchmarkLine = {
  id: string;
  label: string;
  href: string;
  /** `null` : le modèle n'a pas passé ce benchmark. */
  cells: Record<MetricId, MetricCell> | null;
  /** Pourquoi il ne l'a pas passé, quand on le sait. */
  reason?: string;
};

export type BenchmarkGroup = { id: string; label: string; icon: IconName; lines: BenchmarkLine[] };

export function BenchmarkResults({ groups, color, demo }: {
  groups: BenchmarkGroup[];
  /** La teinte du labo : celle de toutes les barres, sauf les hallucinations. */
  color: string;
  demo: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.models.results;
  const { metrics, labels } = dict.common;
  const [metrique, setMetrique] = useState<MetricId>("exactitude");

  const onglets: Record<MetricId, string> = {
    exactitude: metrics.accuracy,
    cost: metrics.costShort,
    latency: metrics.latencyShort,
    hallucinations: metrics.hallucinations,
  };
  // Le rouge reste réservé à ce qui cloche : seules les hallucinations le portent.
  const teinte = metrique === "hallucinations" ? "var(--color-rouge)" : color;

  return (
    <div className="panneau @container">
      <div className="barre">
        <div role="group" aria-label={t.metric} className="segment">
          {METRIQUES.map((m) => (
            <button key={m} type="button" aria-pressed={metrique === m} onClick={() => { setMetrique(m); }}>
              {onglets[m]}
            </button>
          ))}
        </div>
        <DemoTag dict={dict} show={demo} />
      </div>

      {groups.map((groupe) => (
        <section key={groupe.id} aria-labelledby={`resultats-${groupe.id}`}>
          <h3
            id={`resultats-${groupe.id}`}
            className="etiquette flex items-center gap-2 border-b border-filet bg-creux px-4 py-2 sm:px-5"
          >
            <Icon name={groupe.icon} size={15} />
            {groupe.label}
          </h3>
          <ul>
            {groupe.lines.map((ligne) => {
              const cellule = ligne.cells?.[metrique];
              return (
                <li
                  key={ligne.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-filet px-4 py-3 sm:px-5 @min-[44rem]:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_8.5rem_4.5rem]"
                >
                  <Link
                    href={ligne.href}
                    prefetch={false}
                    className="col-start-1 row-start-1 text-[0.95rem] leading-snug underline decoration-filet-fort transition-colors duration-150 ease-sortie hover:decoration-vert @min-[44rem]:col-start-auto @min-[44rem]:row-start-auto"
                  >
                    {ligne.label}
                  </Link>

                  {cellule === undefined ? (
                    <p className="col-span-full flex flex-wrap items-center gap-2 text-sm text-encre-pale @min-[44rem]:col-span-3">
                      {labels.notTested}
                      {ligne.reason !== undefined && <span className="pastille">{ligne.reason}</span>}
                    </p>
                  ) : (
                    <>
                      <div className="col-start-1 row-start-2 @min-[44rem]:col-start-auto @min-[44rem]:row-start-auto">
                        <Bar ratio={cellule.ratio} color={teinte} />
                      </div>
                      <p className="chiffres col-start-2 row-start-2 whitespace-nowrap text-right @min-[44rem]:col-start-auto @min-[44rem]:row-start-auto">
                        <span className="font-medium">{cellule.value}</span>
                        {cellule.detail !== undefined && <span className="ml-1.5 text-sm text-encre-pale">{cellule.detail}</span>}
                      </p>
                      <p className="chiffres col-start-2 row-start-1 whitespace-nowrap text-right text-sm text-encre-pale @min-[44rem]:col-start-auto @min-[44rem]:row-start-auto">
                        {cellule.rank === null ? (
                          <span aria-hidden>—</span>
                        ) : (
                          <>
                            <span aria-hidden>{cellule.rank.text}</span>
                            <span className="sr-only">{cellule.rank.spoken}</span>
                          </>
                        )}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="px-4 py-3 text-xs text-encre-pale sm:px-5">{t.scale[metrique]}</p>
    </div>
  );
}
