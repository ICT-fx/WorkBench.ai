"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { num, pct } from "@/lib/format";
import { Icon, hasIcon } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import { DemoTag } from "@/components/ui/DemoTag";
import type { LabView } from "@/lib/views";

export type IndexRow = {
  id: string;
  name: string;
  href: string;
  lab: LabView;
  indice: number | null;
  ci: number | null;
  byDomain: Record<string, number | null>;
  taken: number;
};

const VISIBLES = 20;

export function TableauIndice({ rows, domains, total, demo }: {
  rows: IndexRow[];
  domains: { id: string; label: string; icon: string }[];
  total: number;
  demo: boolean;
}) {
  const { locale, dict } = useI18n();
  const [tri, setTri] = useState("indice");
  const [deplie, setDeplie] = useState(false);

  const valeur = (r: IndexRow, col: string): number => (col === "indice" ? r.indice : r.byDomain[col]) ?? -1;
  const triees = useMemo(() => [...rows].sort((a, b) => valeur(b, tri) - valeur(a, tri)), [rows, tri]);
  const meilleurs = useMemo(
    () => Object.fromEntries(["indice", ...domains.map((d) => d.id)].map((c) => [c, Math.max(...rows.map((r) => valeur(r, c)))])),
    [rows, domains],
  );
  const affichees = deplie ? triees : triees.slice(0, VISIBLES);

  const cellule = (r: IndexRow, col: string) => {
    const v = valeur(r, col);
    if (v < 0) return <span className="text-encre-muette">—</span>;
    return <span className={v === meilleurs[col] ? "rounded-[5px] bg-vert-pale px-1.5 py-0.5 font-semibold" : undefined}>{pct(v, locale)}</span>;
  };

  return (
    <section className="panneau">
      <div className="barre">
        <span className="font-medium">{dict.common.metrics.indice}</span>
        <DemoTag dict={dict} show={demo} />
      </div>
      <div className="overflow-x-auto">
        <table className="tableau chiffres">
          <thead>
            <tr>
              <th scope="col" className="w-10"><span className="sr-only">{dict.common.metrics.rank}</span></th>
              <th scope="col" className="sticky left-0 z-10 !bg-creux"><span className="etiquette">{dict.common.labels.model}</span></th>
              {[{ id: "indice", label: dict.common.metrics.indice, icon: "indice" }, ...domains].map((c) => (
                <th key={c.id} scope="col" className="droite" aria-sort={tri === c.id ? "descending" : undefined}>
                  <button
                    type="button"
                    onClick={() => { setTri(c.id); }}
                    title={c.label}
                    className={`etiquette inline-flex items-center gap-1.5 ${tri === c.id ? "!text-encre" : ""}`}
                  >
                    <Icon name={hasIcon(c.icon) ? c.icon : "indice"} size={14} />
                    <span className={c.id === "indice" ? "" : "max-w-[7.5rem] truncate"}>{c.label}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="droite"><span className="etiquette">{dict.benchmarks.index.coverage}</span></th>
            </tr>
          </thead>
          <tbody>
            {affichees.map((r, i) => (
              <tr key={r.id} data-rang={tri === "indice" ? i + 1 : undefined}>
                <td className="text-xs text-encre-muette">{i + 1}</td>
                <th scope="row" className="sticky left-0 z-10 bg-surface">
                  <Link href={r.href} className="flex items-center gap-2.5 whitespace-nowrap no-underline hover:underline" style={{ fontVariantNumeric: "normal" }}>
                    <LabMark lab={r.lab} size={20} />
                    <span className="font-medium">{r.name}</span>
                  </Link>
                </th>
                <td className="droite whitespace-nowrap">
                  {cellule(r, "indice")}
                  {r.ci !== null && <span className="ml-1.5 text-xs text-encre-muette" title={dict.common.metrics.margin}>±{num(r.ci, locale)}</span>}
                </td>
                {domains.map((d) => <td key={d.id} className="droite">{cellule(r, d.id)}</td>)}
                <td className="droite whitespace-nowrap text-encre-pale">{r.taken} / {total}</td>
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
