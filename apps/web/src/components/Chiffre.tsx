export const pourcent = (n: number): string =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

/** Un coût par facture se compte souvent en fractions de centime : on garde
 *  l'euro comme unité, quitte à descendre à quatre décimales. « 0,4 c » ne veut
 *  rien dire pour personne. */
export const euros = (n: number): string =>
  n === 0
    ? "—"
    : n.toLocaleString("fr-FR", {
        style: "currency", currency: "EUR",
        minimumFractionDigits: 2, maximumFractionDigits: 4,
      });

export const secondes = (ms: number): string =>
  ms === 0 ? "—" : `${(ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;

/** Une valeur brute de modèle, rendue lisible sans être reformatée. */
export function ValeurBrute({ valeur }: { valeur: unknown }) {
  if (valeur === null || valeur === undefined) {
    return <span style={{ color: "var(--encre-pale)" }}>rien — le modèle s&apos;abstient</span>;
  }
  if (typeof valeur === "object") {
    return <span className="chiffres">{JSON.stringify(valeur)}</span>;
  }
  return <span className="chiffres">{String(valeur)}</span>;
}
