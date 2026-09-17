import { describe, it, expect } from "vitest";
import type { DocScore, FieldScore, FieldVerdict, ReviewItem } from "@hub/schema";
import { selectForReview } from "./review";

const f = (verdict: FieldVerdict, expected: unknown, got: unknown): FieldScore => ({
  got: got as FieldScore["got"], expected: expected as FieldScore["expected"],
  verdict, points: verdict === "correct" ? 2 : 0, maxPoints: 2,
});

const docs = (n: number, make: (i: number) => Record<string, FieldScore>): DocScore[] =>
  Array.from({ length: n }, (_, i) => ({
    model: "m", docId: `f-${String(i).padStart(3, "0")}`,
    byCriterion: make(i), needsReview: false,
  }));

describe("selectForReview", () => {
  it("présente systématiquement toutes les hallucinations", () => {
    const scores = docs(20, () => ({
      total_tva: f("hallucine", null, 246.5),
      numero_facture: f("correct", "FA-1", "FA-1"),
    }));
    const selection = selectForReview(scores, { seed: 1 });
    expect(selection.filter((s) => s.criterionId === "total_tva")).toHaveLength(20);
  });

  it("présente les écarts de format jugés corrects, qui sont les plus discutables", () => {
    const scores = docs(1, () => ({
      total_ttc: f("correct", 1234.56, "1 234,56 €"),
      numero_facture: f("correct", "FA-1", "FA-1"),
    }));
    const selection = selectForReview(scores, { seed: 1 });
    const motifs = selection.filter((s) => s.criterionId === "total_ttc").map((s) => s.reason);
    expect(motifs).toContain("format");
  });

  it("échantillonne environ 10 % des champs corrects et identiques", () => {
    const scores = docs(100, () => ({ numero_facture: f("correct", "FA-1", "FA-1") }));
    const n = selectForReview(scores, { seed: 7 }).filter((s) => s.reason === "echantillon").length;
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(20);
  });

  it("produit la même sélection à graine égale, et une autre à graine différente", () => {
    const scores = docs(100, () => ({ numero_facture: f("correct", "FA-1", "FA-1") }));
    expect(selectForReview(scores, { seed: 42 })).toEqual(selectForReview(scores, { seed: 42 }));
    expect(selectForReview(scores, { seed: 43 })).not.toEqual(selectForReview(scores, { seed: 42 }));
  });

  it("n'écrase pas un arbitrage déjà rendu lors d'une relance", () => {
    const scores = docs(3, () => ({ total_tva: f("hallucine", null, 246.5) }));
    const deja: ReviewItem[] = [{
      model: "m", docId: "f-001", criterionId: "total_tva",
      autoVerdict: "hallucine", humanVerdict: "hallucine", decidedAt: "2026-09-17T10:00:00Z",
    }];
    const restant = selectForReview(scores, { seed: 1, alreadyDecided: deja });
    expect(restant.map((s) => s.docId)).toEqual(["f-000", "f-002"]);
  });

  it("ne présente pas les champs faux : le barème tranche, l'humain arbitre les cas douteux", () => {
    const scores = docs(5, () => ({ total_ttc: f("faux", 100, 999) }));
    expect(selectForReview(scores, { seed: 1 })).toHaveLength(0);
  });

  it("classe les hallucinations avant le reste : c'est ce qui compte le plus", () => {
    const scores = docs(10, (i): Record<string, FieldScore> => i === 0
      ? { a: f("hallucine", null, "x"), b: f("correct", "y", "y") }
      : { b: f("correct", "y", "y") });
    const first = selectForReview(scores, { seed: 3 })[0];
    expect(first!.reason).toBe("hallucination");
  });
});
