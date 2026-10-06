"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LOCALES, href, type Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/Icon";
import { EDITEUR } from "@/lib/editeur";
import { Logo } from "./Logo";

const LIENS = ["benchmarks", "models", "comparison", "news", "about"] as const;

/** Le même chemin dans l'autre langue, requête comprise : changer de langue ne perd pas une comparaison en cours. */
function LangSwitch() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const autre: Locale = LOCALES.find((l) => l !== locale) ?? locale;
  const chemin = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${autre}`);

  return (
    <Link
      href={search === "" ? chemin : `${chemin}?${search}`}
      hrefLang={autre}
      lang={autre}
      className="bouton !px-3 !py-1.5 !text-[0.78rem]"
      aria-label={`${dict.common.nav.language} : ${dict.common.nav.switchTo}`}
    >
      <Icon name="globe" size={15} />
      {dict.common.nav.switchTo}
    </Link>
  );
}

export function Header() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);

  // Le menu mobile se referme à chaque navigation.
  useEffect(() => { setOuvert(false); }, [pathname]);

  const actif = (lien: string) => pathname.startsWith(href(locale, `/${lien}`));

  return (
    <header className="sticky top-0 z-40 border-b border-filet bg-papier/90 backdrop-blur-md">
      <div className="conteneur flex h-16 items-center justify-between gap-6">
        <Logo locale={locale} name={dict.common.site.name} />

        <nav aria-label={dict.common.nav.menu} className="hidden items-center gap-1 lg:flex">
          {LIENS.map((lien) => (
            <Link
              key={lien}
              href={href(locale, `/${lien}`)}
              aria-current={actif(lien) ? "page" : undefined}
              className="rounded-full px-3.5 py-1.5 text-[0.92rem] text-encre-pale no-underline transition-colors hover:bg-creux hover:text-encre aria-[current=page]:bg-vert-pale aria-[current=page]:text-encre"
            >
              {dict.common.nav[lien]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Le hub et le site de l'éditeur se répondent : d'ici on repart chez Flowera. */}
          <a
            href={EDITEUR.url}
            className="bouton !px-3 !py-1.5 !text-[0.78rem]"
            aria-label={dict.common.nav.publisher}
          >
            {EDITEUR.nom}
            <Icon name="arrow-up-right" size={15} />
          </a>
          <Suspense fallback={null}><LangSwitch /></Suspense>
          <button
            type="button"
            className="bouton !p-2 lg:hidden"
            aria-expanded={ouvert}
            aria-controls="menu-mobile"
            onClick={() => { setOuvert((o) => !o); }}
          >
            <Icon name={ouvert ? "close" : "menu"} />
            <span className="sr-only">{ouvert ? dict.common.nav.close : dict.common.nav.menu}</span>
          </button>
        </div>
      </div>

      {ouvert && (
        <nav id="menu-mobile" aria-label={dict.common.nav.menu} className="border-t border-filet bg-surface lg:hidden">
          <ul className="conteneur py-2">
            {LIENS.map((lien) => (
              <li key={lien}>
                <Link
                  href={href(locale, `/${lien}`)}
                  aria-current={actif(lien) ? "page" : undefined}
                  className="flex items-center justify-between border-b border-filet py-3.5 text-lg no-underline aria-[current=page]:font-semibold"
                >
                  {dict.common.nav[lien]}
                  <Icon name="arrow-right" className="text-encre-muette" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
