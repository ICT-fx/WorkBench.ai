import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fill, getDictionary, href, isLocale, tr } from "@/i18n";
import { typo } from "@/lib/news";
import { getHub } from "@/lib/site";
import { EDITEUR } from "@/lib/editeur";
import { Icon } from "@/components/ui/Icon";
import { AboutTabs } from "@/components/about/AboutTabs";
import { content } from "@/components/about/content";
import { Prose } from "@/components/news/Prose";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).about.about;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { languages: { fr: "/fr/about", en: "/en/about" } },
  };
}

export default async function PageAPropos({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.about.about;
  const c = content[lang].about;
  const { hub, benchmarks } = getHub();

  const executables = benchmarks.filter((b) => b.maturity === "pipeline");
  const limites = [
    ...c.limits.body,
    // L'état d'avancement se lit dans les données : la phrase ne survit pas à ce qu'elle décrit.
    ...(hub.demo
      ? [fill(c.limits.progress, {
          executables: executables.length, total: benchmarks.length,
          names: executables.map((b) => tr(b.label, lang)).join(", "),
        })]
      : []),
    c.limits.closing,
  ];

  return (
    <main className="conteneur pb-8">
      <AboutTabs locale={lang} dict={dict} current="about" />

      <header className="max-w-[48rem] pt-10 sm:pt-12">
        <h1 className="etendu text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-xl text-encre-pale">{typo(t.lead, lang)}</p>
      </header>

      <div className="max-w-[68ch]">
        {[...c.sections, { ...c.limits, body: limites }].map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`titre-${s.id}`} className="mt-14 scroll-mt-24">
            <h2 id={`titre-${s.id}`} className="etendu text-2xl">{s.title}</h2>
            <Prose body={s.body} locale={lang} className="mt-5" />
          </section>
        ))}

        <section id={c.publisher.id} aria-labelledby={`titre-${c.publisher.id}`} className="mt-14 scroll-mt-24">
          <h2 id={`titre-${c.publisher.id}`} className="etendu text-2xl">{c.publisher.title}</h2>
          <div className="prose-hub mt-5">
            <p>
              {c.publisher.before}
              <a href={EDITEUR.url} rel="noopener">{c.publisher.link}</a>
              {c.publisher.after}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href={href(lang, "/about/methodology")} className="bouton bouton-plein">
          {t.ctaMethodology}
          <Icon name="arrow-right" size={15} />
        </Link>
        <Link href={href(lang, "/benchmarks")} className="bouton">
          {t.ctaBenchmarks}
          <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </main>
  );
}
