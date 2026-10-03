import { describe, it, expect } from "vitest";
import {
  TaskSchema, type DocScore, type Leaderboard, type ModelResult, type ReviewItem, type Task,
} from "@hub/schema";
import { appendHistory, applyReview, buildLeaderboard } from "./publish";

/**
 * Un barème de test, écrit ici plutôt que lu dans `data/` : ces tests portent sur
 * le pipeline, pas sur un jeu de données, et ne doivent pas tomber le jour où une
 * tâche est retirée du dépôt.
 */
const task: Task = TaskSchema.parse({
  id: "tache-test",
  label: "Tâche de test",
  question: "Le pipeline se comporte-t-il comme annoncé ?",
  criteria: [
    { id: "total_ttc", label: "Total TTC", kind: "number", weight: 3, critical: true, tolerance: 0 },
    { id: "echeance", label: "Échéance", kind: "date", weight: 1, critical: false },
  ],
});

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
    const lb = buildLeaderboard({ taskId: "tache-test", runId: "2026-10-08_tache-test", status: "reel", runDate: "2026-10-08", scores, results, sampleSize: 1 });
    expect(lb.rows).toHaveLength(1);
    expect(lb.runDate).toBe("2026-10-08");
  });

  it("refuse de publier un modèle qui a échoué plus d'une fois sur deux", () => {
    // En deçà, les documents en échec sont écartés pour tout le panel et
    // l'équité tient ; au-delà, le modèle n'a pas été testé du tout.
    const instables: ModelResult[] = [
      ...results,
      ...["f-002", "f-003"].map((docId) => ({
        runId: "r", model: "m", modelVersion: "m-v1", docId,
        raw: null, latencyMs: 0, costUsd: 0, error: "timeout",
      })),
    ];
    expect(() => buildLeaderboard({
      taskId: "tache-test", runId: "2026-10-08_tache-test", status: "reel", runDate: "2026-10-08", scores, results: instables, sampleSize: 3,
    })).toThrow(/n'a pas été testé/);
  });

  it("publie malgré des échecs minoritaires, en les laissant visibles", () => {
    const instables: ModelResult[] = [
      ...results,
      { runId: "r", model: "m", modelVersion: "m-v1", docId: "f-002", raw: null, latencyMs: 0, costUsd: 0, error: "429" },
    ];
    const lb = buildLeaderboard({
      taskId: "tache-test", runId: "2026-10-08_tache-test", status: "reel", runDate: "2026-10-08", scores, results: instables, sampleSize: 2,
    });
    expect(lb.rows).toHaveLength(1);
  });

  it("refuse une date de run mal formée", () => {
    expect(() => buildLeaderboard({
      taskId: "tache-test", runId: "2026-10-08_tache-test", status: "reel", runDate: "08/10/2026", scores, results, sampleSize: 1,
    })).toThrow();
  });
});

describe("appendHistory", () => {
  const publication = (runDate: string, status: "reel" | "demo", exactitude = 90): Leaderboard => ({
    taskId: "tache-test", runId: `${runDate}_tache-test`, status, runDate, sampleSize: 25,
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

describe("documents incomplets", () => {
  const note = (model: string, docId: string): DocScore => ({
    model, docId,
    byCriterion: { total_ttc: { got: 1, expected: 1, verdict: "correct", points: 3, maxPoints: 3 } },
    needsReview: false,
  });
  const appel = (model: string, docId: string): ModelResult => ({
    runId: "r", model, modelVersion: model, docId, raw: {}, latencyMs: 10, costUsd: 0.01,
  });

  it("ne garde que les documents lus par tout le panel", () => {
    // f-002 n'a été lu que par un modèle sur deux : le garder donnerait à ce
    // modèle un échantillon que l'autre n'a pas eu.
    const scores = [note("a", "f-001"), note("b", "f-001"), note("a", "f-002")];
    const results = [appel("a", "f-001"), appel("b", "f-001"), appel("a", "f-002")];
    const lb = buildLeaderboard({
      taskId: "t", runId: "r", status: "reel", runDate: "2026-10-03", scores, results, sampleSize: 2,
    });
    expect(lb.incomplets).toBe(1);
    expect(lb.sampleSize).toBe(1);
    expect(lb.rows.every((r) => r.docCount === 1)).toBe(true);
  });

  it("refuse de publier quand aucun document n'est commun à tout le panel", () => {
    const scores = [note("a", "f-001"), note("b", "f-002")];
    const results = [appel("a", "f-001"), appel("b", "f-002")];
    expect(() => buildLeaderboard({
      taskId: "t", runId: "r", status: "reel", runDate: "2026-10-03", scores, results, sampleSize: 2,
    })).toThrow(/aucun document/);
  });
});

describe("taux d'échec et documents écartés", () => {
  it("compte les échecs sur tout le run, pas sur les seuls documents retenus", () => {
    // Un modèle qui échoue systématiquement sur les documents difficiles les
    // ferait écarter, puis afficherait un sans-faute sur ceux qui restent.
    const scores: DocScore[] = ["f-001", "f-002"].flatMap((docId) =>
      ["a", "b"].map((model) => ({
        model, docId,
        byCriterion: { total_ttc: { got: 1, expected: 1, verdict: "correct" as const, points: 3, maxPoints: 3 } },
        needsReview: false,
      })));
    const results: ModelResult[] = [
      ...scores.map((s) => ({
        runId: "r", model: s.model, modelVersion: s.model, docId: s.docId,
        raw: {}, latencyMs: 10, costUsd: 0.01,
      })),
      // Trois échecs de « a » sur des documents qu'aucun classement ne retiendra.
      ...["f-003", "f-004", "f-005"].map((docId) => ({
        runId: "r", model: "a", modelVersion: "a", docId,
        raw: null, latencyMs: 0, costUsd: 0, error: "503",
      })),
    ];
    expect(() => buildLeaderboard({
      taskId: "t", runId: "r", status: "reel", runDate: "2026-10-03", scores, results, sampleSize: 2,
    })).toThrow(/a a échoué sur 3 appel\(s\) sur 5/);
  });
});
