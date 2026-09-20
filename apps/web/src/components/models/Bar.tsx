/**
 * Une barre horizontale : une piste en creux, un remplissage arrondi. La valeur
 * s'écrit toujours à côté — la barre aide à comparer, elle ne porte pas le chiffre.
 */
export function Bar({ ratio, color }: {
  /** De 0 à 1 ; tout ce qui dépasse est ramené dans la piste. */
  ratio: number;
  color: string;
}) {
  const largeur = Math.min(1, Math.max(0, ratio)) * 100;
  return (
    <span aria-hidden className="block h-2 w-full overflow-hidden rounded-full bg-creux">
      {largeur > 0 && (
        // Une valeur infime garde un ergot visible : « presque rien » n'est pas « rien ».
        <span
          className="block h-full min-w-1 rounded-full transition-[width] duration-200 ease-sortie"
          style={{ width: `${largeur}%`, background: color }}
        />
      )}
    </span>
  );
}
