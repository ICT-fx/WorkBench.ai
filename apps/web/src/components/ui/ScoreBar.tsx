/** Une barre horizontale sur une piste : la part atteinte d'un maximum. */
export function ScoreBar({ value, max = 100, color = "var(--color-vert)" }: { value: number; max?: number; color?: string }) {
  const part = max <= 0 ? 0 : Math.min(Math.max(value / max, 0), 1);
  return (
    <span aria-hidden className="block h-2 w-full overflow-hidden rounded-full bg-creux">
      <span className="block h-full rounded-full" style={{ width: `${part * 100}%`, background: color }} />
    </span>
  );
}
