"use client";

import Link from "next/link";
import { useId } from "react";
import { fill, href } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { bestOfRow, leadWithinMargin } from "@/lib/comparison";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import type { GroupeAjout } from "./ListeAjout";
import { CelluleScore, EnTeteLigne, TableauModeles } from "./TableauModeles";
import type { ModeleCompare } from "./types";

export type LigneGrille = {
  key: string;
  label: string;
  sub: string;
  icon: IconName;
  lien?: { href: string; label: string };
  /** Ce qu'affiche une cellule vide : « Non classé » pour l'indice, « Non testé » ailleurs. */
  absent: string;
  valeur: (m: ModeleCompare) => number | null;
  marge: (m: ModeleCompare) => number | null;
  detail?: (m: ModeleCompare) => string | undefined;
};

type Props = {
  modeles: ModeleCompare[];
  lignes: LigneGrille[];
  groupesModeles: GroupeAjout[];
  demo: boolean;
  onReplace: (index: number, slug: string) => void;
};

/**
 * La grille : une ligne par indice, métier ou benchmark, une colonne par modèle.
 * Le meilleur de chaque ligne est surligné — et quand son avance tient dans la
 * marge d'erreur, la cellule le dit plutôt que de laisser croire à un vainqueur.
 */
export function Grille({ modeles, lignes, groupesModeles, demo, onReplace }: Props) {
  const { locale, dict } = useI18n();
  const t = dict.comparison;
  const id = useId();

  return (
    <section aria-labelledby={`${id}-titre`} className="panneau">
      <div className="barre">
        <h2 id={`${id}-titre`} className="font-medium">{t.grid.title}</h2>
        <DemoTag dict={dict} show={demo} />
      </div>

      <TableauModeles
        caption={t.grid.caption}
        coin={t.grid.rowHeader}
        modeles={modeles}
        entete={(m, i) => (
          <>
            <span className="flex items-start gap-2">
              <LabMark lab={m.lab} size={20} />
              <span className="min-w-0">
                <Link
                  href={href(locale, `/models/${m.slug}`)}
                  className="block font-semibold leading-tight no-underline hover:underline"
                >
                  {m.name}
                </Link>
                <span className="mt-0.5 block text-xs text-encre-pale">{m.lab.name}</span>
              </span>
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs text-encre-pale">
              <Icon name="swap" size={13} />
              {/* Toujours sur l'option vide : ce menu est une action, pas un état. */}
              <select
                value=""
                aria-label={fill(t.selection.replace, { name: m.name })}
                onChange={(e) => { if (e.target.value !== "") onReplace(i, e.target.value); }}
                className="w-[6.75rem] cursor-pointer appearance-none truncate rounded-[var(--radius-s)] bg-transparent py-0.5 text-xs text-encre-pale underline decoration-filet-fort underline-offset-[0.22em] transition-colors hover:text-encre hover:decoration-vert"
              >
                <option value="" className="bg-surface text-encre">{t.selection.replaceWith}</option>
                {groupesModeles.map((g) => (
                  <optgroup key={g.label} label={g.label} className="bg-surface text-encre">
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.selected} className="bg-surface text-encre">{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </span>
          </>
        )}
      >
        {lignes.map((l) => {
          const valeurs = modeles.map(l.valeur);
          const marges = modeles.map(l.marge);
          const meilleurs = bestOfRow(valeurs);
          const serre = leadWithinMargin(valeurs, marges);
          return (
            <tr key={l.key} className="group">
              <EnTeteLigne icon={l.icon} label={l.label} sub={l.sub} lien={l.lien} />
              {modeles.map((m, i) => (
                <CelluleScore
                  key={m.slug}
                  valeur={valeurs[i] ?? null}
                  marge={marges[i] ?? null}
                  meilleur={meilleurs.includes(i)}
                  exAequo={serre}
                  absent={l.absent}
                  detail={l.detail?.(m)}
                />
              ))}
            </tr>
          );
        })}
      </TableauModeles>

      <p className="border-t border-filet px-5 py-2.5 text-xs text-encre-pale">{t.grid.notes}</p>
    </section>
  );
}
