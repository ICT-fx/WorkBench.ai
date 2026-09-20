"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fill, href } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import {
  NO_FILTER, filterModels, sortModels, type ListFilters, type ListSort, type ModelListItem,
} from "@/lib/models";

/** Au-delà, la liste se replie derrière « Voir N modèles de plus ». */
const LIMITE = 25;

type Reglages = ListFilters & { sort: ListSort; deplie: boolean };

const REGLAGES_INITIAUX: Reglages = { ...NO_FILTER, sort: "date", deplie: false };

/*
  Chaque fiche est une page : passer d'un modèle à l'autre remonte la liste.
  Ses réglages vivent donc hors de React, dans ce module, pour qu'un filtre posé
  survive au clic qu'il sert à préparer. Un rechargement repart de zéro, comme
  le rendu serveur — il n'y a donc jamais d'écart à l'hydratation.
*/
let reglages = REGLAGES_INITIAUX;
let defilement = 0;
const abonnes = new Set<() => void>();

const memoire = {
  subscribe(prevenir: () => void) {
    abonnes.add(prevenir);
    return () => { abonnes.delete(prevenir); };
  },
  lire: () => reglages,
  lireServeur: () => REGLAGES_INITIAUX,
  ecrire(changement: Partial<Reglages>) {
    reglages = { ...reglages, ...changement };
    abonnes.forEach((prevenir) => { prevenir(); });
  },
};

