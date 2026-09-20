/** Échelles et graduations des graphiques : de l'arithmétique, sans dépendance. */

export type Scale = (value: number) => number;

export const linear = (d0: number, d1: number, r0: number, r1: number): Scale =>
  (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

export const log = (d0: number, d1: number, r0: number, r1: number): Scale => {
  const [l0, l1] = [Math.log10(d0), Math.log10(d1)];
  return (v) => (l1 === l0 ? (r0 + r1) / 2 : r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0));
};

/** Des graduations rondes : 0, 20, 40… plutôt que 17,3 ; 34,6… */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return ticks;
}

/** Graduations d'une échelle logarithmique : 1, 2, 5 par décade, éclaircies si elles se pressent. */
export function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const t = m * 10 ** e;
      if (t >= min * 0.999 && t <= max * 1.001) ticks.push(Number(t.toPrecision(1)));
    }
  }
  return ticks.length > 7 ? ticks.filter((t) => String(t.toExponential()).startsWith("1")) : ticks;
}

/** Les bornes d'un axe de pourcentages : un peu d'air, jamais hors de 0–100. */
export const percentDomain = (values: number[], pad = 5): [number, number] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [Math.max(0, Math.floor((min - pad) / 10) * 10), Math.min(100, Math.ceil((max + pad) / 10) * 10)];
};
