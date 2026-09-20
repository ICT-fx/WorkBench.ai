"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fill, href } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { duration, pct, usd } from "@/lib/format";
import {
  INDICE_ROW, MAX_MODELS, added, benchmarkRow, domainRow, parseSelection, removed, replaced,
  resolveSelection, sameList, serializeSelection, type Selection,
} from "@/lib/comparison";
import { hasIcon, type IconName } from "@/components/ui/Icon";
import { AnalyseCouts } from "./AnalyseCouts";
import { FicheTechnique } from "./FicheTechnique";
import { Grille, type LigneGrille } from "./Grille";
import type { GroupeAjout, OptionAjout } from "./ListeAjout";
import { PanneauSelection } from "./PanneauSelection";
import { ParMetier } from "./ParMetier";
import { PerformanceGlobale } from "./PerformanceGlobale";
import type { DonneesComparaison } from "./types";

const icone = (name: string): IconName => (hasIcon(name) ? name : "indice");

/**
 * L'URL est la seule mémoire de la page : la sélection s'en déduit à chaque
 * rendu, et chaque geste la réécrit. L'état optimiste rend le clic instantané
 * pendant que le routeur rattrape l'adresse ; il s'efface de lui-même ensuite.
 */
export function Comparateur({ data }: { data: DonneesComparaison }) {
  const { locale, dict } = useI18n();
  const t = dict.comparison;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [annonce, setAnnonce] = useState("");
  const [, startTransition] = useTransition();

  const parSlug = useMemo(() => new Map(data.models.map((m) => [m.slug, m])), [data.models]);

  const toutesLignes = useMemo((): LigneGrille[] => {
    const metiers = new Map(data.domains.map((d) => [d.id, d]));
    const { metrics, labels } = dict.common;
    return [
      {
        key: INDICE_ROW, label: metrics.indice, sub: metrics.indiceHelp, icon: "indice", absent: labels.notRanked,
        valeur: (m) => m.indice, marge: (m) => m.ci,
      },
      ...data.domains.map((d): LigneGrille => ({
        key: domainRow(d.id), label: d.label, sub: d.summary, icon: icone(d.icon), absent: labels.notTested,
        valeur: (m) => m.byDomain[d.id] ?? null, marge: (m) => m.ciByDomain[d.id] ?? null,
      })),
      ...data.benchmarks.map((b): LigneGrille => ({
        key: benchmarkRow(b.id), label: b.label, sub: b.question, icon: icone(metiers.get(b.domain)?.icon ?? ""),
        lien: { href: href(locale, `/benchmarks/${b.id}`), label: fill(t.grid.benchmarkLink, { name: b.label }) },
        absent: labels.notTested,
        valeur: (m) => m.byBenchmark[b.id]?.exactitude ?? null,
        marge: (m) => m.byBenchmark[b.id]?.ci ?? null,
        detail: (m) => {
          const c = m.byBenchmark[b.id];
          if (c === undefined) return undefined;
          return [
            `${metrics.cost} ${usd(c.costPerDoc, locale)}`,
            `${metrics.latency} ${duration(c.latencyP50, locale)}`,
            `${metrics.hallucinations} ${pct(c.hallucinations, locale)}`,
          ].join(" · ");
        },
      })),
    ];
  }, [data.domains, data.benchmarks, dict, locale, t.grid.benchmarkLink]);

  const connus = useMemo(
    () => ({ models: new Set(parSlug.keys()), rows: new Set(toutesLignes.map((l) => l.key)) }),
    [parSlug, toutesLignes],
  );

  const lue = useMemo(
    () => resolveSelection(parseSelection(searchParams, connus), data.defaults),
    [searchParams, connus, data.defaults],
  );
  const [selection, setOptimiste] = useOptimistic(lue);

  const modeles = useMemo(
    () => selection.models.flatMap((slug) => parSlug.get(slug) ?? []),
    [selection.models, parSlug],
  );
  const lignes = useMemo(
    () => selection.rows.flatMap((key) => toutesLignes.find((l) => l.key === key) ?? []),
    [selection.rows, toutesLignes],
  );

  const groupesModeles = useMemo((): GroupeAjout[] => {
    const parLabo = new Map<string, OptionAjout[]>();
    for (const m of data.models) {
      parLabo.set(m.lab.name, [...(parLabo.get(m.lab.name) ?? []), {
        value: m.slug, label: m.name, keywords: m.id, lab: m.lab,
        hint: m.indice === null ? dict.common.labels.notRanked : pct(m.indice, locale),
        selected: selection.models.includes(m.slug),
      }]);
    }
    // Les labos par ordre alphabétique : on y cherche un nom, pas un classement.
    return [...parLabo.entries()]
      .sort(([a], [b]) => a.localeCompare(b, locale))
      .map(([label, options]) => ({ label, options }));
  }, [data.models, selection.models, dict, locale]);

  const groupesLignes = useMemo((): GroupeAjout[] => {
    const option = (key: string): OptionAjout[] => {
      const l = toutesLignes.find((x) => x.key === key);
      return l === undefined ? [] : [{ value: l.key, label: l.label, keywords: l.sub, icon: l.icon, selected: selection.rows.includes(l.key) }];
    };
    return [
      { label: t.selection.overview, options: option(INDICE_ROW) },
      { label: t.selection.domains, options: data.domains.flatMap((d) => option(domainRow(d.id))) },
      ...data.domains.map((d) => ({
        label: d.label,
        options: data.benchmarks.filter((b) => b.domain === d.id).flatMap((b) => option(benchmarkRow(b.id))),
      })),
    ].filter((g) => g.options.length > 0);
  }, [toutesLignes, selection.rows, data.domains, data.benchmarks, t.selection]);

  const requete = (s: Selection): string => serializeSelection(s, data.defaults.rows);

  const appliquer = (suivante: Selection, message: string) => {
    setAnnonce(message);
    if (sameList(suivante.models, selection.models) && sameList(suivante.rows, selection.rows)) return;
    startTransition(() => {
      setOptimiste(suivante);
      router.replace(`${pathname}?${requete(suivante)}`, { scroll: false });
    });
  };

  const nom = (slug: string): string => parSlug.get(slug)?.name ?? slug;
  const libelle = (key: string): string => toutesLignes.find((l) => l.key === key)?.label ?? key;

  if (modeles.length === 0) {
    return <p className="panneau px-5 py-10 text-center text-encre-pale">{dict.common.labels.noResult}</p>;
  }

  return (
    <>
      <div className="space-y-6">
        <PanneauSelection
          modeles={modeles}
          lignes={lignes.map((l) => ({ key: l.key, label: l.label, icon: l.icon }))}
          groupesModeles={groupesModeles}
          groupesLignes={groupesLignes}
          parDefaut={sameList(selection.models, data.defaults.models) && sameList(selection.rows, data.defaults.rows)}
          lien={() => `${window.location.origin}${pathname}?${requete(selection)}`}
          onAddModel={(slug) => {
            appliquer({ ...selection, models: added(selection.models, slug, MAX_MODELS) }, fill(t.selection.added, { name: nom(slug) }));
          }}
          onRemoveModel={(slug) => {
            appliquer({ ...selection, models: removed(selection.models, slug) }, fill(t.selection.removed, { name: nom(slug) }));
          }}
          onAddRow={(key) => {
            appliquer({ ...selection, rows: added(selection.rows, key) }, fill(t.selection.added, { name: libelle(key) }));
          }}
          onRemoveRow={(key) => {
            appliquer({ ...selection, rows: removed(selection.rows, key) }, fill(t.selection.removed, { name: libelle(key) }));
          }}
          onReset={() => {
            setAnnonce(t.selection.wasReset);
            startTransition(() => {
              setOptimiste(data.defaults);
              router.replace(pathname, { scroll: false });
            });
          }}
        />

        <Grille
          modeles={modeles}
          lignes={lignes}
          groupesModeles={groupesModeles}
          demo={data.demo}
          onReplace={(index, slug) => {
            const sortant = selection.models[index];
            appliquer(
              { ...selection, models: replaced(selection.models, index, slug) },
              fill(t.selection.swapped, { old: sortant === undefined ? "" : nom(sortant), name: nom(slug) }),
            );
          }}
        />
      </div>

      <Section titre={t.overall.title} chapeau={t.overall.lead}>
        <PerformanceGlobale modeles={modeles} ranked={data.ranked} demo={data.demo} />
      </Section>

      <Section titre={t.domains.title} chapeau={t.domains.lead}>
        <ParMetier modeles={modeles} domains={data.domains} demo={data.demo} />
      </Section>

      <Section titre={t.costs.title} chapeau={t.costs.lead}>
        <AnalyseCouts modeles={modeles} demo={data.demo} />
      </Section>

      <Section titre={t.specs.title} chapeau={t.specs.lead}>
        <FicheTechnique modeles={modeles} demo={data.demo} />
      </Section>

      <p role="status" aria-live="polite" className="sr-only">{annonce}</p>
    </>
  );
}

function Section({ titre, chapeau, children }: { titre: string; chapeau: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="etendu text-2xl">{titre}</h2>
      <p className="mt-2 max-w-[64ch] text-encre-pale">{chapeau}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
