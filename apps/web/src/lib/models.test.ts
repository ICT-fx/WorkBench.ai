import { describe, expect, it } from "vitest";
import type { BenchmarkHistory } from "@hub/schema";
import {
  NO_FILTER, axisRange, filterModels, ordinal, position, readsDocuments, runsByBenchmark,
  sortModels, standing, timePositions, type ModelListItem,
} from "./models";

const item = (slug: string, over: Partial<ModelListItem> = {}): ModelListItem => ({
  slug, name: slug, labId: "labo", labName: "Labo", monogram: "L", country: "FR", weights: "fermes",
  released: "2026-01-01", releasedLabel: "1 janv. 2026", indice: 50, rank: 1, ...over,
});

const history = (benchmarkId: string, runs: [string, Record<string, number>][]): BenchmarkHistory => ({
  benchmarkId,
  runs: runs.map(([runDate, scores]) => ({
    runId: `${runDate}_${benchmarkId}`, runDate, status: "reel",
    rows: Object.entries(scores).map(([model, exactitude]) => ({ model, exactitude, costPerDoc: 0.01, latencyP50: 1000 })),
  })),
});

describe("filtres de la liste des modèles", () => {
  const items = [
    item("claude", { name: "Claude Opus 5", labId: "anthropic", labName: "Anthropic", country: "US" }),
    item("mistral", { name: "Mistral Large 3", labId: "mistral", labName: "Mistral AI", weights: "ouverts" }),
    item("qwen", { name: "Qwen 3.8 Max", labId: "alibaba", labName: "Alibaba", country: "CN", weights: null }),
  ];
  const slugs = (xs: ModelListItem[]) => xs.map((x) => x.slug);

  it("rend toute la liste tant qu'aucun filtre n'est posé", () => {
    expect(slugs(filterModels(items, NO_FILTER))).toEqual(["claude", "mistral", "qwen"]);
  });

  it("croise les poids, le labo et le pays", () => {
    expect(slugs(filterModels(items, { ...NO_FILTER, weights: "ouverts" }))).toEqual(["mistral"]);
    expect(slugs(filterModels(items, { ...NO_FILTER, country: "CN" }))).toEqual(["qwen"]);
    expect(slugs(filterModels(items, { ...NO_FILTER, lab: "anthropic", country: "FR" }))).toEqual([]);
  });

  it("ne range pas un modèle aux poids non vérifiés parmi les propriétaires", () => {
    expect(slugs(filterModels(items, { ...NO_FILTER, weights: "fermes" }))).toEqual(["claude"]);
  });

  it("cherche sans tenir compte de la casse ni des accents, dans le nom du modèle comme du labo", () => {
    expect(slugs(filterModels(items, { ...NO_FILTER, query: "  MISTRAL " }))).toEqual(["mistral"]);
    expect(slugs(filterModels(items, { ...NO_FILTER, query: "ànthropic" }))).toEqual(["claude"]);
  });

  it("exige chaque mot de la recherche, dans n'importe quel ordre", () => {
    expect(slugs(filterModels(items, { ...NO_FILTER, query: "5 claude" }))).toEqual(["claude"]);
    expect(slugs(filterModels(items, { ...NO_FILTER, query: "claude max" }))).toEqual([]);
  });
});

