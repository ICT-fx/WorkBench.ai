"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/Icon";

export type TickerItem = { href: string; date: string; title: string };

/** Le fil d'actualités sous l'en-tête. Il avance seul, sauf si on le regarde ou qu'on y navigue. */
export function Ticker({ items }: { items: TickerItem[] }) {
  const { dict } = useI18n();
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);

  useEffect(() => {
    if (pause || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => { setI((n) => (n + 1) % items.length); }, 6000);
    return () => { window.clearInterval(id); };
  }, [pause, items.length]);

  const item = items[i];
  if (item === undefined) return null;
  const aller = (pas: number) => { setI((n) => (n + pas + items.length) % items.length); };

  return (
    <div
      className="border-b border-filet bg-vert-brume"
      onMouseEnter={() => { setPause(true); }}
      onMouseLeave={() => { setPause(false); }}
      onFocus={() => { setPause(true); }}
      onBlur={() => { setPause(false); }}
    >
      <div className="conteneur flex items-center gap-2 py-1.5" role="group" aria-label={dict.home.ticker.label}>
        <button type="button" className="rounded-full p-1.5 text-encre-pale hover:bg-creux hover:text-encre" onClick={() => { aller(-1); }}>
          <Icon name="chevron-left" size={16} />
          <span className="sr-only">{dict.home.ticker.prev}</span>
        </button>
        <Link
          key={item.href}
          href={item.href}
          className="flex min-w-0 flex-1 items-baseline justify-center gap-3 text-sm no-underline hover:underline"
          style={{ animation: "apparait 400ms var(--ease-sortie)" }}
          aria-live="off"
        >
          <span className="chiffres flex-none text-xs text-encre-pale">{item.date}</span>
          <span className="truncate">{item.title}</span>
        </Link>
        <button type="button" className="rounded-full p-1.5 text-encre-pale hover:bg-creux hover:text-encre" onClick={() => { aller(1); }}>
          <Icon name="chevron-right" size={16} />
          <span className="sr-only">{dict.home.ticker.next}</span>
        </button>
      </div>
    </div>
  );
}
