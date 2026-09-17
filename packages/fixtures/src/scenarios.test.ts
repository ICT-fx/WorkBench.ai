import { describe, it, expect } from "vitest";
import { SCENARIOS, TRAPS } from "./scenarios";
import { buildInvoice, toGroundTruth } from "./invoice-model";

describe("jeu de test", () => {
  it("compte 25 documents aux identifiants uniques", () => {
    expect(SCENARIOS).toHaveLength(25);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(25);
  });

  it("couvre les neuf cas pièges du design", () => {
    const used = new Set(SCENARIOS.flatMap((s) => s.traps ?? []));
    for (const trap of TRAPS) expect([...used]).toContain(trap);
  });

  it("garde au moins huit factures nominales sans piège", () => {
    expect(SCENARIOS.filter((s) => !s.traps?.length).length).toBeGreaterThanOrEqual(8);
  });

  it("répartit les documents sur les trois gabarits visuels", () => {
    for (const t of ["sobre", "tableau", "colore"] as const) {
      expect(SCENARIOS.filter((s) => s.template === t).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("produit une vérité terrain valide pour chaque scénario", () => {
    for (const s of SCENARIOS) {
      const gt = toGroundTruth(buildInvoice(s.input));
      expect(Object.keys(gt.fields)).toHaveLength(10);
      expect(gt.docId).toBe(s.id);
    }
  });

  it("place au moins un champ légitimement absent par piège d'exonération", () => {
    const exempts = SCENARIOS.filter((s) =>
      s.traps?.includes("franchise_293b") || s.traps?.includes("autoliquidation"));
    expect(exempts.length).toBeGreaterThanOrEqual(3);
    for (const s of exempts) {
      expect(toGroundTruth(buildInvoice(s.input)).fields.total_tva).toBeNull();
    }
  });

  it("compte assez de champs absents pour rendre le taux d'hallucination mesurable", () => {
    const nulls = SCENARIOS.flatMap((s) =>
      Object.values(toGroundTruth(buildInvoice(s.input)).fields).filter((v) => v === null));
    expect(nulls.length).toBeGreaterThanOrEqual(15);
  });
});
