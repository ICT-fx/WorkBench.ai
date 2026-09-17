import { describe, it, expect } from "vitest";
import { parseCatalogue, assertUsable, computeCost, V1_MODELS } from "./models";

const payload = {
  data: [
    { id: "a/vision", name: "A Vision", type: "language",
      modalities: { input: ["text", "image"] }, pricing: { input: "0.000001", output: "0.000004" } },
    { id: "a/texte", name: "A Texte", type: "language",
      modalities: { input: ["text"] }, pricing: { input: "0.0000005", output: "0.000001" } },
    { id: "a/image-gen", name: "Générateur", type: "image", modalities: { input: ["text"] } },
  ],
};

describe("catalogue", () => {
  it("ne retient que les modèles de langage", () => {
    const c = parseCatalogue(payload);
    expect([...c.keys()].sort()).toEqual(["a/texte", "a/vision"]);
  });

  it("repère les modèles capables de lire une image", () => {
    const c = parseCatalogue(payload);
    expect(c.get("a/vision")!.acceptsImages).toBe(true);
    expect(c.get("a/texte")!.acceptsImages).toBe(false);
  });

  it("refuse un modèle absent du catalogue avant le premier appel", () => {
    expect(() => assertUsable(parseCatalogue(payload), ["a/inexistant"]))
      .toThrow(/absent du catalogue/);
  });

  it("refuse un modèle incapable de lire une image", () => {
    expect(() => assertUsable(parseCatalogue(payload), ["a/texte"]))
      .toThrow(/n'accepte pas les images/);
  });

  it("accepte un modèle vision", () => {
    expect(() => assertUsable(parseCatalogue(payload), ["a/vision"])).not.toThrow();
  });
});

describe("coût", () => {
  it("multiplie les tokens par les tarifs publiés", () => {
    const entry = parseCatalogue(payload).get("a/vision")!;
    // 2000 × 0,000001 + 500 × 0,000004 = 0,002 + 0,002
    expect(computeCost(entry, 2000, 500)).toBeCloseTo(0.004, 8);
  });

  it("vaut zéro quand le modèle est inconnu ou les tokens absents", () => {
    expect(computeCost(undefined, 100, 100)).toBe(0);
    expect(computeCost(parseCatalogue(payload).get("a/vision")!, undefined, undefined)).toBe(0);
  });
});

describe("sélection V1", () => {
  it("retient six modèles distincts", () => {
    expect(new Set(V1_MODELS).size).toBe(6);
  });

  it("couvre au moins quatre fournisseurs différents", () => {
    const providers = new Set(V1_MODELS.map((m) => m.split("/")[0]));
    expect(providers.size).toBeGreaterThanOrEqual(4);
  });
});
