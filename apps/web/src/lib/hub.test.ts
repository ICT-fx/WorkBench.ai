import { describe, expect, it } from "vitest";
import type { Benchmark, Lab, Leaderboard, LeaderboardRow, Model } from "@hub/schema";
import { bestPerLab, bestValue, buildHub, frontier, indistinguishable, modelSlug, paretoFront } from "./hub";

const lab = (id: string): Lab => ({ id, name: id, country: "FR", monogram: "L", url: "https://exemple.fr" });

const model = (id: string, released = "2026-01-01"): Model => ({
  id, name: id, lab: id.split("/")[0]!, released, weights: "fermes",
  contextWindow: null, maxOutput: null, priceIn: 1, priceOut: 2, modalities: ["text"], reasoning: false,
});

const benchmark = (id: string, domain: string): Benchmark => ({
  id, domain, label: { fr: id, en: id }, question: { fr: "?", en: "?" }, description: { fr: "d", en: "d" },
  input: "texte", unit: { fr: "cas", en: "case" }, sampleSize: 10,
  subtasks: [{ id: "a", label: { fr: "A", en: "A" } }, { id: "b", label: { fr: "B", en: "B" } }],
  maturity: "maquette",
});

const row = (m: string, exactitude: number, over: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  model: m, modelVersion: "v", sansRelecture: 50, exactitude, hallucinations: 2,
  costPerDoc: 0.01, latencyP50: 1000, errorCount: 0, docCount: 10, ...over,
});

const leaderboard = (taskId: string, rows: LeaderboardRow[], status: "reel" | "demo" = "reel"): Leaderboard => ({
  taskId, runId: `2026-09-15_${taskId}`, status, runDate: "2026-09-15", sampleSize: 10, rows,
});

const domains = [
  { id: "finance", label: { fr: "Finance", en: "Finance" }, summary: { fr: "s", en: "s" }, icon: "finance" },
  { id: "rh", label: { fr: "RH", en: "HR" }, summary: { fr: "s", en: "s" }, icon: "rh" },
];

describe("indice métier", () => {
  const input = {
    labs: [lab("a"), lab("b")],
    models: [model("a/un"), model("b/deux")],
    domains,
    benchmarks: [benchmark("f1", "finance"), benchmark("f2", "finance"), benchmark("r1", "rh")],
    leaderboards: [
      leaderboard("f1", [row("a/un", 90), row("b/deux", 60)]),
      leaderboard("f2", [row("a/un", 70)]),
      leaderboard("r1", [row("a/un", 50), row("b/deux", 80)]),
    ],
  };

  it("pèse chaque métier à égalité, quel que soit son nombre de benchmarks", () => {
    const un = buildHub(input).scores.find((s) => s.model.id === "a/un")!;
    // Finance = (90 + 70) / 2 = 80 ; RH = 50 ; indice = 65, et non (90 + 70 + 50) / 3.
    expect(un.byDomain).toEqual({ finance: 80, rh: 50 });
    expect(un.indice).toBe(65);
  });

  it("note un métier sur les seuls benchmarks que le modèle a pu passer", () => {
    const deux = buildHub(input).scores.find((s) => s.model.id === "b/deux")!;
    expect(deux.byDomain.finance).toBe(60);
    expect(deux.indice).toBe(70);
    expect(deux.rank).toBe(1);
  });

  it("ne publie pas d'indice quand un métier entier manque", () => {
    const partiel = buildHub({ ...input, leaderboards: input.leaderboards.slice(0, 2) });
    expect(partiel.scores.every((s) => s.indice === null && s.rank === null)).toBe(true);
  });

  it("donne le rang du modèle sur chaque benchmark", () => {
    const deux = buildHub(input).scores.find((s) => s.model.id === "b/deux")!;
    expect(deux.ranks).toEqual({ f1: { rank: 2, of: 2 }, r1: { rank: 1, of: 2 } });
  });

  it("signale la démonstration dès qu'un seul classement en est une", () => {
    expect(buildHub(input).demo).toBe(false);
    const mixte = { ...input, leaderboards: [...input.leaderboards.slice(0, 2), leaderboard("r1", [row("a/un", 50)], "demo")] };
    expect(buildHub(mixte).demo).toBe(true);
  });

  it("ignore un classement publié pour un benchmark absent du catalogue", () => {
    const hub = buildHub({ ...input, leaderboards: [...input.leaderboards, leaderboard("inconnu", [row("a/un", 1)])] });
    expect(hub.scores[0]!.byBenchmark.inconnu).toBeUndefined();
  });

  it("retient le meilleur modèle de chaque labo", () => {
    const hub = buildHub({ ...input, models: [...input.models, model("a/trois")] });
    expect(bestPerLab(hub.scores).map((s) => s.model.id)).toEqual(["b/deux", "a/un"]);
  });
});

describe("frontière de Pareto", () => {
  it("garde les points qu'aucun autre ne bat à la fois en prix et en précision", () => {
    const front = paretoFront([
      { id: "econome", x: 1, y: 60 },
      { id: "domine", x: 2, y: 55 },
      { id: "milieu", x: 3, y: 75 },
      { id: "cher", x: 9, y: 80 },
      { id: "cher-et-moins-bon", x: 10, y: 78 },
    ]);
    expect(front.map((p) => p.id)).toEqual(["econome", "milieu", "cher"]);
  });

  it("à prix égal, ne garde que le plus précis", () => {
    expect(paretoFront([{ id: "a", x: 1, y: 50 }, { id: "b", x: 1, y: 70 }]).map((p) => p.id)).toEqual(["b"]);
  });
});

describe("évolution dans le temps", () => {
  it("ne crée un point que lorsqu'une sortie bat le record du groupe", () => {
    const hub = buildHub({
      labs: [lab("a")],
      models: [model("a/v1", "2025-10-01"), model("a/v2", "2026-02-01"), model("a/mini", "2026-05-01")],
      domains: [domains[0]!],
      benchmarks: [benchmark("f1", "finance")],
      leaderboards: [leaderboard("f1", [row("a/v1", 60), row("a/v2", 72), row("a/mini", 65)])],
    });
    expect(frontier(hub.scores, (s) => s.indice).map((p) => [p.date, p.value])).toEqual([
      ["2025-10-01", 60], ["2026-02-01", 72],
    ]);
  });
});

describe("lecture honnête d'un classement", () => {
  it("ne départage pas deux modèles plus proches que la marge d'erreur", () => {
    expect(indistinguishable(row("a", 80, { ci: 3 }), row("b", 78.5, { ci: 2 }))).toBe(true);
    expect(indistinguishable(row("a", 80, { ci: 3 }), row("b", 75, { ci: 2 }))).toBe(false);
  });

  it("cherche le meilleur rapport précision-prix parmi les modèles proches du premier", () => {
    const rows = [row("cher", 90, { costPerDoc: 0.2 }), row("malin", 87, { costPerDoc: 0.02 }), row("bradé", 50, { costPerDoc: 0.001 })];
    expect(bestValue(rows)?.model).toBe("malin");
  });

  it("n'élit pas un modèle dont le coût est inconnu", () => {
    expect(bestValue([row("gratuit", 90, { costPerDoc: 0 })])).toBeNull();
  });
});

describe("adresse d'une fiche modèle", () => {
  it("remplace ce qu'une URL porte mal", () => {
    expect(modelSlug("anthropic/claude-fable-5.1")).toBe("anthropic_claude-fable-5-1");
  });
});
