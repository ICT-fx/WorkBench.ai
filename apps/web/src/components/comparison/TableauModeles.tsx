"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { num, pct } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { ModeleCompare } from "./types";

type TableauProps = {
  caption: string;
  /** L'en-tête de la première colonne, celle des libellés de ligne. */
  coin: string;
  modeles: ModeleCompare[];
  entete: (modele: ModeleCompare, index: number) => React.ReactNode;
  /** Colonnes étroites, pour un tableau logé à côté d'un graphique. */
  compact?: boolean;
  children: React.ReactNode;
};

/**
 * Le gabarit des quatre tableaux de la page : une colonne par modèle, toutes de
 * même largeur, et une première colonne collante. Bordures séparées et non
 * fusionnées — une cellule collante laisserait ses filets derrière elle.
 */
export function TableauModeles({ caption, coin, modeles, entete, compact = false, children }: TableauProps) {
  const gabarit = compact
    ? "[--col1:8.5rem] [--coln:5.75rem] sm:[--col1:11.5rem]"
    : "[--col1:9.5rem] [--coln:8.25rem] sm:[--col1:17rem]";

  return (
    <div className="overflow-x-auto">
      <table
        className={`tableau table-fixed border-separate border-spacing-0 ${gabarit}`}
        style={{ minWidth: `calc(var(--col1) + ${modeles.length} * var(--coln))` }}
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-[var(--col1)]" />
          {modeles.map((m) => <col key={m.slug} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-20 border-r border-filet align-bottom">
              <span className="etiquette">{coin}</span>
            </th>
            {/* Clé de position, pas de modèle : remplacer un modèle garde sa colonne, et le focus du menu qui s'y trouve. */}
            {modeles.map((m, i) => (
              <th key={i} scope="col" className={`!whitespace-normal align-top font-normal ${compact ? "!px-2.5" : ""}`}>
                {entete(m, i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

type EnTeteLigneProps = {
  icon?: IconName;
  label: string;
  sub?: string;
  lien?: { href: string; label: string };
  children?: React.ReactNode;
};

/** Le libellé d'une ligne : il reste en vue quand la grille défile sous lui. */
export function EnTeteLigne({ icon, label, sub, lien, children }: EnTeteLigneProps) {
  return (
    <th
      scope="row"
      title={sub}
      className="sticky left-0 z-10 border-r border-filet bg-surface align-top transition-colors duration-[120ms] group-hover:bg-vert-brume"
    >
      <span className="flex items-start gap-2.5">
        {icon !== undefined && <Icon name={icon} size={17} className="mt-[0.2rem] hidden text-vert sm:block" />}
        <span className="min-w-0">
          {lien === undefined ? (
            <span className="font-medium leading-snug">{label}</span>
          ) : (
            <Link href={lien.href} aria-label={lien.label} className="font-medium leading-snug underline decoration-filet-fort underline-offset-[0.22em] transition-colors hover:decoration-vert">
              {label}
            </Link>
          )}
          {children}
          {sub !== undefined && <span className="mt-1 hidden text-xs leading-snug text-encre-pale sm:line-clamp-2">{sub}</span>}
        </span>
      </span>
    </th>
  );
}

type CelluleScoreProps = {
  valeur: number | null;
  marge?: number | null;
  meilleur: boolean;
  /** L'avance du meilleur tient dans la marge d'erreur : on le dit sur sa cellule. */
  exAequo?: boolean;
  absent: string;
  detail?: string;
  compact?: boolean;
};

/** Un score en pourcentage, sa marge, et le fond vert du meilleur de la ligne. */
export function CelluleScore({ valeur, marge = null, meilleur, exAequo = false, absent, detail, compact = false }: CelluleScoreProps) {
  const { locale, dict } = useI18n();
  const classes = `droite chiffres whitespace-nowrap ${compact ? "!px-2.5" : ""}`;

  if (valeur === null) return <td className={`${classes} text-encre-muette`}>{absent}</td>;

  return (
    <td title={detail} className={`${classes} ${meilleur ? "bg-vert-pale font-semibold" : ""}`}>
      {meilleur && exAequo && (
        <abbr title={dict.comparison.grid.tie} className="mr-1.5 cursor-help font-normal text-encre-pale no-underline">≈</abbr>
      )}
      {pct(valeur, locale)}
      {marge !== null && !compact && (
        <span className="ml-1.5 text-xs font-normal text-encre-pale" title={dict.common.metrics.margin}>±{num(marge, locale)}</span>
      )}
    </td>
  );
}
