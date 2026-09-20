import type { Lab } from "@hub/schema";

/** La teinte d'un labo dans les graphiques : fixe pour les huit principaux, gris pour les autres. */
export const serie = (lab: Pick<Lab, "slot">): string =>
  `var(--color-serie-${lab.slot ?? "autre"})`;

export const surSerie = (lab: Pick<Lab, "slot">): string =>
  `var(--color-sur-serie-${lab.slot ?? "autre"})`;

/**
 * Le repère d'un labo : sa teinte et son monogramme. Le monogramme n'est pas un
 * ornement — c'est lui qui identifie le labo quand la couleur ne suffit pas.
 */
export function LabMark({ lab, size = 20 }: { lab: Pick<Lab, "slot" | "monogram" | "name">; size?: number }) {
  return (
    <span
      aria-hidden
      title={lab.name}
      className="inline-flex flex-none items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: serie(lab),
        color: surSerie(lab),
        fontSize: size * (lab.monogram.length > 1 ? 0.42 : 0.52),
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      {lab.monogram}
    </span>
  );
}
