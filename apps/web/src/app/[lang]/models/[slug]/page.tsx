import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fill, getDictionary, href, isLocale } from "@/i18n";
import { modelSlug } from "@/lib/hub";
import { getHub } from "@/lib/site";
import { ModelsView } from "@/components/models/ModelsView";

export function generateStaticParams() {
  return getHub().models.map((m) => ({ slug: modelSlug(m.id) }));
}

// Un modèle hors catalogue est une page inexistante, pas un rendu à la volée.
export const dynamicParams = false;

const findScore = (slug: string) => getHub().hub.scores.find((s) => modelSlug(s.model.id) === slug);

export async function generateMetadata({ params }: PageProps<"/[lang]/models/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const score = findScore(slug);
  if (!isLocale(lang) || score === undefined) return {};
  // Les benchmarks mesurés, et non le catalogue : une fiche ne porte de
  // résultats que là où une mesure existe.
  const mesures = getHub().leaderboards.size;
  const meta = getDictionary(lang).models.meta;
  return {
    title: score.model.name,
    description: fill(mesures === 1 ? meta.descriptionOne : meta.description, {
      model: score.model.name, lab: score.lab.name, n: mesures,
    }),
    alternates: {
      canonical: href(lang, `/models/${slug}`),
      languages: { fr: href("fr", `/models/${slug}`), en: href("en", `/models/${slug}`) },
    },
  };
}

export default async function FicheModele({ params }: PageProps<"/[lang]/models/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const score = findScore(slug);
  if (score === undefined) notFound();
  return <ModelsView score={score} lang={lang} dict={getDictionary(lang)} />;
}
