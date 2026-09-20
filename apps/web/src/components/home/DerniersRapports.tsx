"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { pct } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import { DemoTag } from "@/components/ui/DemoTag";
import { ScoreBar } from "@/components/ui/ScoreBar";
import type { LabView } from "@/lib/views";

export type Report = {
  slug: string;
  href: string;
  date: string;
  kind: string;
  title: string;
  summary: string;
  bullets: string[];
  /** Le petit classement qui accompagne l'article, quand il porte sur un benchmark ou un modèle. */
  side: { title: string; href: string; demo: boolean; rows: { label: string; value: number; lab?: LabView }[] } | null;
};

export function DerniersRapports({ reports }: { reports: Report[] }) {
  const { locale, dict } = useI18n();
  const [i, setI] = useState(0);
  const r = reports[i];
  if (r === undefined) return null;

  return (
    <div>
      <div className="overflow-x-auto pb-1" role="group" aria-label={dict.home.reports.title}>
        <div className="segment !flex-nowrap">
          {reports.map((rep, n) => (
            <button key={rep.slug} type="button" aria-pressed={n === i} className="max-w-[17rem] flex-none" onClick={() => { setI(n); }}>
              <span className="truncate normal-case tracking-normal">{rep.title}</span>
            </button>
          ))}
        </div>
      </div>

      <article key={r.slug} className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]" style={{ animation: "apparait 350ms var(--ease-sortie)" }}>
        <div>
          <p className="flex items-center gap-2.5 text-sm text-encre-pale">
            <span className="pastille">{r.kind}</span>
            <span className="chiffres">{r.date}</span>
          </p>
          <h3 className="etendu mt-3 text-2xl sm:text-[1.7rem]">
            <Link href={r.href} className="no-underline hover:underline">{r.title}</Link>
          </h3>
          <p className="mt-3 max-w-[60ch] text-encre-pale">{r.summary}</p>
          {r.bullets.length > 0 && (
            <ul className="prose-hub mt-5 list-disc pl-5 text-[0.95rem]">
              {r.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
          <Link href={r.href} className="bouton mt-7">
            {dict.home.reports.read}
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>

        {r.side !== null && (
          <aside className="panneau self-start">
            <div className="barre">
              <Link href={r.side.href} className="text-sm font-medium no-underline hover:underline">{r.side.title}</Link>
              <DemoTag dict={dict} show={r.side.demo} />
            </div>
            <ol className="divide-y divide-filet">
              {r.side.rows.map((row, n) => (
                <li key={row.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm">
                  <span className="chiffres text-xs text-encre-muette">{n + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    {row.lab !== undefined && <LabMark lab={row.lab} size={16} />}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="chiffres font-medium">{pct(row.value, locale)}</span>
                  <span className="col-span-2 col-start-2"><ScoreBar value={row.value} /></span>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </article>
    </div>
  );
}
