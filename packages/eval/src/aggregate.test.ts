import { describe, it, expect } from "vitest";
import type { DocScore, FieldScore, ModelResult, FieldVerdict } from "@hub/schema";
import { aggregate } from "./aggregate";

const field = (verdict: FieldVerdict, weight: number, expectedNull = false): FieldScore => ({
  got: verdict === "hallucine" ? "inventé" : null,
  expected: expectedNull ? null : "x",
  verdict,
  points: verdict === "correct" ? weight : 0,
  maxPoints: weight,
});

/** Un document noté : `critique` porte le champ critique, `absent` un champ légitimement vide. */
const doc = (
  model: string, docId: string,
  opts: { critique?: FieldVerdict; absent?: FieldVerdict } = {},
): DocScore => {
  const critique = opts.critique ?? "correct";
  const absent = opts.absent ?? "correct";
  return {
    model, docId,
    byCriterion: {
      total_ttc: field(critique, 3),
      tva_intracom: field(absent, 2, true),
    },
    needsReview: critique !== "correct" || absent === "hallucine",
  };
};

const res = (model: string, docId: string, latencyMs: number, costUsd = 0.01): ModelResult => ({
  runId: "r", model, modelVersion: `${model}-2026-01`, docId, raw: {}, latencyMs, costUsd,
});

describe("aggregate", () => {
  it("publie une marge d'erreur qui se resserre quand l'échantillon grandit", () => {
    const jeu = (n: number) => Array.from({ length: n }, (_, i) =>
      doc("m", `d${i}`, { critique: i % 4 === 0 ? "faux" : "correct" }));
    const marge = (n: number) => {
      const scores = jeu(n);
      return aggregate(scores, scores.map((s) => res("m", s.docId, 100)))[0]!.ci!;
    };
    expect(marge(8)).toBeGreaterThan(marge(80));
    expect(marge(80)).toBeGreaterThan(0);
  });

  it("n'affiche aucune marge d'erreur quand tout est juste : rien ne varie", () => {
    const scores = [doc("m", "d1"), doc("m", "d2")];
    expect(aggregate(scores, scores.map((s) => res("m", s.docId, 100)))[0]!.ci).toBe(0);
  });

  it("compte le pourcentage de documents sans aucun champ critique faux", () => {
    const scores = [
      doc("m", "d1"), doc("m", "d2"), doc("m", "d3"),
      doc("m", "d4", { critique: "faux" }),
    ];
    const results = scores.map((s) => res("m", s.docId, 100));
    expect(aggregate(scores, results)[0]!.sansRelecture).toBe(75);
  });

  it("calcule l'exactitude comme un ratio de points pondérés", () => {
    // total_ttc juste (3/3), tva_intracom faux (0/2) → 3/5
    const scores = [doc("m", "d1", { absent: "faux" })];
    expect(aggregate(scores, [res("m", "d1", 100)])[0]!.exactitude).toBe(60);
  });

  it("rapporte les hallucinations au nombre de champs réellement absents", () => {
    // 2 documents, 1 champ absent chacun, 1 seul halluciné → 50 %
    const scores = [doc("m", "d1", { absent: "hallucine" }), doc("m", "d2")];
    const results = scores.map((s) => res("m", s.docId, 100));
    expect(aggregate(scores, results)[0]!.hallucinations).toBe(50);
  });

  it("rapporte zéro hallucination quand le jeu ne contient aucun champ absent", () => {
    const sansAbsent: DocScore = {
      model: "m", docId: "d1",
      byCriterion: { total_ttc: field("correct", 3) },
      needsReview: false,
    };
    expect(aggregate([sansAbsent], [res("m", "d1", 100)])[0]!.hallucinations).toBe(0);
  });

  it("prend la médiane des latences, pas la moyenne", () => {
    const scores = [doc("m", "d1"), doc("m", "d2"), doc("m", "d3")];
    const results = [res("m", "d1", 100), res("m", "d2", 200), res("m", "d3", 5000)];
    expect(aggregate(scores, results)[0]!.latencyP50).toBe(200);
  });

  it("calcule le coût moyen par document", () => {
    const scores = [doc("m", "d1"), doc("m", "d2")];
    const results = [res("m", "d1", 100, 0.02), res("m", "d2", 100, 0.04)];
    expect(aggregate(scores, results)[0]!.costPerDoc).toBeCloseTo(0.03, 5);
  });

  it("départage deux modèles d'égale exactitude par le prix, puis la rapidité", () => {
    const scores = [doc("cher", "d1"), doc("economique", "d1"), doc("lent", "d1")];
    const results = [res("cher", "d1", 100, 0.10), res("economique", "d1", 900, 0.001),
                     res("lent", "d1", 5000, 0.001)];
    expect(aggregate(scores, results).map((r) => r.model))
      .toEqual(["economique", "lent", "cher"]);
  });

  it("classe par exactitude décroissante", () => {
    const scores = [
      doc("fort", "d1"), doc("moyen", "d1", { absent: "faux" }),
      doc("faible", "d1", { critique: "faux", absent: "faux" }),
    ];
    const results = scores.map((s) => res(s.model, s.docId, 100));
    expect(aggregate(scores, results).map((r) => r.model)).toEqual(["fort", "moyen", "faible"]);
  });

  it("exclut du calcul les appels en échec, et les compte à part", () => {
    const scores = [doc("m", "d1")];
    const results = [
      res("m", "d1", 100),
      { ...res("m", "d2", 0, 0), error: "timeout après 60 s" },
    ];
    const row = aggregate(scores, results)[0]!;
    expect(row.errorCount).toBe(1);
    expect(row.docCount).toBe(1);
    // Le document en échec ne pénalise pas le modèle : les échecs rencontrés
    // venaient de notre côté — quota du compte, crédit réservé, hébergeur en
    // panne. Le compteur reste visible pour qui veut juger sur pièces.
    expect(row.sansRelecture).toBe(100);
    expect(row.errorCount).toBe(1);
  });

  it("retient la version réelle du modèle, pas son alias", () => {
    expect(aggregate([doc("m", "d1")], [res("m", "d1", 100)])[0]!.modelVersion).toBe("m-2026-01");
  });
});
