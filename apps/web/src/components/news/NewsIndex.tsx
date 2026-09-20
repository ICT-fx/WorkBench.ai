"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fill, href } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon } from "@/components/ui/Icon";

export type NewsKind = "modele" | "benchmark" | "analyse" | "annonce";

/** Ce que la liste affiche d'un article : le résumé ne voyage que pour la une. */
export type NewsCard = {
  slug: string;
  kind: NewsKind;
  title: string;
  summary?: string;
  date: string;
  dateLabel: string;
  featured: boolean;
  auto: boolean;
};

const KINDS: NewsKind[] = ["modele", "benchmark", "analyse", "annonce"];
const VISIBLES = 12;
const A_LA_UNE = 3;

type Props = { items: NewsCard[]; demo: boolean };

/**
 * Le filtre vit dans l'URL (`?type=…`) mais se lit côté client : lire
 * `searchParams` dans la page la rendrait dynamique. Rendu sous `<Suspense>`,
 * avec `NewsIndexView` sans filtre comme repli — c'est lui que porte le HTML statique.
 */
export function NewsIndex(props: Props) {
  const demande = useSearchParams().get("type");
  return <NewsIndexView {...props} type={KINDS.find((k) => k === demande) ?? null} />;
}

export function NewsIndexView({ items, demo, type }: Props & { type: NewsKind | null }) {
  const { locale, dict } = useI18n();
  const t = dict.news.index;
  const retenus = type === null ? items : items.filter((n) => n.kind === type);
  const une = retenus.filter((n) => n.featured).slice(0, A_LA_UNE);
  const onglets = [{ id: null, label: t.tabs.all }, ...KINDS.map((k) => ({ id: k, label: t.tabs[k] }))];

  return (
    <>
      <nav aria-label={t.tabsLabel} className="pt-8">
        <div className="segment">
          {onglets.map((o) => (
            <Link
              key={o.id ?? "all"}
              href={href(locale, o.id === null ? "/news" : `/news?type=${o.id}`)}
              aria-current={o.id === type ? "page" : undefined}
              scroll={false}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </nav>

      <header className="max-w-[48rem] pb-12 pt-10 sm:pt-12">
        <h1 className="etendu text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-xl text-encre-pale">{t.lead}</p>
      </header>

      {une.length > 0 && (
        <section aria-labelledby="a-la-une">
          <h2 id="a-la-une" className="etendu text-2xl">{t.featured}</h2>
          <div className={`panneau mt-6 grid ${une.length > 1 ? "md:grid-cols-3" : ""}`}>
            {une.map((n, i) => (
              <article
                key={n.slug}
                className={`relative transition-colors duration-200 hover:bg-vert-brume ${
                  i === 0
                    ? `p-6 sm:p-8 lg:p-10 ${une.length > 1 ? "md:col-span-2 md:border-r md:border-filet" : ""} ${une.length > 2 ? "md:row-span-2" : ""}`
                    : `border-t border-filet p-6 ${i === 1 ? "md:border-t-0" : ""}`
                }`}
              >
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-encre-pale">
                  <span className="pastille">{dict.news.kinds[n.kind]}</span>
                  <time dateTime={n.date} className="chiffres">{n.dateLabel}</time>
                </p>
                <h3 className={i === 0 ? "etendu mt-4 max-w-[22ch] text-3xl sm:text-4xl" : "mt-3 text-lg font-semibold leading-snug"}>
                  <Link href={href(locale, `/news/${n.slug}`)} className="no-underline after:absolute after:inset-0 hover:underline">
                    {n.title}
                  </Link>
                </h3>
                {n.summary !== undefined && (
                  <p className={i === 0 ? "mt-4 max-w-[58ch] text-lg text-encre-pale" : "mt-2 text-sm text-encre-pale"}>{n.summary}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* La clé remet la liste à douze lignes quand on change d'onglet. */}
      <Liste key={type ?? "all"} items={retenus} demo={demo} title={type === null ? t.allArticles : t.tabs[type]} spaced={une.length > 0} />
    </>
  );
}

function Liste({ items, demo, title, spaced }: Props & { title: string; spaced: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.news.index;
  const [deplie, setDeplie] = useState(false);
  const premierRevele = useRef<HTMLAnchorElement>(null);
  const enPlus = items.length - VISIBLES;

  // Au clavier, la suite de la lecture est la première ligne révélée, pas le bouton resté en bas.
  useEffect(() => { if (deplie) premierRevele.current?.focus(); }, [deplie]);

  const accord = (n: number, formes: { one: string; other: string }) => fill(n === 1 ? formes.one : formes.other, { n });

  return (
    <section aria-labelledby="tous-les-articles" className={spaced ? "mt-16" : ""}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="tous-les-articles" className="etendu text-2xl">{title}</h2>
        {items.length > 0 && <p className="chiffres text-sm text-encre-muette">{accord(items.length, t.count)}</p>}
      </div>

      {items.length === 0 ? (
        <div className="panneau mt-6 px-6 py-12 text-center">
          <p className="text-encre-pale">{t.empty}</p>
          <Link href={href(locale, "/news")} scroll={false} className="bouton mt-5">{t.emptyAction}</Link>
        </div>
      ) : (
        <div className="panneau mt-6">
          {/* Toutes les lignes sont dans le HTML, les suivantes masquées : le repli statique et les robots voient chaque lien. */}
          <ul id="liste-articles">
            {items.map((n, i) => (
              <li
                key={n.slug}
                hidden={!deplie && i >= VISIBLES}
                className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-2 border-t border-filet px-5 py-4 transition-colors first:border-t-0 hover:bg-vert-brume sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline [&[hidden]]:hidden"
              >
                <p className="col-start-1 row-start-1"><span className="pastille">{dict.news.kinds[n.kind]}</span></p>
                <time dateTime={n.date} className="chiffres col-start-2 row-start-1 text-sm text-encre-pale sm:col-start-3">{n.dateLabel}</time>
                <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <h3 className="font-medium leading-snug">
                    <Link
                      ref={i === VISIBLES ? premierRevele : undefined}
                      href={href(locale, `/news/${n.slug}`)}
                      className="no-underline after:absolute after:inset-0 hover:underline"
                    >
                      {n.title}
                    </Link>
                  </h3>
                  {n.auto && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-encre-muette">
                      {t.auto}
                      <DemoTag dict={dict} show={demo} />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {enPlus > 0 && (
            <button
              type="button"
              aria-expanded={deplie}
              aria-controls="liste-articles"
              onClick={() => { setDeplie((d) => !d); }}
              className="etiquette flex w-full items-center justify-center gap-2 border-t border-filet bg-vert-brume py-3 transition-colors hover:bg-vert-pale hover:!text-encre"
            >
              {deplie ? dict.common.labels.viewLess : accord(enPlus, t.viewMore)}
              <Icon name="chevron-down" size={14} className={deplie ? "rotate-180" : ""} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
