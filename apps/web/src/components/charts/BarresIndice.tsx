"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { duration, pct, usd } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LabMark, serie } from "@/components/ui/LabMark";
import { DemoTag } from "@/components/ui/DemoTag";

export type BarItem = {
  id: string;
  name: string;
  href: string;
  lab: { id: string; name: string; slot?: number; monogram: string };
  indice: number;
  cost: number | null;
  latency: number | null;
};

type Mesure = "indice" | "cost" | "latency";

const ICONES: Record<Mesure, IconName> = { indice: "bars", cost: "coin", latency: "clock" };

/**
 * Le meilleur modèle de chaque labo, côte à côte. L'ordre reste celui de
 * l'indice quelle que soit la mesure affichée : on lit ainsi ce que coûte le
 * premier, au lieu de voir les colonnes se réordonner sous ses yeux.
 */
export function BarresIndice({ items, updated, demo }: { items: BarItem[]; updated: string; demo: boolean }) {
  const { locale, dict } = useI18n();
  const [mesure, setMesure] = useState<Mesure>("indice");

  const valeur = (i: BarItem): number | null => (mesure === "indice" ? i.indice : mesure === "cost" ? i.cost : i.latency);
  const affiche = (i: BarItem): string =>
    mesure === "indice" ? pct(i.indice, locale) : mesure === "cost" ? usd(i.cost, locale) : duration(i.latency, locale);
  const max = Math.max(...items.map((i) => valeur(i) ?? 0), 1e-9);
  // L'indice se lit sur 100 ; un coût ou un temps n'a pas de plafond naturel.
  const part = (i: BarItem): number => (mesure === "indice" ? i.indice / 100 : (valeur(i) ?? 0) / max);

  const libelles: Record<Mesure, string> = {
    indice: dict.common.metrics.indice,
    cost: dict.common.metrics.cost,
    latency: dict.common.metrics.latency,
  };

  return (
    <section className="panneau" aria-label={dict.home.index.title}>
      <div className="barre">
        <div className="segment" role="group" aria-label={dict.home.index.measure}>
          {(Object.keys(libelles) as Mesure[]).map((m) => (
            <button key={m} type="button" aria-pressed={mesure === m} onClick={() => { setMesure(m); }}>
              <Icon name={ICONES[m]} size={14} />
              {libelles[m]}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2.5 text-xs text-encre-pale">
          <DemoTag dict={dict} show={demo} />
          <span className="etiquette">{dict.common.metrics.indice}</span>
          <span aria-hidden>·</span>
          <span className="chiffres">{updated}</span>
        </p>
      </div>

      {/* À partir de la tablette : des colonnes. */}
      <ol className="trame hidden h-[27rem] gap-2 px-5 pt-6 md:flex" key={mesure}>
        {items.map((item, rang) => (
          <li key={item.id} className="min-w-0 flex-1">
            <Link href={item.href} className="group flex h-full flex-col no-underline" title={`${item.name} — ${item.lab.name}`}>
              {/* La zone de tracé : la colonne s'y mesure en pourcentage, l'étiquette de valeur gardant sa place au-dessus. */}
              <span className="flex min-h-0 flex-1 flex-col justify-end">
                <span className="chiffres mb-1.5 block text-center text-[0.78rem] font-semibold">{valeur(item) === null ? "—" : affiche(item)}</span>
                <span
                  className="mx-auto block w-full max-w-16 origin-bottom rounded-t-[8px] transition-[filter] duration-200 group-hover:brightness-110 group-focus-visible:brightness-110"
                  style={{
                    height: `calc((100% - 1.75rem) * ${valeur(item) === null ? 0 : Math.max(part(item), 0.012)})`,
                    background: serie(item.lab),
                    // Sans délai : une colonne n'attend jamais, invisible, que son tour vienne.
                    animation: `pousse ${600 + rang * 40}ms var(--ease-sortie)`,
                  }}
                />
              </span>
              <span className="flex h-[4.75rem] flex-none flex-col items-center gap-1.5 border-t border-filet-fort pt-2.5">
                <LabMark lab={item.lab} size={18} />
                <span className="line-clamp-2 text-center text-[0.7rem] leading-tight text-encre-pale group-hover:text-encre">
                  {item.name}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {/* Sur téléphone, quinze colonnes ne tiennent pas : des lignes. */}
      <ol className="divide-y divide-filet md:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 no-underline">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <LabMark lab={item.lab} size={18} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="chiffres text-sm font-semibold">{valeur(item) === null ? "—" : affiche(item)}</span>
              <span className="col-span-2 block h-2 overflow-hidden rounded-full bg-creux">
                <span className="block h-full rounded-full" style={{ width: `${part(item) * 100}%`, background: serie(item.lab) }} />
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-filet px-5 py-3">
        <p className="flex items-center gap-2 text-xs text-encre-pale">
          <Icon name="info" size={15} />
          {dict.home.index.note}
        </p>
        <Link href={`/${locale}/benchmarks/indice`} className="bouton">
          {dict.common.labels.viewAll}
          <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </section>
  );
}
