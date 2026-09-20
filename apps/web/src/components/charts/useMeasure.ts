"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La largeur réelle du conteneur. Les graphiques se dessinent en pixels vrais
 * plutôt qu'avec un viewBox étiré : le texte garde sa taille à toutes les largeurs.
 */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => { observer.disconnect(); };
  }, []);

  return [ref, width];
}
