import type {
  Benchmark, BenchmarkHistory, Domain, Lab, Leaderboard, LeaderboardRow, Model,
} from "@hub/schema";

/**
 * Tout ce que le site calcule à partir des classements publiés.
 *
 * Module pur, sans accès disque : les pages serveur lui passent les données, les
 * composants client reçoivent son résultat. C'est aussi ce qui le rend testable.
 */

export type HubInput = {
  labs: Lab[];
  models: Model[];
  domains: Domain[];
  benchmarks: Benchmark[];
  leaderboards: Leaderboard[];
};

export type ModelScore = {
  model: Model;
  lab: Lab;
  /** Moyenne des scores par métier ; `null` tant qu'un métier manque. */
  indice: number | null;
  ci: number | null;
  rank: number | null;
  byDomain: Record<string, number | null>;
  byBenchmark: Record<string, LeaderboardRow>;
  /** Rang du modèle sur chaque benchmark passé, et nombre de modèles classés. */
  ranks: Record<string, { rank: number; of: number }>;
  /** Moyennes sur les benchmarks passés. Coût en dollars par cas de test. */
  cost: number | null;
  latency: number | null;
  hallucinations: number | null;
  benchmarksTaken: number;
};

export type Hub = {
  scores: ModelScore[];
  /** Au moins un classement affiché est une démonstration. */
  demo: boolean;
  /** Date du run le plus récent parmi les classements publiés. */
  updated: string;
  /**
   * L'étendue de ce que l'indice couvre réellement.
   *
   * Un indice calculé sur un métier ne vaut pas un indice calculé sur dix, et le
   * site doit afficher lequel des deux il montre. Sans ces compteurs, un visiteur
   * lirait « indice métier » comme un verdict général alors qu'il ne porte que
   * sur les tâches déjà mesurées.
   */
  coverage: {
    domainsMeasured: number;
    domainsTotal: number;
    benchmarksMeasured: number;
    benchmarksTotal: number;
    /** Les métiers portant au moins une mesure, dans l'ordre du catalogue. */
    domains: string[];
  };
};

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** L'identifiant d'un modèle contient « / » et « . » : l'URL les remplace. */
export const modelSlug = (id: string): string => id.replace("/", "_").replaceAll(".", "-");

export function buildHub(input: HubInput): Hub {
  const labById = new Map(input.labs.map((l) => [l.id, l]));
  const benchmarkById = new Map(input.benchmarks.map((b) => [b.id, b]));
  const published = input.leaderboards.filter((lb) => benchmarkById.has(lb.taskId));
  const mesures = new Set(published.map((lb) => lb.taskId));
  // Les métiers dotés d'au moins une mesure. Les autres ne rendent pas l'indice
  // incomparable : ils le rendent partiel, ce que le site affiche.
  const metiersMesures = input.domains
    .filter((d) => input.benchmarks.some((b) => b.domain === d.id && mesures.has(b.id)))
    .map((d) => d.id);

  const scores = input.models.map((model): ModelScore => {
    const lab = labById.get(model.lab);
    if (lab === undefined) throw new Error(`Labo inconnu pour ${model.id} : ${model.lab}`);

    const byBenchmark: Record<string, LeaderboardRow> = {};
    const ranks: ModelScore["ranks"] = {};
    for (const lb of published) {
      const sorted = [...lb.rows].sort((a, b) => b.exactitude - a.exactitude);
      const i = sorted.findIndex((r) => r.model === model.id);
      if (i < 0) continue;
      byBenchmark[lb.taskId] = sorted[i]!;
      ranks[lb.taskId] = { rank: i + 1, of: sorted.length };
    }

    const byDomain: Record<string, number | null> = {};
    for (const d of input.domains) {
      const taken = input.benchmarks
        .filter((b) => b.domain === d.id && byBenchmark[b.id] !== undefined)
        .map((b) => byBenchmark[b.id]!.exactitude);
      const m = mean(taken);
      byDomain[d.id] = m === null ? null : round1(m);
    }

    // L'indice pèse chaque métier à égalité, pas chaque benchmark : un métier
    // doté de trois tests ne doit pas compter trois fois. Il ne porte que sur
    // les métiers mesurés — un métier sans benchmark publié n'est pas un trou
    // dans la note du modèle, et l'étendue réelle s'affiche à côté de l'indice.
    // En revanche un modèle absent de l'un des métiers mesurés n'est pas classé :
    // sa note ne se comparerait pas à celle des autres.
    const domainScores = metiersMesures.map((id) => byDomain[id] ?? null);
    const complet = domainScores.length > 0 && domainScores.every((s) => s !== null);
    const rows = Object.values(byBenchmark);
    const cis = rows.map((r) => r.ci).filter((c): c is number => c !== undefined);
    const couts = rows.map((r) => r.costPerDoc).filter((c) => c > 0);

    return {
      model, lab, byDomain, byBenchmark, ranks,
      indice: complet ? round1(mean(domainScores as number[])!) : null,
      ci: complet && cis.length === rows.length && rows.length > 0
        ? round1(Math.sqrt(cis.reduce((a, c) => a + c * c, 0)) / cis.length)
        : null,
      rank: null,
      cost: mean(couts),
      latency: mean(rows.map((r) => r.latencyP50)),
      hallucinations: rows.length === 0 ? null : round1(mean(rows.map((r) => r.hallucinations))!),
      benchmarksTaken: rows.length,
    };
  });

  // À indice égal — et sur une tâche facile, vingt modèles peuvent être parfaits —
  // c'est le prix qui départage, puis la rapidité. Même règle que dans un
  // classement de benchmark : deux critères mesurés plutôt qu'un ordre arbitraire.
  const classes = scores.filter((s) => s.indice !== null).sort((a, b) =>
    b.indice! - a.indice! ||
    (a.cost ?? Infinity) - (b.cost ?? Infinity) ||
    (a.latency ?? Infinity) - (b.latency ?? Infinity));
  classes.forEach((s, i) => { s.rank = i + 1; });

  return {
    scores: [...classes, ...scores.filter((s) => s.indice === null)],
    demo: published.some((lb) => lb.status === "demo"),
    updated: published.map((lb) => lb.runDate).sort().at(-1) ?? "",
    coverage: {
      domainsMeasured: metiersMesures.length,
      domainsTotal: input.domains.length,
      benchmarksMeasured: mesures.size,
      benchmarksTotal: input.benchmarks.length,
      domains: metiersMesures,
    },
  };
}

