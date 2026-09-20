import Link from "next/link";
import { href, type Dictionary, type Locale } from "@/i18n";

export function DemoBanner({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.common.demo;
  return (
    <div className="border-b border-ambre-filet bg-ambre-pale text-ambre">
      <p className="conteneur py-2 text-[0.82rem] leading-snug">
        <strong className="font-semibold">{t.bannerTitle}</strong> {t.banner}{" "}
        <Link href={href(locale, "/about/methodology#demo")} className="whitespace-nowrap underline">
          {t.bannerLink}
        </Link>
      </p>
    </div>
  );
}
