"use client";

import Link from "next/link";
import { href } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/Icon";

export default function Introuvable() {
  const { locale, dict } = useI18n();
  const t = dict.common.notFound;
  return (
    <main className="conteneur py-28">
      <h1 className="etendu max-w-[18ch] text-4xl sm:text-5xl">{t.title}</h1>
      <p className="mt-5 max-w-[52ch] text-lg text-encre-pale">{t.body}</p>
      <Link href={href(locale)} className="bouton bouton-plein mt-8">
        {t.home}
        <Icon name="arrow-right" size={15} />
      </Link>
    </main>
  );
}
