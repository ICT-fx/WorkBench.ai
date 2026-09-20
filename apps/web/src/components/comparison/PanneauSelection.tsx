"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { MAX_MODELS } from "@/lib/comparison";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import { Legende } from "./Legende";
import { ListeAjout, type GroupeAjout } from "./ListeAjout";
import type { ModeleCompare } from "./types";

export type PuceLigne = { key: string; label: string; icon: IconName };

type Props = {
  modeles: ModeleCompare[];
  lignes: PuceLigne[];
  groupesModeles: GroupeAjout[];
  groupesLignes: GroupeAjout[];
  /** La sélection affichée est celle par défaut : rien à réinitialiser. */
  parDefaut: boolean;
  /** L'adresse complète qui restitue la sélection affichée. */
  lien: () => string;
  onAddModel: (slug: string) => void;
  onRemoveModel: (slug: string) => void;
  onAddRow: (key: string) => void;
  onRemoveRow: (key: string) => void;
  onReset: () => void;
};

type Barre = "modeles" | "lignes";

function Puce({ barre, label, retirer, verrou, onRemove, children }: {
  barre: Barre;
  label: string;
  retirer: string;
  /** Dernière puce de sa barre : elle ne se retire pas, et dit pourquoi. */
  verrou?: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="inline-flex max-w-full items-center gap-2 rounded-full border border-filet-fort bg-surface py-[0.2rem] pl-2 pr-1 text-sm">
      {children}
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        data-retirer={barre}
        aria-label={retirer}
        title={verrou ?? retirer}
        disabled={verrou !== undefined}
        onClick={onRemove}
        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-encre-pale transition-colors duration-150 hover:bg-creux hover:text-encre disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Icon name="close" size={13} />
      </button>
    </li>
  );
}

/**
 * Les deux barres de sélection. Les puces disent ce qui est comparé, les menus
 * ajoutent, et le pied du panneau donne la clé des couleurs que tous les
 * graphiques de la page reprennent.
 */
