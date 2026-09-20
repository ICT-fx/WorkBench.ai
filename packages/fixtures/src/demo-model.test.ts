import { describe, expect, it } from "vitest";
import type { Benchmark, Model } from "@hub/schema";
import { enLice, ligne, niveau, peutPasser } from "./demo-model";

const modele = (over: Partial<Model> = {}): Model => ({
  id: "labo/modele-1", name: "Modèle 1", lab: "labo", released: "2026-03-01", weights: "fermes",
  contextWindow: 200000, maxOutput: 64000, priceIn: 3, priceOut: 15,
  modalities: ["text", "image"], reasoning: true, ...over,
});

const benchmark = (over: Partial<Benchmark> = {}): Benchmark => ({
  id: "test", domain: "finance",
  label: { fr: "Test", en: "Test" }, question: { fr: "?", en: "?" }, description: { fr: "d", en: "d" },
  input: "document", unit: { fr: "cas", en: "case" }, sampleSize: 40,
  subtasks: [
    { id: "a", label: { fr: "A", en: "A" } },
    { id: "b", label: { fr: "B", en: "B" } },
  ],
  maturity: "maquette", ...over,
});

describe("données de démonstration", () => {
  it("régénère exactement les mêmes chiffres : les diffs de data/ restent vides", () => {
    expect(ligne(modele(), benchmark(), "2026-09-15")).toEqual(ligne(modele(), benchmark(), "2026-09-15"));
  });

  it("classe en moyenne un modèle cher et récent au-dessus d'un modèle bon marché et ancien", () => {
    const cher = niveau(modele({ id: "labo/cher", priceIn: 10, released: "2026-09-01" }));
    const econome = niveau(modele({ id: "labo/econome", priceIn: 0.05, released: "2025-05-01" }));
    expect(cher).toBeGreaterThan(econome + 15);
  });

  it("écarte d'un benchmark sur documents un modèle qui ne lit que du texte", () => {
    const texte = modele({ modalities: ["text"] });
    expect(peutPasser(texte, benchmark({ input: "document" }))).toBe(false);
    expect(peutPasser(texte, benchmark({ input: "texte" }))).toBe(true);
  });

  it("n'inscrit pas à un run un modèle sorti après sa date", () => {
    const models = [modele({ id: "labo/ancien", released: "2025-10-01" }), modele({ id: "labo/futur", released: "2026-08-01" })];
    expect(enLice(models, benchmark(), "2026-01-15").map((m) => m.id)).toEqual(["labo/ancien"]);
  });

  it("produit des lignes que le schéma de classement accepte", () => {
    const row = ligne(modele(), benchmark(), "2026-09-15");
    expect(row.exactitude).toBeGreaterThanOrEqual(0);
    expect(row.exactitude).toBeLessThanOrEqual(100);
    expect(Object.keys(row.bySubtask ?? {})).toEqual(["a", "b"]);
    expect(row.docCount + row.errorCount).toBe(40);
  });

  it("affiche un coût nul, donc « non communiqué », quand le tarif est inconnu", () => {
    expect(ligne(modele({ priceIn: null, priceOut: null }), benchmark(), "2026-09-15").costPerDoc).toBe(0);
  });
});
