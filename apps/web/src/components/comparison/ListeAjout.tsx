"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { matchesQuery } from "@/lib/comparison";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import type { LaboCompare } from "./types";

export type OptionAjout = {
  value: string;
  label: string;
  /** Texte sur lequel porte aussi la recherche, sans être affiché. */
  keywords?: string;
  /** Un repère chiffré à droite du libellé : l'indice d'un modèle. */
  hint?: string;
  lab?: LaboCompare;
  icon?: IconName;
  /** Déjà dans la comparaison : visible pour se repérer, mais plus sélectionnable. */
  selected: boolean;
};

export type GroupeAjout = { label: string; options: OptionAjout[] };

type Props = {
  label: string;
  placeholder: string;
  groupes: GroupeAjout[];
  onPick: (value: string) => void;
  /** Plus rien à ajouter : le bouton reste atteignable au clavier, l'explication le suit. */
  blocked?: boolean;
  describedBy?: string;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
};

const LARGEUR = 352;
const HAUTEUR = 432;
const GOUTTIERE = 16;
const ECART = 6;

const filtrer = (groupes: GroupeAjout[], requete: string): GroupeAjout[] =>
  groupes
    .map((g) => ({ ...g, options: g.options.filter((o) => matchesQuery(requete, o.label, g.label, o.keywords ?? "")) }))
    .filter((g) => g.options.length > 0);

const premiereLibre = (groupes: GroupeAjout[]): string | null =>
  groupes.flatMap((g) => g.options).find((o) => !o.selected)?.value ?? null;

/**
 * Le menu d'ajout : un champ de recherche et une liste groupée, dans un popover
 * natif. La couche supérieure du navigateur le sort du panneau (`overflow: clip`
 * le rognerait) et lui donne Échap, le clic au-dehors et le retour du focus —
 * sans modale, sans portail, sans z-index à arbitrer.
 */