export function ModelList({ items, current }: { items: ModelListItem[]; current: string }) {
  const { locale, dict } = useI18n();
  const t = dict.models.list;
  const { labels } = dict.common;
  const pays = dict.common.countries as Record<string, string>;
  const id = useId();
  const zone = useRef<HTMLDivElement>(null);
  const r = useSyncExternalStore(memoire.subscribe, memoire.lire, memoire.lireServeur);

  const labos = useMemo(
    () => [...new Map(items.map((m) => [m.labId, m.labName])).entries()].sort(([, a], [, b]) => (a < b ? -1 : 1)),
    [items],
  );
  const codesPays = useMemo(() => {
    const ordre = new Intl.Collator(locale);
    return [...new Set(items.map((m) => m.country))].sort((a, b) => ordre.compare(pays[a] ?? a, pays[b] ?? b));
  }, [items, locale, pays]);
  const triees = useMemo(() => sortModels(filterModels(items, r), r.sort), [items, r]);

  // Le modèle affiché doit rester dans la liste : s'il tombe sous le pli, la liste s'ouvre d'elle-même.
  const sousLePli = triees.findIndex((m) => m.slug === current) >= LIMITE;
  const toutMontrer = r.deplie || sousLePli;
  const visibles = toutMontrer ? triees : triees.slice(0, LIMITE);
  const filtre = r.weights !== "tous" || r.lab !== "" || r.country !== "" || r.query.trim() !== "";

  // Au montage, la liste reprend là où le lecteur l'avait laissée, puis ramène
  // la ligne du modèle affiché dans le cadre si elle en est sortie.
  useLayoutEffect(() => {
    const cadre = zone.current;
    if (cadre === null) return;
    cadre.scrollTop = defilement;
    const ligne = cadre.querySelector<HTMLElement>('[aria-current="page"]');
    if (ligne === null) return;
    const c = cadre.getBoundingClientRect();
    const l = ligne.getBoundingClientRect();
    if (l.top < c.top || l.bottom > c.bottom) cadre.scrollTop += l.top - c.top - (c.height - l.height) / 2;
  }, [current]);

  // Un nouveau filtre change la liste du tout au tout : on la reprend par le haut.
  const regler = (changement: Partial<Reglages>) => {
    memoire.ecrire(changement);
    if (zone.current !== null) zone.current.scrollTop = 0;
  };

  return (
    <div className="panneau lg:flex lg:max-h-[calc(100dvh-6.5rem)] lg:flex-col">
      {/*
        Sous « lg », la liste se range derrière ce <details> pour laisser la fiche
        visible d'emblée. Il ne contient que son résumé : la liste est sa voisine,
        et non son contenu, parce qu'aucun CSS ne sait rouvrir de force un
        <details> fermé — or sur grand écran elle doit rester ouverte.
      */}
      <details className="group peer lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors duration-150 ease-sortie hover:bg-vert-brume [&::-webkit-details-marker]:hidden">
          <span className="font-medium">{t.choose}</span>
          <span className="ml-auto text-sm text-encre-pale">{fill(t.total, { n: items.length })}</span>
          <Icon name="chevron-down" className="text-encre-pale transition-transform duration-200 ease-sortie group-open:rotate-180" />
        </summary>
      </details>

      <nav
        aria-label={t.navLabel}
        className="hidden min-h-0 flex-1 flex-col border-t border-filet peer-open:flex lg:flex lg:border-t-0"
      >
        <a href="#fiche" className="bouton sr-only focus:not-sr-only focus:m-3 focus:self-start">
          {t.skipToSheet}
        </a>

        <div className="grid flex-none grid-cols-2 gap-2 border-b border-filet bg-vert-brume p-3 sm:max-lg:grid-cols-3">
          <div className="relative col-span-full">
            <label htmlFor={`${id}-q`} className="sr-only">{t.searchLabel}</label>
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-encre-pale" />
            <input
              id={`${id}-q`}
              type="search"
              className="champ !pl-9"
              placeholder={t.searchPlaceholder}
              autoComplete="off"
              value={r.query}
              onChange={(e) => { regler({ query: e.target.value }); }}
            />
          </div>

          <label htmlFor={`${id}-poids`} className="sr-only">{labels.weights}</label>
          <select
            id={`${id}-poids`}
            className="champ"
            value={r.weights}
            onChange={(e) => { regler({ weights: e.target.value as ListFilters["weights"] }); }}
          >
            <option value="tous">{t.allWeights}</option>
            <option value="ouverts">{labels.openWeights}</option>
            <option value="fermes">{labels.closedWeights}</option>
          </select>

          <label htmlFor={`${id}-labo`} className="sr-only">{labels.lab}</label>
          <select
            id={`${id}-labo`}
            className="champ"
            value={r.lab}
            onChange={(e) => { regler({ lab: e.target.value }); }}
          >
            <option value="">{labels.allLabs}</option>
            {labos.map(([labId, nom]) => <option key={labId} value={labId}>{nom}</option>)}
          </select>

          <label htmlFor={`${id}-pays`} className="sr-only">{labels.country}</label>
          <select
            id={`${id}-pays`}
            className="champ"
            value={r.country}
            onChange={(e) => { regler({ country: e.target.value }); }}
          >
            <option value="">{t.allCountries}</option>
            {codesPays.map((code) => <option key={code} value={code}>{pays[code] ?? code}</option>)}
          </select>

          <div className="flex min-h-10 items-center justify-between gap-2 pl-1 text-sm text-encre-pale sm:max-lg:col-span-full">
            <p role="status" className="chiffres">
              {filtre ? fill(t.filtered, { n: triees.length, total: items.length }) : fill(t.total, { n: items.length })}
            </p>
            {filtre && (
              <button
                type="button"
                className="rounded-full px-2 py-1 font-medium text-vert underline transition-colors duration-150 ease-sortie hover:bg-vert-pale"
                onClick={() => { regler(NO_FILTER); }}
              >
                {t.reset}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-filet px-3 py-2">
          <span id={`${id}-tri`} className="etiquette pl-1">{t.sortBy}</span>
          <div role="group" aria-labelledby={`${id}-tri`} className="segment">
            <button type="button" aria-pressed={r.sort === "date"} onClick={() => { regler({ sort: "date" }); }}>
              {t.sortDate}
            </button>
            <button type="button" aria-pressed={r.sort === "indice"} onClick={() => { regler({ sort: "indice" }); }}>
              {t.sortIndex}
            </button>
          </div>
        </div>

        <div
          ref={zone}
          className="min-h-0 flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]"
          onScroll={(e) => { defilement = e.currentTarget.scrollTop; }}
        >
          {triees.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-encre-pale">{t.empty}</p>
              <button type="button" className="bouton mt-4" onClick={() => { regler(NO_FILTER); }}>
                {t.resetFilters}
              </button>
            </div>
          ) : (
            <>
              <ol>
                {visibles.map((m) => (
                  <li key={m.slug} className="border-b border-filet last:border-b-0">
                    <Ligne
                      modele={m}
                      courant={m.slug === current}
                      adresse={href(locale, `/models/${m.slug}`)}
                      nomPays={pays[m.country] ?? m.country}
                      rang={m.rank === null ? t.notRanked : fill(t.rank, { rank: m.rank })}
                    />
                  </li>
                ))}
              </ol>
              {triees.length > LIMITE && !sousLePli && (
                <div className="border-t border-filet p-3 text-center">
                  <button type="button" className="bouton" onClick={() => { memoire.ecrire({ deplie: !r.deplie }); }}>
                    {r.deplie ? labels.viewLess : fill(labels.viewMore, { n: triees.length - LIMITE })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </nav>
    </div>
  );
}

function Ligne({ modele: m, courant, adresse, nomPays, rang }: {
  modele: ModelListItem;
  courant: boolean;
  adresse: string;
  nomPays: string;
  rang: string;
}) {
  // Cinquante fiches préchargées dès l'affichage, ce serait beaucoup de réseau
  // pour un seul clic : on attend que le lecteur s'approche d'une ligne.
  const [vise, setVise] = useState(false);
  const viser = () => { setVise(true); };

  return (
    <Link
      href={adresse}
      prefetch={vise ? null : false}
      onPointerEnter={viser}
      onFocus={viser}
      aria-current={courant ? "page" : undefined}
      className="group/ligne flex min-h-11 items-center gap-2.5 px-3 py-1.5 text-[0.9rem] no-underline transition-colors duration-150 ease-sortie hover:bg-vert-brume focus-visible:-outline-offset-2 aria-[current=page]:bg-vert-fonce aria-[current=page]:text-sur-vert lg:min-h-10"
    >
      <span className="chiffres w-[5.1rem] flex-none text-[0.78rem] text-encre-pale group-aria-[current=page]/ligne:text-sur-vert">
        {m.releasedLabel}
      </span>
      <LabMark lab={{ slot: m.slot, monogram: m.monogram, name: m.labName }} />
      <span className="min-w-0 flex-1 truncate font-medium" title={m.name}>
        {m.name}
        <span className="sr-only">, {m.labName}</span>
      </span>
      <span className="pastille" title={nomPays}>
        <span aria-hidden>{m.country}</span>
        <span className="sr-only">{nomPays}</span>
      </span>
      {courant ? (
        <span className="flex w-6 flex-none justify-end">
          <Icon name="arrow-right" size={16} />
          <span className="sr-only">{rang}</span>
        </span>
      ) : (
        <span className="chiffres w-6 flex-none text-right text-xs text-encre-pale" title={rang}>
          <span aria-hidden>{m.rank ?? "—"}</span>
          <span className="sr-only">{rang}</span>
        </span>
      )}
    </Link>
  );
}
