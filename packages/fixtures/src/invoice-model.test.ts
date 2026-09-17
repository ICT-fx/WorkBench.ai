import { describe, it, expect } from "vitest";
import { buildInvoice, toGroundTruth } from "./invoice-model";

describe("cohérence comptable", () => {
  it("calcule un TTC égal au HT plus la TVA, au centime", () => {
    const inv = buildInvoice({
      id: "f-001",
      lines: [{ designation: "Prestation", quantite: 3, prixUnitaireHT: 100, tauxTVA: 20 }],
    });
    expect(inv.totalHT).toBe(300);
    expect(inv.totalTVA).toBe(60);
    expect(inv.totalTTC).toBe(360);
  });

  it("additionne correctement deux taux de TVA différents", () => {
    const inv = buildInvoice({
      id: "f-002",
      lines: [
        { designation: "Livre", quantite: 2, prixUnitaireHT: 10, tauxTVA: 5.5 },
        { designation: "Conseil", quantite: 1, prixUnitaireHT: 100, tauxTVA: 20 },
      ],
    });
    expect(inv.totalHT).toBe(120);
    expect(inv.totalTVA).toBeCloseTo(21.1, 2);
    expect(inv.totalTTC).toBeCloseTo(141.1, 2);
  });

  it("produit des totaux négatifs pour un avoir", () => {
    const inv = buildInvoice({
      id: "f-003", isCreditNote: true,
      lines: [{ designation: "Retour", quantite: 1, prixUnitaireHT: 50, tauxTVA: 20 }],
    });
    expect(inv.totalTTC).toBeLessThan(0);
    expect(inv.totalHT).toBe(-50);
  });

  it("met la TVA à null en franchise en base, pas à zéro", () => {
    const inv = buildInvoice({
      id: "f-004", vatExempt: "293B",
      lines: [{ designation: "Prestation", quantite: 1, prixUnitaireHT: 500, tauxTVA: null }],
    });
    const gt = toGroundTruth(inv);
    expect(gt.fields.total_tva).toBeNull();
    expect(gt.fields.total_ttc).toBe(500);
    expect(gt.fields.mentions_speciales).toContain("293 B");
  });

  it("applique une remise en pied de facture avant la TVA", () => {
    const inv = buildInvoice({
      id: "f-005", globalDiscountPct: 10,
      lines: [{ designation: "Prestation", quantite: 1, prixUnitaireHT: 1000, tauxTVA: 20 }],
    });
    expect(inv.totalHT).toBe(900);
    expect(inv.totalTTC).toBe(1080);
  });

  it("génère un SIRET dont la clé de Luhn est valide", () => {
    const inv = buildInvoice({
      id: "f-006",
      lines: [{ designation: "X", quantite: 1, prixUnitaireHT: 1, tauxTVA: 20 }],
    });
    expect(inv.emetteur.siret).toMatch(/^\d{14}$/);
    const digits = inv.emetteur.siret.split("").map(Number);
    const sum = digits.reduce((acc, d, i) => {
      const doubled = i % 2 === 0 ? d * 2 : d;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }, 0);
    expect(sum % 10).toBe(0);
  });
});

describe("pièges qui ne changent pas les totaux", () => {
  it("distingue le net à payer du total TTC quand un acompte a été versé", () => {
    const inv = buildInvoice({
      id: "f-007", deposit: 300,
      lines: [{ designation: "Chantier", quantite: 1, prixUnitaireHT: 1000, tauxTVA: 20 }],
    });
    expect(inv.totalTTC).toBe(1200);
    expect(inv.netAPayer).toBe(900);
    // Le barème note le TTC, pas le net à payer : c'est précisément le piège.
    expect(toGroundTruth(inv).fields.total_ttc).toBe(1200);
  });

  it("met la TVA à null en autoliquidation et porte la mention", () => {
    const inv = buildInvoice({
      id: "f-008", vatExempt: "autoliquidation",
      lines: [{ designation: "Sous-traitance", quantite: 1, prixUnitaireHT: 2000, tauxTVA: null }],
    });
    expect(inv.totalTVA).toBeNull();
    expect(toGroundTruth(inv).fields.mentions_speciales).toMatch(/[Aa]utoliquidation/);
  });
});

describe("déterminisme", () => {
  it("produit exactement la même facture à identifiant égal", () => {
    const args = { id: "f-009", lines: [{ designation: "A", quantite: 1, prixUnitaireHT: 10, tauxTVA: 20 }] };
    expect(buildInvoice(args)).toEqual(buildInvoice(args));
  });
});

describe("vérité terrain", () => {
  it("ne produit que les dix clés du barème", () => {
    const inv = buildInvoice({
      id: "f-010",
      lines: [{ designation: "A", quantite: 1, prixUnitaireHT: 10, tauxTVA: 20 }],
    });
    expect(Object.keys(toGroundTruth(inv).fields).sort()).toEqual([
      "date_emission", "echeance", "lignes", "mentions_speciales", "numero_facture",
      "siret_emetteur", "total_ht", "total_ttc", "total_tva", "tva_intracom",
    ]);
  });

  it("met l'échéance à null quand la facture n'en porte pas", () => {
    const inv = buildInvoice({
      id: "f-011", echeanceDays: null,
      lines: [{ designation: "A", quantite: 1, prixUnitaireHT: 10, tauxTVA: 20 }],
    });
    expect(toGroundTruth(inv).fields.echeance).toBeNull();
  });
});