describe("tri de la liste des modèles", () => {
  const items = [
    item("ancien", { released: "2025-04-05", rank: 1 }),
    item("recent", { released: "2026-09-10", rank: 3 }),
    item("jumeau-b", { released: "2026-07-09", rank: 4 }),
    item("jumeau-a", { released: "2026-07-09", rank: 2 }),
    item("non-classe", { released: "2026-08-01", rank: null, indice: null }),
  ];

  it("place les sorties les plus récentes en tête, et départage une même date par le rang", () => {
    expect(sortModels(items, "date").map((x) => x.slug))
      .toEqual(["recent", "non-classe", "jumeau-a", "jumeau-b", "ancien"]);
  });

  it("suit le rang à l'indice, les modèles non classés en dernier", () => {
    expect(sortModels(items, "indice").map((x) => x.slug))
      .toEqual(["ancien", "jumeau-a", "recent", "jumeau-b", "non-classe"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const avant = items.map((x) => x.slug);
    sortModels(items, "indice");
    expect(items.map((x) => x.slug)).toEqual(avant);
  });
});

describe("réglette de distribution", () => {
  it("situe une valeur entre le minimum et le maximum", () => {
    expect(position(50, 0, 100)).toBe(0.5);
    expect(position(48.4, 48.4, 79.6)).toBe(0);
    expect(position(79.6, 48.4, 79.6)).toBe(1);
  });

  it("étale les coûts sur une échelle logarithmique : un facteur dix vaut partout la même distance", () => {
    expect(position(0.01, 0.001, 0.1, "log")).toBeCloseTo(0.5);
    expect(position(0.1, 0.001, 1, "log")).toBeCloseTo(2 / 3);
  });

  it("ne sort jamais de la réglette", () => {
    expect(position(120, 0, 100)).toBe(1);
    expect(position(-5, 0, 100)).toBe(0);
  });

  it("centre le trait quand toutes les valeurs se confondent", () => {
    expect(position(3, 3, 3)).toBe(0.5);
  });

  it("revient à l'échelle linéaire si un coût nul rend le logarithme impossible", () => {
    expect(position(5, 0, 10, "log")).toBe(0.5);
  });
});

describe("rang d'une valeur dans une distribution", () => {
  it("compte du moins cher au plus cher", () => {
    expect(standing([0.2, 0.01, 0.05], 0.05, "croissant")).toEqual({ rank: 2, of: 3 });
  });

  it("compte du meilleur score au moins bon", () => {
    expect(standing([60, 80, 70], 80, "decroissant")).toEqual({ rank: 1, of: 3 });
  });

  it("donne le même rang aux ex æquo", () => {
    expect(standing([0, 0, 0, 4], 0, "croissant")).toEqual({ rank: 1, of: 4 });
    expect(standing([0, 0, 0, 4], 4, "croissant")).toEqual({ rank: 4, of: 4 });
  });
});

describe("stabilité d'un modèle d'un run à l'autre", () => {
  const histories = [
    history("factures", [["2026-05-15", { "a/un": 60 }], ["2026-07-15", { "a/un": 62, "b/deux": 70 }]]),
    history("contrats", [["2026-05-15", { "a/un": 70 }], ["2026-07-15", { "a/un": 71.5, "b/deux": 90 }]]),
    history("tickets", [["2026-07-15", { "a/un": 40.2 }]]),
  ];

  it("rend une série par benchmark, jamais une moyenne de plusieurs", () => {
    expect(runsByBenchmark(histories, "a/un")).toEqual([
      { benchmarkId: "factures", points: [{ date: "2026-05-15", value: 60 }, { date: "2026-07-15", value: 62 }] },
      { benchmarkId: "contrats", points: [{ date: "2026-05-15", value: 70 }, { date: "2026-07-15", value: 71.5 }] },
      { benchmarkId: "tickets", points: [{ date: "2026-07-15", value: 40.2 }] },
    ]);
  });

  it("ne crée ni point pour un run où le modèle est absent, ni série pour un benchmark qu'il n'a pas passé", () => {
    expect(runsByBenchmark(histories, "b/deux")).toEqual([
      { benchmarkId: "factures", points: [{ date: "2026-07-15", value: 70 }] },
      { benchmarkId: "contrats", points: [{ date: "2026-07-15", value: 90 }] },
    ]);
    expect(runsByBenchmark(histories, "c/inconnu")).toEqual([]);
  });

  // Le cas qui a fait écrire cette fonction : deux benchmarks publiés à des dates
  // différentes. Une moyenne par date aurait tracé 98 → 53, comme si le modèle avait dérivé.
  it("ne met pas bout à bout deux benchmarks publiés à des dates différentes", () => {
    const series = runsByBenchmark([
      history("factures", [["2026-10-02", { "a/un": 97.3 }], ["2026-10-05", { "a/un": 97.8 }]]),
      history("finance", [["2026-10-08", { "a/un": 53.1 }]]),
    ], "a/un");
    expect(series.map((s) => s.points.map((p) => p.value))).toEqual([[97.3, 97.8], [53.1]]);
  });

  it("range les runs d'un benchmark du plus ancien au plus récent", () => {
    const [serie] = runsByBenchmark([history("factures", [["2026-07-15", { "a/un": 62 }], ["2026-05-15", { "a/un": 60 }]])], "a/un");
    expect(serie!.points.map((p) => p.date)).toEqual(["2026-05-15", "2026-07-15"]);
  });

  it("place les runs sur l'axe du temps selon leur date, pas selon leur numéro d'ordre", () => {
    expect(timePositions(["2026-01-01", "2026-01-11", "2026-01-31"])).toEqual([0, 1 / 3, 1]);
    expect(timePositions(["2026-01-01"])).toEqual([0.5]);
  });
});

describe("axe tronqué d'un graphique d'exactitude", () => {
  it("laisse cinq points de marge et cale les bornes sur des nombres ronds", () => {
    expect(axisRange([60.3, 60.7])).toEqual({ lo: 55, hi: 70, ticks: [55, 60, 65, 70] });
  });

  it("espace les graduations quand l'étendue grandit", () => {
    expect(axisRange([40, 80]).ticks).toEqual([30, 40, 50, 60, 70, 80, 90]);
  });

  it("ne dépasse jamais l'échelle de 0 à 100", () => {
    const { lo, hi } = axisRange([2, 98]);
    expect([lo, hi]).toEqual([0, 100]);
  });
});

describe("rang écrit en toutes lettres", () => {
  const fr = { one: "er", two: "e", few: "e", other: "e" };
  const en = { one: "st", two: "nd", few: "rd", other: "th" };

  it("écrit « 1er » puis « 2e » en français", () => {
    expect([1, 2, 21].map((n) => ordinal(n, "fr", fr))).toEqual(["1er", "2e", "21e"]);
  });

  it("suit les terminaisons anglaises, onzième et douzième compris", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map((n) => ordinal(n, "en", en)))
      .toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd"]);
  });
});

describe("lecture des documents", () => {
  it("demande au modèle d'accepter des images ou des PDF", () => {
    expect(readsDocuments(["text", "image"])).toBe(true);
    expect(readsDocuments(["text", "pdf"])).toBe(true);
    expect(readsDocuments(["text", "audio", "video"])).toBe(false);
  });
});