export function PanneauSelection({
  modeles, lignes, groupesModeles, groupesLignes, parDefaut, lien,
  onAddModel, onRemoveModel, onAddRow, onRemoveRow, onReset,
}: Props) {
  const { dict } = useI18n();
  const t = dict.comparison.selection;
  const id = useId();
  const zoneRef = useRef<HTMLElement | null>(null);
  const ajoutModeleRef = useRef<HTMLButtonElement | null>(null);
  const ajoutLigneRef = useRef<HTMLButtonElement | null>(null);
  const [copie, setCopie] = useState<"repos" | "ok" | "echec">("repos");
  const [aCibler, setACibler] = useState<{ barre: Barre; index: number; taille: number } | null>(null);

  const plein = modeles.length >= MAX_MODELS;
  const toutesLignes = groupesLignes.every((g) => g.options.every((o) => o.selected));
  const tailleCiblee = aCibler === null ? null : aCibler.barre === "modeles" ? modeles.length : lignes.length;

  // La puce retirée emporte le focus avec elle : on le rend à sa voisine, pour
  // qu'un retrait au clavier en appelle un autre sans repartir du haut de la page.
  // On attend que la barre ait réellement rétréci avant de chercher cette voisine.
  useEffect(() => {
    if (aCibler === null || tailleCiblee === aCibler.taille) return;
    const boutons = zoneRef.current?.querySelectorAll<HTMLButtonElement>(`[data-retirer="${aCibler.barre}"]:not(:disabled)`);
    const voisine = boutons?.[Math.min(aCibler.index, (boutons.length || 1) - 1)];
    (voisine ?? (aCibler.barre === "modeles" ? ajoutModeleRef : ajoutLigneRef).current)?.focus();
    setACibler(null);
  }, [aCibler, tailleCiblee]);

  useEffect(() => {
    if (copie === "repos") return;
    const retour = setTimeout(() => { setCopie("repos"); }, copie === "ok" ? 2000 : 6000);
    return () => { clearTimeout(retour); };
  }, [copie]);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien());
      setCopie("ok");
    } catch {
      // Contexte non sécurisé ou permission refusée : l'adresse reste dans la barre du navigateur.
      setCopie("echec");
    }
  };

  return (
    <section ref={zoneRef} aria-labelledby={`${id}-titre`} className="panneau">
      <h2 id={`${id}-titre`} className="sr-only">{t.heading}</h2>

      <div className="barre items-start">
        <p className="etiquette flex flex-none items-baseline gap-2 pt-[0.55rem] sm:w-36">
          {t.models}
          <span className="chiffres normal-case tracking-normal">{fill(t.count, { n: modeles.length, max: MAX_MODELS })}</span>
        </p>
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-0">
          <ul className="contents">
            {modeles.map((m, i) => (
              <Puce
                key={m.slug}
                barre="modeles"
                label={m.name}
                retirer={fill(t.remove, { name: m.name })}
                verrou={modeles.length <= 1 ? t.lastModel : undefined}
                onRemove={() => {
                  setACibler({ barre: "modeles", index: i, taille: modeles.length });
                  onRemoveModel(m.slug);
                }}
              >
                <LabMark lab={m.lab} size={20} />
              </Puce>
            ))}
          </ul>
          <ListeAjout
            label={t.addModel}
            placeholder={t.searchModel}
            groupes={groupesModeles}
            onPick={onAddModel}
            blocked={plein}
            describedBy={plein ? `${id}-plein` : undefined}
            buttonRef={ajoutModeleRef}
          />
          {plein && <p id={`${id}-plein`} className="basis-full text-xs text-encre-pale sm:basis-auto">{t.maxReached}</p>}
          {modeles.length === 1 && (
            <p className="flex basis-full items-center gap-1.5 text-xs text-encre-pale sm:basis-auto">
              <Icon name="info" size={14} />
              {t.addOne}
            </p>
          )}
        </div>
      </div>

      <div className="barre items-start">
        <p className="etiquette flex-none pt-[0.55rem] sm:w-36">{t.rows}</p>
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-0">
          <ul className="contents">
            {lignes.map((l, i) => (
              <Puce
                key={l.key}
                barre="lignes"
                label={l.label}
                retirer={fill(t.remove, { name: l.label })}
                verrou={lignes.length <= 1 ? t.lastRow : undefined}
                onRemove={() => {
                  setACibler({ barre: "lignes", index: i, taille: lignes.length });
                  onRemoveRow(l.key);
                }}
              >
                <Icon name={l.icon} size={16} className="ml-0.5 text-vert" />
              </Puce>
            ))}
          </ul>
          <ListeAjout
            label={t.addRow}
            placeholder={t.searchRow}
            groupes={groupesLignes}
            onPick={onAddRow}
            blocked={toutesLignes}
            describedBy={toutesLignes ? `${id}-lignes` : undefined}
            buttonRef={ajoutLigneRef}
          />
          {toutesLignes && <p id={`${id}-lignes`} className="basis-full text-xs text-encre-pale sm:basis-auto">{t.allRows}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="etiquette">{t.colours}</span>
          <Legende modeles={modeles} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!parDefaut && (
            <button type="button" className="bouton !py-1.5 !text-[0.82rem]" title={t.resetHelp} onClick={onReset}>
              {t.reset}
            </button>
          )}
          <button type="button" className="bouton bouton-plein !py-1.5 !text-[0.82rem]" onClick={() => { void copier(); }}>
            <Icon name={copie === "ok" ? "check" : "link"} size={15} />
            <span>{copie === "ok" ? t.copied : t.copy}</span>
          </button>
          <p role="status" aria-live="polite" className={copie === "echec" ? "basis-full text-xs text-rouge" : "sr-only"}>
            {copie === "ok" ? t.copied : copie === "echec" ? t.copyFailed : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
