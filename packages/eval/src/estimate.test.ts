import { describe, it, expect } from "vitest";
import { parseCatalogue } from "./models";
import { estimateRunCost } from "./estimate";

const catalogue = parseCatalogue({
  data: [
    { id: "a/cher", type: "language", modalities: { input: ["text", "image"] },
      pricing: { input: "0.00001", output: "0.00005" } },
    { id: "b/econome", type: "language", modalities: { input: ["text", "image"] },
      pricing: { input: "0.0000001", output: "0.0000004" } },
  ],
});

const hypotheses = { imageTokens: 1000, outputTokens: 500, charsPerToken: 4 };
const prompt = "x".repeat(400); // 100 tokens

describe("estimateRunCost", () => {
  it("multiplie documents par modèles", () => {
    const e = estimateRunCost(catalogue, ["a/cher", "b/econome"], [{ images: 1 }, { images: 1 }], prompt, hypotheses);
    expect(e.calls).toBe(4);
    expect(e.perModel.map((m) => m.calls)).toEqual([2, 2]);
  });

  it("compte chaque page d'une facture multipage comme une image", () => {
    const une = estimateRunCost(catalogue, ["a/cher"], [{ images: 1 }], prompt, hypotheses);
    const deux = estimateRunCost(catalogue, ["a/cher"], [{ images: 2 }], prompt, hypotheses);
    expect(deux.perModel[0]!.inputTokens - une.perModel[0]!.inputTokens).toBe(1000);
  });

  it("applique les tarifs publiés du catalogue", () => {
    // 1 appel : (100 + 1000) × 0,00001 + 500 × 0,00005 = 0,011 + 0,025
    const e = estimateRunCost(catalogue, ["a/cher"], [{ images: 1 }], prompt, hypotheses);
    expect(e.totalUsd).toBeCloseTo(0.036, 6);
  });

  it("donne un plafond qui couvre les modèles qui raisonnent avant de répondre", () => {
    const e = estimateRunCost(catalogue, ["a/cher"], [{ images: 1 }], prompt, hypotheses);
    expect(e.ceilingUsd).toBeGreaterThan(e.totalUsd);
  });

  it("classe les modèles du plus cher au moins cher", () => {
    const e = estimateRunCost(catalogue, ["b/econome", "a/cher"], [{ images: 1 }], prompt, hypotheses);
    expect(e.perModel.map((m) => m.model)).toEqual(["a/cher", "b/econome"]);
  });
});
