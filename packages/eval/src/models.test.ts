import { describe, it, expect } from "vitest";
import { parseCatalogue, assertUsable, computeCost, HUB_MODELS } from "./models";

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

describe("catalogue OpenRouter", () => {
  const openrouter = {
    data: [
      { id: "lab/vision", name: "V", architecture: { input_modalities: ["text", "image"] },
        pricing: { prompt: "0.000002", completion: "0.000008" } },
      { id: "lab/texte", name: "T", architecture: { input_modalities: ["text"] },
        pricing: { prompt: "0.0000005", completion: "0.000001" } },
    ],
  };

  it("lit la forme d'OpenRouter, qui nomme ses champs autrement que Vercel", () => {
    const c = parseCatalogue(openrouter);
    expect(c.get("lab/vision")!.acceptsImages).toBe(true);
    expect(c.get("lab/texte")!.acceptsImages).toBe(false);
    expect(c.get("lab/vision")!.inputPrice).toBeCloseTo(0.000002, 10);
  });

  it("retient les modèles OpenRouter, qui n'annoncent pas de type", () => {
    expect(parseCatalogue(openrouter).size).toBe(2);
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

describe("sélection du hub", () => {
  it("retient 27 modèles distincts", () => {
    expect(new Set(HUB_MODELS).size).toBe(27);
  });

  it("couvre au moins dix fournisseurs de modèles", () => {
    expect(new Set(HUB_MODELS.map((m) => m.split("/")[0])).size).toBeGreaterThanOrEqual(10);
  });

  it("compte au moins un modèle français", () => {
    expect(HUB_MODELS.filter((m) => m.startsWith("mistralai/")).length).toBeGreaterThanOrEqual(1);
  });
});
