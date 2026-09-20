import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDictionary, isLocale, tr } from "@/i18n";
import { getHub } from "@/lib/site";
import { modelSlug } from "@/lib/hub";
import { defaultModels, defaultRows, meanMargin } from "@/lib/comparison";
import { Comparateur } from "@/components/comparison/Comparateur";
import type { DonneesComparaison } from "@/components/comparison/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/comparison">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).comparison;
  return {
    title: t.title,
    description: t.description,
    alternates: { languages: { fr: "/fr/comparison", en: "/en/comparison" } },
  };
}

export default async function PageComparaison({ params }: PageProps<"/[lang]/comparison">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.comparison;
  const { hub, domains, benchmarks, leaderboards } = getHub();

  // Un benchmark sans classement publié n'offrirait qu'une ligne de cellules vides.
  const publies = benchmarks.filter((b) => leaderboards.has(b.id));

  // La page reste statique : la sélection vit dans l'URL et se lit côté client.
  // On lui passe donc tous les modèles, réduits à ce que la page affiche.
  const data: DonneesComparaison = {
    models: hub.scores.map((s) => ({
      slug: modelSlug(s.model.id),
      id: s.model.id,
      name: s.model.name,
      lab: { name: s.lab.name, slot: s.lab.slot, monogram: s.lab.monogram, country: s.lab.country },
      released: s.model.released,
      weights: s.model.weights,
      contextWindow: s.model.contextWindow,
      maxOutput: s.model.maxOutput,
      priceIn: s.model.priceIn,
      priceOut: s.model.priceOut,
      modalities: s.model.modalities,
      reasoning: s.model.reasoning,
      indice: s.indice,
      ci: s.ci,
      rank: s.rank,
      cost: s.cost,
      latency: s.latency,
      hallucinations: s.hallucinations,
      byDomain: s.byDomain,
      ciByDomain: Object.fromEntries(domains.map((d) => [
        d.id,
        meanMargin(publies.filter((b) => b.domain === d.id).flatMap((b) => {
          const row = s.byBenchmark[b.id];
          return row === undefined ? [] : [row.ci];
        })),
      ])),
      byBenchmark: Object.fromEntries(Object.entries(s.byBenchmark).map(([id, row]) => [id, {
        exactitude: row.exactitude,
        ci: row.ci ?? null,
        costPerDoc: row.costPerDoc,
        latencyP50: row.latencyP50,
        hallucinations: row.hallucinations,
      }])),
    })),
    domains: domains.map((d) => ({ id: d.id, label: tr(d.label, lang), summary: tr(d.summary, lang), icon: d.icon })),
    benchmarks: publies.map((b) => ({ id: b.id, domain: b.domain, label: tr(b.label, lang), question: tr(b.question, lang) })),
    defaults: { models: defaultModels(hub.scores), rows: defaultRows(domains) },
    ranked: hub.scores.filter((s) => s.rank !== null).length,
    demo: hub.demo,
  };

  return (
    <main className="conteneur pb-8">
      <header className="max-w-[48rem] pb-10 pt-16 sm:pt-20">
        <h1 className="etendu text-4xl sm:text-5xl">{t.heading}</h1>
        <p className="mt-5 text-xl text-encre-pale">{t.intro}</p>
      </header>

      {/* `useSearchParams` renvoie le comparateur au rendu client : la page, elle, reste prérendue. */}
      <Suspense
        fallback={(
          <div role="status" className="panneau">
            <div className="barre"><span className="etiquette">{t.selection.models}</span></div>
            <div className="barre"><span className="etiquette">{t.selection.rows}</span></div>
            <p className="px-5 py-24 text-center text-sm text-encre-pale">{t.loading}</p>
          </div>
        )}
      >
        <Comparateur data={data} />
      </Suspense>
    </main>
  );
}
