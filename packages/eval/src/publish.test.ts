import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  TaskSchema, type DocScore, type Leaderboard, type ModelResult, type ReviewItem, type Task,
} from "@hub/schema";
import { appendHistory, applyReview, buildLeaderboard } from "./publish";

const task: Task = TaskSchema.parse(
  JSON.parse(readFileSync("data/tasks/facture-fr/task.json", "utf8")));

const baseScore: DocScore = {
  model: "m", docId: "f-001",
  byCriterion: {
    total_ttc: { got: "1200,00", expected: 1200, verdict: "faux", points: 0, maxPoints: 3 },
    echeance: { got: null, expected: "2026-01-01", verdict: "manquant", points: 0, maxPoints: 1 },
  },
  needsReview: true,
};

const arbitrage = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  model: "m", docId: "f-001", criterionId: "total_ttc",
  autoVerdict: "faux", humanVerdict: "correct",
  decidedAt: "2026-10-08T10:00:00Z", ...over,
});

describe("applyReview", () => {
  it("fait primer l'arbitrage humain sur le verdict automatique", () => {
    const [s] = applyReview(task, [baseScore], [arbitrage()]);
    expect(s!.byCriterion.total_ttc!.verdict).toBe("correct");
  });

  it("recalcule les points après arbitrage", () => {
    const [s] = applyReview(task, [baseScore], [arbitrage()]);
    expect(s!.byCriterion.total_ttc!.points).toBe(3);
  });

  it("recalcule needsReview : un champ critique rétabli lève la relecture", () => {
    const [s] = applyReview(task, [baseScore], [arbitrage()]);
    // echeance reste manquant mais n'est pas critique
    expect(s!.needsReview).toBe(false);
  });

  it("fonctionne aussi dans l'autre sens : l'humain peut invalider un correct", () => {
    const optimiste: DocScore = {
      ...baseScore,
      byCriterion: { total_ttc: { got: 1200, expected: 1200, verdict: "correct", points: 3, maxPoints: 3 } },
      needsReview: false,
    };
    const [s] = applyReview(task, [optimiste], [arbitrage({ autoVerdict: "correct", humanVerdict: "faux" })]);
    expect(s!.byCriterion.total_ttc!.points).toBe(0);
    expect(s!.needsReview).toBe(true);
  });

  it("laisse intact un score sur lequel personne n'a statué", () => {
    const [s] = applyReview(task, [baseScore], []);
    expect(s).toEqual(baseScore);
  });

  it("ignore un arbitrage portant sur un critère hors barème", () => {
    const [s] = applyReview(task, [baseScore], [arbitrage({ criterionId: "iban" })]);
    expect(s).toEqual(baseScore);
  });
});

describe("buildLeaderboard", () => {
  const scores = [baseScore];
  const results: ModelResult[] = [
    { runId: "r", model: "m", modelVersion: "m-v1", docId: "f-001", raw: {}, latencyMs: 900, costUsd: 0.02 },
  ];

  it("produit un classement validé par le schéma", () => {
    const lb = buildLeaderboard({ taskId: "facture-fr", runId: "2026-10-08_facture-fr", status: "reel", runDate: "2026-10-08", scores, results, sampleSize: 1 });
    expect(lb.rows).toHaveLength(1);
    expect(lb.runDate).toBe("2026-10-08");
  });

  it("refuse de publier quand un modèle dépasse 10 % d'appels en échec", () => {
    const instables: ModelResult[] = [
      ...results,
      { runId: "r", model: "m", modelVersion: "m-v1", docId: "f-002", raw: {}, latencyMs: 0, costUsd: 0, error: "timeout" },
    ];
    expect(() => buildLeaderboard({
      taskId: "facture-fr", runId: "2026-10-08_facture-fr", status: "reel", runDate: "2026-10-08", scores, results: instables, sampleSize: 2,
    })).toThrow(/échec/i);
  });

  it("refuse une date de run mal formée", () => {
    expect(() => buildLeaderboard({
      taskId: "facture-fr", runId: "2026-10-08_facture-fr", status: "reel", runDate: "08/10/2026", scores, results, sampleSize: 1,
    })).toThrow();
  });
});

describe("appendHistory", () => {
  const publication = (runDate: string, status: "reel" | "demo", exactitude = 90): Leaderboard => ({
    taskId: "facture-fr", runId: `${runDate}_facture-fr`, status, runDate, sampleSize: 25,
    rows: [{
      model: "labo/modele", modelVersion: "v1", sansRelecture: 80, exactitude, hallucinations: 0,
      costPerDoc: 0.01, latencyP50: 1200, errorCount: 0, docCount: 25,
    }],
  });

  it("crée l'historique à la première publication", () => {
    const h = appendHistory(null, publication("2026-10-08", "reel"));
    expect(h.runs.map((r) => r.runDate)).toEqual(["2026-10-08"]);
    expect(h.runs[0]!.rows[0]).toEqual({ model: "labo/modele", exactitude: 90, costPerDoc: 0.01, latencyP50: 1200 });
  });

  it("range les publications par date, quel que soit l'ordre d'arrivée", () => {
    const h = appendHistory(appendHistory(null, publication("2026-12-01", "reel")), publication("2026-10-08", "reel"));
    expect(h.runs.map((r) => r.runDate)).toEqual(["2026-10-08", "2026-12-01"]);
  });

  it("remplace un run republié au lieu de le dupliquer", () => {
    const h = appendHistory(appendHistory(null, publication("2026-10-08", "reel", 90)), publication("2026-10-08", "reel", 93));
    expect(h.runs).toHaveLength(1);
    expect(h.runs[0]!.rows[0]!.exactitude).toBe(93);
  });

  it("efface les runs de démonstration à la première mesure réelle", () => {
    const demo = appendHistory(appendHistory(null, publication("2026-07-15", "demo")), publication("2026-09-15", "demo"));
    const h = appendHistory(demo, publication("2026-10-08", "reel"));
    expect(h.runs.map((r) => r.status)).toEqual(["reel"]);
  });
});
