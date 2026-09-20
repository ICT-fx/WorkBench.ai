import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, isLocale } from "@/i18n";
import { date } from "@/lib/format";
import { getNews } from "@/lib/news";
import { getHub } from "@/lib/site";
import { NewsIndex, NewsIndexView, type NewsCard } from "@/components/news/NewsIndex";

export async function generateMetadata({ params }: PageProps<"/[lang]/news">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).news.index;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { languages: { fr: "/fr/news", en: "/en/news" } },
  };
}

export default async function PageActualites({ params }: PageProps<"/[lang]/news">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { hub } = getHub();

  // Les dates sont mises en forme ici : le client n'a pas à refaire — ni à contredire — le travail d'Intl.
  const items: NewsCard[] = getNews(lang).map((n) => ({
    slug: n.slug, kind: n.kind, title: n.title, summary: n.featured ? n.summary : undefined,
    date: n.date, dateLabel: date(n.date, lang), featured: n.featured, auto: n.auto,
  }));

  return (
    <main className="conteneur pb-8">
      <Suspense fallback={<NewsIndexView items={items} demo={hub.demo} type={null} />}>
        <NewsIndex items={items} demo={hub.demo} />
      </Suspense>
    </main>
  );
}
