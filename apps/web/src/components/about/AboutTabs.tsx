import Link from "next/link";
import { href, type Dictionary, type Locale } from "@/i18n";

/** Les deux pages de la rubrique, en onglets : chacune sait laquelle elle est, sans lire l'URL. */
export function AboutTabs({ locale, dict, current }: { locale: Locale; dict: Dictionary; current: "about" | "methodology" }) {
  const t = dict.about.tabs;
  const onglets = [
    { id: "about", to: "/about", label: t.about },
    { id: "methodology", to: "/about/methodology", label: t.methodology },
  ] as const;

  return (
    <nav aria-label={t.label} className="pt-8">
      <div className="segment">
        {onglets.map((o) => (
          <Link key={o.id} href={href(locale, o.to)} aria-current={o.id === current ? "page" : undefined}>
            {o.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
