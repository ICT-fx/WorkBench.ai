import Link from "next/link";
import { href, type Locale } from "@/i18n";

/** Trois barres qui montent, dans un carré adouci : un classement, en un signe. */
export function Logo({ locale, name }: { locale: Locale; name: string }) {
  return (
    <Link href={href(locale)} className="inline-flex items-center gap-2.5 no-underline">
      <svg aria-hidden width="26" height="26" viewBox="0 0 26 26" className="flex-none">
        <rect width="26" height="26" rx="8" fill="var(--color-vert-fonce)" />
        <rect x="6.5" y="13" width="3" height="7" rx="1.2" fill="var(--color-vert-vif)" />
        <rect x="11.5" y="9.5" width="3" height="10.5" rx="1.2" fill="var(--color-sur-vert)" opacity="0.75" />
        <rect x="16.5" y="6" width="3" height="14" rx="1.2" fill="var(--color-sur-vert)" />
      </svg>
      <span className="etendu text-[0.98rem] leading-none">{name}</span>
    </Link>
  );
}
