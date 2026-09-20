import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fill, getDictionary, href, isLocale } from "@/i18n";
import { modelSlug } from "@/lib/hub";
import { getHub } from "@/lib/site";
import { ModelsView } from "@/components/models/ModelsView";

/** Sans modèle choisi, la page ouvre sur le mieux classé à l'indice métier. */
const parDefaut = () => getHub().hub.scores[0];

export async function generateMetadata({ params }: PageProps<"/[lang]/models">): Promise<Metadata> {
  const { lang } = await params;
  const score = parDefaut();
  if (!isLocale(lang) || score === undefined) return {};
  const dict = getDictionary(lang);
  const fiche = `/models/${modelSlug(score.model.id)}`;
  return {
    title: dict.models.title,
    description: fill(dict.models.meta.indexDescription, { n: getHub().models.length }),
    // Même contenu que la fiche du premier modèle : c'est elle que les moteurs doivent retenir.
    alternates: {
      canonical: href(lang, fiche),
      languages: { fr: href("fr", fiche), en: href("en", fiche) },
    },
  };
}

export default async function Modeles({ params }: PageProps<"/[lang]/models">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const score = parDefaut();
  if (score === undefined) notFound();
  return <ModelsView score={score} lang={lang} dict={getDictionary(lang)} />;
}