export function ListeAjout({ label, placeholder, groupes, onPick, blocked = false, describedBy, buttonRef }: Props) {
  const { dict } = useI18n();
  const id = useId();
  const listId = `${id}-liste`;
  const ownButtonRef = useRef<HTMLButtonElement | null>(null);
  const boutonRef = buttonRef ?? ownButtonRef;
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState("");
  const [actif, setActif] = useState<string | null>(null);

  const visibles = useMemo(() => filtrer(groupes, requete), [groupes, requete]);
  const choisissables = useMemo(() => visibles.flatMap((g) => g.options).filter((o) => !o.selected), [visibles]);

  const fermer = useCallback(() => {
    const el = popoverRef.current;
    if (el !== null && el.matches(":popover-open")) el.hidePopover();
  }, []);

  // Le popover est en `position: fixed` : on le pose sous son bouton, ou
  // au-dessus quand la place manque, sans jamais sortir de l'écran.
  const placer = useCallback(() => {
    const bouton = boutonRef.current;
    const el = popoverRef.current;
    if (bouton === null || el === null) return;
    const b = bouton.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    // Le bouton a quitté l'écran : un menu flottant sans ancre n'a plus de sens.
    if (b.bottom < 0 || b.top > vh) { fermer(); return; }
    const largeur = Math.min(LARGEUR, vw - 2 * GOUTTIERE);
    const dessous = vh - b.bottom - ECART - GOUTTIERE;
    const dessus = b.top - ECART - GOUTTIERE;
    const versLeHaut = dessous < 260 && dessus > dessous;
    el.style.width = `${largeur}px`;
    el.style.left = `${Math.max(GOUTTIERE, Math.min(b.left, vw - GOUTTIERE - largeur))}px`;
    el.style.maxHeight = `${Math.max(180, Math.min(HAUTEUR, versLeHaut ? dessus : dessous))}px`;
    el.style.top = versLeHaut ? "auto" : `${b.bottom + ECART}px`;
    el.style.bottom = versLeHaut ? `${vh - b.top + ECART}px` : "auto";
  }, [boutonRef, fermer]);

  useEffect(() => {
    if (!ouvert) return;
    const suivre = (e: Event) => {
      // La liste défile dans le popover : ce défilement-là ne déplace rien.
      if (e.target instanceof Node && popoverRef.current?.contains(e.target) === true) return;
      placer();
    };
    window.addEventListener("scroll", suivre, { capture: true, passive: true });
    window.addEventListener("resize", suivre);
    return () => {
      window.removeEventListener("scroll", suivre, { capture: true });
      window.removeEventListener("resize", suivre);
    };
  }, [ouvert, placer]);

  useEffect(() => {
    if (!ouvert || actif === null) return;
    document.getElementById(`${listId}-${actif}`)?.scrollIntoView({ block: "nearest" });
  }, [ouvert, actif, listId]);

  const choisir = (value: string) => {
    onPick(value);
    fermer();
    boutonRef.current?.focus();
  };

  const deplacer = (pas: 1 | -1 | "debut" | "fin") => {
    if (choisissables.length === 0) return;
    const courant = choisissables.findIndex((o) => o.value === actif);
    const cible = pas === "debut" ? 0
      : pas === "fin" ? choisissables.length - 1
      : courant < 0 ? (pas === 1 ? 0 : choisissables.length - 1)
      : (courant + pas + choisissables.length) % choisissables.length;
    setActif(choisissables[cible]?.value ?? null);
  };

  const auClavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); deplacer(1); break;
      case "ArrowUp": e.preventDefault(); deplacer(-1); break;
      case "Home": e.preventDefault(); deplacer("debut"); break;
      case "End": e.preventDefault(); deplacer("fin"); break;
      case "Enter":
        e.preventDefault();
        if (actif !== null && choisissables.some((o) => o.value === actif)) choisir(actif);
        break;
      case "Escape":
        // Le popover natif s'en charge déjà ; ceci couvre un navigateur qui ne le ferait pas.
        fermer();
        break;
    }
  };

  return (
    <>
      <button
        ref={boutonRef}
        type="button"
        className="bouton !py-1.5 !pl-3.5 !pr-3 !text-[0.82rem]"
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-disabled={blocked || undefined}
        aria-describedby={describedBy}
        onClick={(e) => { if (blocked) e.preventDefault(); }}
      >
        {label}
        {/* `.bouton` pousse sa dernière icône vers la droite au survol : bon pour une flèche, pas pour un chevron de menu. */}
        <Icon name="chevron-down" size={15} className={`!transform-none transition-[rotate] duration-200 ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {/* Pas de `flex` ni de `grid` sur le popover lui-même : la classe écraserait le `display: none` de l'état fermé. */}
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className="fixed inset-auto m-0 overflow-hidden rounded-[var(--radius-m)] border border-filet-fort bg-surface p-0 text-encre shadow-[0_12px_32px_-14px_color-mix(in_oklab,var(--color-encre)_50%,transparent)]"
        onBeforeToggle={(e) => { if (e.newState === "open") placer(); }}
        onToggle={(e) => {
          const ouvre = e.newState === "open";
          setOuvert(ouvre);
          if (!ouvre) return;
          setRequete("");
          setActif(premiereLibre(groupes));
          inputRef.current?.focus();
        }}
        onBlur={(e) => {
          // Tabuler hors du menu le referme : un menu resté ouvert loin du focus désoriente.
          if (e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) fermer();
        }}
      >
        <div className="flex max-h-[inherit] animate-[apparait_180ms_var(--ease-sortie)] flex-col">
          <div className="relative flex-none border-b border-filet p-2">
            <Icon name="search" size={16} className="pointer-events-none absolute left-[1.1rem] top-1/2 -translate-y-1/2 text-encre-muette" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={actif === null ? undefined : `${listId}-${actif}`}
              aria-label={placeholder}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className="champ !pl-9"
              value={requete}
              onChange={(e) => {
                setRequete(e.target.value);
                setActif(premiereLibre(filtrer(groupes, e.target.value)));
              }}
              onKeyDown={auClavier}
            />
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label={label}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
            // Cliquer dans la liste ne doit pas retirer le focus du champ de recherche.
            onMouseDown={(e) => { e.preventDefault(); }}
          >
            {visibles.length === 0 && (
              <p className="px-2.5 py-6 text-center text-sm text-encre-pale">{dict.common.labels.noResult}</p>
            )}
            {visibles.map((g, gi) => (
              <div key={g.label} role="group" aria-labelledby={`${listId}-g${gi}`}>
                <div id={`${listId}-g${gi}`} className="etiquette px-2.5 pb-1.5 pt-3">{g.label}</div>
                {g.options.map((o) => (
                  <div
                    key={o.value}
                    id={`${listId}-${o.value}`}
                    role="option"
                    aria-selected={o.value === actif}
                    aria-disabled={o.selected || undefined}
                    className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[var(--radius-s)] px-2.5 py-1.5 text-sm aria-disabled:cursor-default aria-disabled:text-encre-muette aria-selected:bg-vert-pale"
                    onMouseMove={() => { if (!o.selected && actif !== o.value) setActif(o.value); }}
                    onClick={() => { if (!o.selected) choisir(o.value); }}
                  >
                    {o.lab !== undefined && <LabMark lab={o.lab} size={18} />}
                    {o.icon !== undefined && <Icon name={o.icon} size={16} className="text-encre-pale" />}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.selected ? (
                      <>
                        <Icon name="check" size={15} />
                        <span className="sr-only">{dict.comparison.selection.already}</span>
                      </>
                    ) : o.hint !== undefined && (
                      <span className="chiffres flex-none text-xs text-encre-pale">{o.hint}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
