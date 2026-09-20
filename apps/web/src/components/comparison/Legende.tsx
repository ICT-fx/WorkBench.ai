"use client";

import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { couleurSerie, type ModeleCompare } from "./types";

/** La pastille carrée qui porte la teinte d'une série : le texte, lui, reste à l'encre. */
export function Pastille({ index, className = "" }: { index: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 flex-none rounded-[3px] ${className}`}
      style={{ background: couleurSerie(index) }}
    />
  );
}

type Props = {
  modeles: ModeleCompare[];
  /**
   * Avec `onSurvol`, la légende pilote un graphique : survoler ou cibler un nom
   * met sa série en avant ; cliquer l'épingle, pour les écrans sans survol.
   */
  actif?: number | null;
  epingle?: number | null;
  onSurvol?: (index: number | null) => void;
  onEpingle?: (index: number) => void;
};

/**
 * La légende commune à tous les graphiques de la page : même ordre, mêmes
 * teintes, celles de l'ordre de sélection.
 */
export function Legende({ modeles, actif = null, epingle = null, onSurvol, onEpingle }: Props) {
  const { dict } = useI18n();

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label={dict.common.labels.legend}>
      {modeles.map((m, i) => (
        <li key={m.slug} className="flex">
          {onSurvol === undefined ? (
            <span className="flex items-center gap-1.5 text-xs text-encre-pale">
              <Pastille index={i} />
              {m.name}
            </span>
          ) : (
            <button
              type="button"
              aria-pressed={epingle === i}
              aria-label={fill(dict.comparison.domains.highlight, { name: m.name })}
              className="-mx-1.5 flex min-h-6 items-center gap-1.5 rounded-full px-1.5 text-xs text-encre-pale transition-[opacity,color,background-color] duration-150 hover:text-encre aria-pressed:bg-vert-pale aria-pressed:text-encre"
              style={{ opacity: actif === null || actif === i ? 1 : 0.45 }}
              onMouseEnter={() => { onSurvol(i); }}
              onMouseLeave={() => { onSurvol(null); }}
              onFocus={() => { onSurvol(i); }}
              onBlur={() => { onSurvol(null); }}
              onClick={() => { onEpingle?.(i); }}
            >
              <Pastille index={i} />
              <span aria-hidden>{m.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
