import Link from "next/link";
import { fill, href, type Dictionary, type Locale } from "@/i18n";
import { date } from "@/lib/format";
import { getHub } from "@/lib/site";
import { EDITEUR } from "@/lib/editeur";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "./Logo";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { nav, footer } = dict.common;
  const { pricesSyncedAt } = getHub();
  const liens = [
    { to: "/benchmarks", label: nav.benchmarks },
    { to: "/models", label: nav.models },
    { to: "/comparison", label: nav.comparison },
    { to: "/news", label: nav.news },
    { to: "/about", label: nav.about },
    { to: "/about/methodology", label: footer.methodology },
  ];

  return (
    <footer className="mt-28 border-t border-filet bg-surface">
      <div className="conteneur grid gap-10 py-12 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div>
          <Logo locale={locale} name={dict.common.site.name} />
          <p className="mt-4 max-w-[56ch] text-sm text-encre-pale">
            {footer.publishedBy} {footer.verifiable}
          </p>
          <p className="mt-3 max-w-[56ch] text-xs text-encre-muette">
            {fill(footer.pricesSynced, { date: date(pricesSyncedAt, locale, "long") })}
          </p>
          <a href={EDITEUR.url} className="bouton mt-5">
            {footer.visitPublisher}
            <Icon name="arrow-up-right" size={15} />
          </a>
        </div>
        <nav aria-label={dict.common.site.name}>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {liens.map((l) => (
              <li key={l.to}>
                <Link href={href(locale, l.to)} className="text-encre-pale no-underline hover:text-encre hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
