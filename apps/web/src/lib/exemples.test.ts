import { describe, expect, it } from "vitest";
import type { DocScore, FieldVerdict } from "@hub/schema";
import { documentsClivants, lecturesParDocument } from "./exemples";

const score = (model: string, docId: string, verdicts: Record<string, FieldVerdict>): DocScore => ({
  model, docId, needsReview: false,
  byCriterion: Object.fromEntries(Object.entries(verdicts).map(([id, verdict]) => [
    id, { got: null, expected: null, verdict, points: verdict === "correct" ? 1 : 0, maxPoints: 1 },
  ])),
});

describe("lectures par document", () => {
  const scores = [
    score("a", "facile", { gross_amount: "correct", vat_number: "correct" }),
    score("b", "facile", { gross_amount: "correct", vat_number: "correct" }),
    score("a", "dur", { gross_amount: "faux", vat_number: "correct" }),
    score("b", "dur", { gross_amount: "manquant", vat_number: "hallucine" }),
  ];

  it("compte les modèles qui ont lu correctement le champ décisif", () => {
    expect(lecturesParDocument(scores, "gross_amount")).toEqual([
      { docId: "dur", models: 2, corrects: 0, hallucinations: 1 },
      { docId: "facile", models: 2, corrects: 2, hallucinations: 0 },
    ]);
  });

  it("compte une hallucination sur n'importe quel champ, pas seulement le décisif", () => {
    const [dur] = lecturesParDocument(scores, "vat_number");
    // Sur vat_number, « b » a halluciné : la lecture n'est pas correcte et
    // l'invention est comptée une fois pour le modèle, pas une fois par champ.
    expect(dur).toEqual({ docId: "dur", models: 2, corrects: 1, hallucinations: 1 });
  });

  it("met les documents les plus ratés en tête, et départage par identifiant", () => {
    const egalite = [
      score("a", "zebre", { gross_amount: "faux" }),
      score("a", "alpha", { gross_amount: "faux" }),
      score("a", "juste", { gross_amount: "correct" }),
    ];
    expect(lecturesParDocument(egalite, "gross_amount").map((l) => l.docId)).toEqual(["alpha", "zebre", "juste"]);
  });

  it("ne retient dans les documents clivants que ceux où un modèle s'est trompé", () => {
    expect(documentsClivants(scores).map((c) => c.docId)).toEqual(["dur"]);
  });
});