/** Le meilleur modèle classé de chaque labo, du meilleur indice au moins bon. */
export function bestPerLab(scores: ModelScore[]): ModelScore[] {
  const best = new Map<string, ModelScore>();
  for (const s of scores) {
    if (s.indice === null) continue;
    const current = best.get(s.lab.id);
    if (current === undefined || s.indice > current.indice!) best.set(s.lab.id, s);
  }
  return [...best.values()].sort((a, b) => b.indice! - a.indice!);
}

export type Point = { id: string; x: number; y: number };

/**
 * Les points qu'aucun autre ne domine : pas plus cher ET au moins aussi précis.
 * Rendus du moins cher au plus cher, ce qui est aussi l'ordre du tracé.
 */
export function paretoFront(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || b.y - a.y);
  const front: Point[] = [];
  let best = -Infinity;
  for (const p of sorted) {
    if (p.y > best) { front.push(p); best = p.y; }
  }
  return front;
}

export type FrontierPoint = { date: string; value: number; modelId: string; modelName: string };

/**
 * La frontière d'un groupe de modèles : à chaque sortie, le meilleur score
 * atteint jusque-là. Une sortie qui ne bat pas le record ne crée pas de point.
 */
export function frontier(scores: ModelScore[], value: (s: ModelScore) => number | null): FrontierPoint[] {
  const dated = scores
    .map((s) => ({ s, v: value(s) }))
    .filter((x): x is { s: ModelScore; v: number } => x.v !== null)
    .sort((a, b) => a.s.model.released.localeCompare(b.s.model.released));

  const out: FrontierPoint[] = [];
  let record = -Infinity;
  for (const { s, v } of dated) {
    if (v <= record) continue;
    record = v;
    out.push({ date: s.model.released, value: v, modelId: s.model.id, modelName: s.model.name });
  }
  return out;
}

/**
 * Deux scores égaux, ou séparés par moins que la plus large de leurs deux marges,
 * ne sont pas départagés. L'égalité se dit à part : deux modèles à 100 % ont une
 * marge nulle, et « 0 < 0 » les aurait déclarés départagés.
 */
export const indistinguishable = (a: LeaderboardRow, b: LeaderboardRow): boolean =>
  a.exactitude === b.exactitude || Math.abs(a.exactitude - b.exactitude) < Math.max(a.ci ?? 0, b.ci ?? 0);

/**
 * Le meilleur rapport précision-prix : le moins cher parmi les modèles à moins
 * de `tolerance` points du premier. Sans ce plancher, le moins cher gagnerait
 * toujours, fût-il inutilisable.
 */
export function bestValue(rows: LeaderboardRow[], tolerance = 5): LeaderboardRow | null {
  const top = Math.max(...rows.map((r) => r.exactitude));
  const proches = rows.filter((r) => r.costPerDoc > 0 && r.exactitude >= top - tolerance);
  return proches.length === 0 ? null : proches.reduce((a, b) => (b.costPerDoc < a.costPerDoc ? b : a));
}

/** L'exactitude d'un modèle à chaque run passé d'un benchmark : la dérive se lit ici. */
export function modelHistory(history: BenchmarkHistory, modelId: string): { date: string; value: number }[] {
  return history.runs.flatMap((run) => {
    const row = run.rows.find((r) => r.model === modelId);
    return row === undefined ? [] : [{ date: run.runDate, value: row.exactitude }];
  });
}

/** Le meilleur score connu à chaque run : l'état de l'art tel qu'on le mesurait alors. */
export function stateOfTheArt(history: BenchmarkHistory): { date: string; value: number; modelId: string }[] {
  return history.runs.flatMap((run) => {
    const best = [...run.rows].sort((a, b) => b.exactitude - a.exactitude)[0];
    return best === undefined ? [] : [{ date: run.runDate, value: best.exactitude, modelId: best.model }];
  });
}
