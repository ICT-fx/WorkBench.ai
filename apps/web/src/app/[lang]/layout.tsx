import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, getDictionary, isLocale } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { getHub } from "@/lib/site";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--police-archivo",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Une langue hors liste est une page inexistante, pas un rendu à la volée.
export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { site } = getDictionary(lang).common;
  return {
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
    description: site.description,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const { hub } = getHub();

  return (
    <html lang={lang} className={archivo.variable}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#contenu"
          className="bouton bouton-plein sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          {dict.common.nav.skip}
        </a>
        <I18nProvider locale={lang} dict={dict}>
          {hub.demo && <DemoBanner locale={lang} dict={dict} />}
          <Header />
          <div id="contenu" className="flex-1">{children}</div>
          <Footer locale={lang} dict={dict} />
        </I18nProvider>
      </body>
    </html>
  );
}
