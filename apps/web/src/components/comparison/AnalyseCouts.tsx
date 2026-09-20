"use client";

import { useI18n } from "@/i18n/client";
import { price, usd } from "@/lib/format";
import { bestOfRow, knownAmount } from "@/lib/comparison";
import { DemoTag } from "@/components/ui/DemoTag";
import { Pastille } from "./Legende";
import { EnTeteLigne, TableauModeles } from "./TableauModeles";
import { couleurSerie, type ModeleCompare } from "./types";

/**
 * Ce que coûte un test, puis ce que facture le labo. Un coût nul est un coût
 * inconnu : il s'écrit « Non communiqué » et ne concourt jamais au moins cher.
 */
export function AnalyseCouts({ modeles, demo }: { modeles: ModeleCompare[]; demo: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.comparison.costs;
  const inconnu = dict.common.labels.unknown;

  const couts = modeles.map((m) => knownAmount(m.cost));
  const max = Math.max(0, ...couts.map((c) => c ?? 0));

  const postes: { label: string; valeurs: (number | null)[]; rendu: (n: number) => string }[] = [
    { label: t.average, valeurs: couts, rendu: (n) => usd(n, locale) },
    { label: t.priceIn, valeurs: modeles.map((m) => knownAmount(m.priceIn)), rendu: (n) => price(n, locale) },
    { label: t.priceOut, valeurs: modeles.map((m) => knownAmount(m.priceOut)), rendu: (n) => price(n, locale) },
  ];

  return (
    <div className="panneau">
      <div className="barre">
        <h3 className="font-medium">{t.chart}</h3>
        <DemoTag dict={dict} show={demo} />
      </div>

      {/* Chaque barre porte son nom et sa valeur : la légende est dans la ligne. */}
      <ol className="space-y-3.5 px-5 py-5">
        {modeles.map((m, i) => {
          const cout = couts[i] ?? null;
          return (
            <li key={m.slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7rem]">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Pastille index={i} />
                <span className="truncate">{m.name}</span>
              </span>
              <span className={`chiffres text-right text-sm sm:order-3 ${cout === null ? "text-encre-muette" : "font-semibold"}`}>
                {cout === null ? inconnu : usd(cout, locale)}
              </span>
              <span aria-hidden className="col-span-2 block h-2.5 overflow-hidden rounded-full bg-creux sm:order-2 sm:col-span-1">
                {cout !== null && max > 0 && (
                  <span
                    className="block h-full rounded-full transition-[width] duration-200 ease-[var(--ease-sortie)]"
                    style={{ width: `${Math.max((cout / max) * 100, 1.5)}%`, background: couleurSerie(i) }}
                  />
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-filet">
        <TableauModeles
          caption={t.caption}
          coin={t.column}
          modeles={modeles}
          entete={(m, i) => (
            <span className="flex items-start gap-1.5 text-sm font-medium leading-tight">
              <Pastille index={i} className="mt-[0.3rem]" />
              <span className="min-w-0 break-words">{m.name}</span>
            </span>
          )}
        >
          {postes.map((poste) => {
            const moinsChers = bestOfRow(poste.valeurs, { lowerIsBetter: true });
            return (
              <tr key={poste.label} className="group">
                <EnTeteLigne label={poste.label} />
                {poste.valeurs.map((v, i) => (
                  <td
                    key={modeles[i]?.slug ?? i}
                    className={`droite chiffres whitespace-nowrap ${v === null ? "text-encre-muette" : ""} ${moinsChers.includes(i) ? "bg-vert-pale font-semibold" : ""}`}
                  >
                    {v === null ? inconnu : poste.rendu(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </TableauModeles>
      </div>

      <p className="border-t border-filet px-5 py-2.5 text-xs text-encre-pale">{t.note}</p>
    </div>
  );
}
