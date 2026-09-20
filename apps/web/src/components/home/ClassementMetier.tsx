"use client";

import Link from "next/link";
import { useState } from "react";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Icon, hasIcon } from "@/components/ui/Icon";
import { DemoTag } from "@/components/ui/DemoTag";
import { NuageCout, type ScatterPoint } from "@/components/charts/NuageCout";

export type DomainTab = {
  id: string;
  label: string;
  icon: string;
  benchmarks: {
    id: string;
    label: string;
    question: string;
    unit: string;
    href: string;
    demo: boolean;
    points: ScatterPoint[];
  }[];
};

/**
 * Le classement, métier par métier : un onglet par métier, puis un benchmark.
 * C'est la réponse à la vraie question du visiteur — pas « quel est le meilleur
 * modèle », mais « lequel pour MON service ».
 */
export function ClassementMetier({ domains, shown }: { domains: DomainTab[]; shown: number }) {
  const { dict } = useI18n();
  const t = dict.home.domains;
  const [domaineId, setDomaineId] = useState(domains[0]?.id ?? "");
  const [choix, setChoix] = useState<Record<string, string>>({});

  const domaine = domains.find((d) => d.id === domaineId) ?? domains[0];
  if (domaine === undefined) return null;
  // Chaque métier se souvient du benchmark qu'on y regardait.
  const benchmark = domaine.benchmarks.find((b) => b.id === choix[domaine.id]) ?? domaine.benchmarks[0];
  if (benchmark === undefined) return null;

  return (
    <section className="panneau">
      <div className="overflow-x-auto border-b border-filet bg-vert-brume px-3 py-2.5" role="group" aria-label={t.pick}>
        <div className="segment !flex-nowrap !bg-transparent lg:!flex-wrap">
          {domains.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={d.id === domaine.id}
              className="flex-none"
              onClick={() => { setDomaineId(d.id); }}
            >
              <Icon name={hasIcon(d.icon) ? d.icon : "indice"} size={15} />
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t.benchmark}>
            {domaine.benchmarks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  aria-pressed={b.id === benchmark.id}
                  onClick={() => { setChoix((c) => ({ ...c, [domaine.id]: b.id })); }}
                  className="border-b-2 border-transparent pb-1 text-[0.95rem] text-encre-pale transition-colors hover:text-encre aria-pressed:border-vert aria-pressed:font-medium aria-pressed:text-encre"
                >
                  {b.label}
                </button>
              </li>
            ))}
          </ul>
          <h3 className="etendu mt-6 text-2xl">{benchmark.label}</h3>
          <p className="mt-2 max-w-[60ch] text-encre-pale">{benchmark.question}</p>
        </div>
        <div className="flex items-center gap-3">
          <DemoTag dict={dict} show={benchmark.demo} />
          <Link href={benchmark.href} className="bouton bouton-plein">
            {dict.common.labels.viewDetails}
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
      </div>

      <div className="border-t border-filet">
        <NuageCout key={benchmark.id} points={benchmark.points} unit={benchmark.unit} />
      </div>
      <p className="border-t border-filet px-5 py-2.5 text-xs text-encre-pale">{fill(t.showing, { n: shown })}</p>
    </section>
  );
}
