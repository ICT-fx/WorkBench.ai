import { position } from "@/lib/models";

/**
 * La réglette situe un modèle parmi tous les autres : un trait fin par modèle
 * sur l'échelle qui va du minimum au maximum, celui de la fiche mis en avant.
 * Un score seul ne dit rien ; sa place dans la distribution dit s'il est cher,
 * lent ou bon.
 */
export function Reglette({ values, current, scale = "lineaire", label, format }: {
  values: number[];
  /** `null` : la valeur du modèle est inconnue, la réglette ne montre que les autres. */
  current: number | null;
  scale?: "lineaire" | "log";
  /** La lecture de la réglette en une phrase, pour les lecteurs d'écran. */
  label: string;
  /** Met en forme les deux bornes, écrites sous les extrémités. */
  format: (value: number) => string;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Un pour cent de garde à chaque bout : un trait posé sur le bord serait coupé en deux.
  const x = (v: number): string => `${(1 + position(v, min, max, scale) * 98).toFixed(2)}%`;

  return (
    <div>
      <svg role="img" aria-label={label} width="100%" height="28" className="block overflow-visible">
        <line x1="0" x2="100%" y1="19.5" y2="19.5" stroke="var(--color-filet)" shapeRendering="crispEdges" />
        {values.map((v, i) => (
          <line
            key={i}
            x1={x(v)} x2={x(v)} y1="8" y2="19"
            stroke="var(--color-filet-fort)" strokeWidth="1" shapeRendering="crispEdges"
          />
        ))}
        {current !== null && (
          // Un <svg> imbriqué, parce que lui seul accepte une abscisse en pourcentage.
          <svg x={x(current)} overflow="visible">
            <line y1="2" y2="19" stroke="var(--color-vert)" strokeWidth="2" strokeLinecap="round" />
            <path d="M0 21.5 4 27.5H-4Z" fill="var(--color-vert)" />
          </svg>
        )}
      </svg>
      <div className="mt-1.5 flex justify-between gap-3">
        <span className="etiquette normal-case">{format(min)}</span>
        <span className="etiquette normal-case">{format(max)}</span>
      </div>
    </div>
  );
}
