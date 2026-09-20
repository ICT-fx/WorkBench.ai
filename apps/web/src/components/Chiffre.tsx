/** Une valeur brute de modèle, rendue lisible sans être reformatée. */
export function ValeurBrute({ valeur, abstention }: { valeur: unknown; abstention: string }) {
  if (valeur === null || valeur === undefined) {
    return <span className="text-encre-pale">{abstention}</span>;
  }
  if (typeof valeur === "object") {
    return <span className="chiffres">{JSON.stringify(valeur)}</span>;
  }
  return <span className="chiffres">{String(valeur)}</span>;
}
