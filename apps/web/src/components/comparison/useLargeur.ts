"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * La largeur réelle du conteneur : les graphiques se dessinent en pixels vrais,
 * sans viewBox étiré, pour que le texte garde sa taille du téléphone à l'écran
 * large. Mesurée avant la première peinture : pas de graphique qui saute.
 */
export function useLargeur<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [largeur, setLargeur] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    setLargeur(Math.round(el.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setLargeur(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, []);

  return [ref, largeur];
}
