import { describe, it, expect } from "vitest";
import { TaskSchema, GroundTruthSchema, LeaderboardSchema, ModelResultSchema } from "./index.js";

describe("TaskSchema", () => {
  it("accepte une tâche minimale valide", () => {
    const task = {
      id: "facture-fr",
      label: "Facture française",
      question: "Extraire les champs d'une facture fournisseur française",
      criteria: [
        { id: "total_ttc", label: "Montant TTC", kind: "number", weight: 3, critical: true, tolerance: 0 },
      ],
    };
    expect(TaskSchema.parse(task).criteria[0]!.id).toBe("total_ttc");
  });

  it("refuse un poids hors de 1-3", () => {
    const task = {
      id: "t", label: "T", question: "q",
      criteria: [{ id: "c", label: "C", kind: "exact", weight: 7, critical: false }],
    };
    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it("refuse deux critères avec le même id", () => {
    const c = { id: "dup", label: "D", kind: "exact", weight: 1, critical: false };
    expect(() => TaskSchema.parse({ id: "t", label: "T", question: "q", criteria: [c, c] })).toThrow();
  });

  it("refuse un kind inconnu", () => {
    const task = {
      id: "t", label: "T", question: "q",
      criteria: [{ id: "c", label: "C", kind: "montant", weight: 1, critical: false }],
    };
    expect(() => TaskSchema.parse(task)).toThrow();
  });
});

describe("GroundTruthSchema", () => {
  it("accepte null comme valeur de champ (champ absent du document)", () => {
    const gt = { docId: "f-001", fields: { total_ttc: 120.5, taux_tva: null } };
    expect(GroundTruthSchema.parse(gt).fields.taux_tva).toBeNull();
  });

  it("accepte une valeur structurée pour les lignes", () => {
    const gt = {
      docId: "f-001",
      fields: { lignes: [{ designation: "Conseil", quantite: 1, prix_unitaire_ht: 100, taux_tva: 20 }] },
    };
    expect(GroundTruthSchema.parse(gt).fields.lignes).toHaveLength(1);
  });
});

describe("ModelResultSchema", () => {
  it("exige la version réelle du modèle en plus de son alias", () => {
    const base = { runId: "r", model: "m", docId: "d", raw: {}, latencyMs: 10, costUsd: 0.1 };
    expect(() => ModelResultSchema.parse(base)).toThrow();
    expect(ModelResultSchema.parse({ ...base, modelVersion: "m-2026-01-01" }).modelVersion)
      .toBe("m-2026-01-01");
  });
});

describe("LeaderboardSchema", () => {
  const row = {
    model: "m", modelVersion: "v", sansRelecture: 80, exactitude: 90,
    hallucinations: 0, costPerDoc: 0.01, latencyP50: 1200, errorCount: 0, docCount: 25,
  };

  it("accepte un classement complet", () => {
    const lb = { taskId: "facture-fr", runDate: "2026-10-08", sampleSize: 25, rows: [row] };
    expect(LeaderboardSchema.parse(lb).rows[0]!.docCount).toBe(25);
  });

  it("refuse un pourcentage supérieur à 100", () => {
    const lb = { taskId: "facture-fr", runDate: "2026-10-08", sampleSize: 25,
      rows: [{ ...row, sansRelecture: 101 }] };
    expect(() => LeaderboardSchema.parse(lb)).toThrow();
  });

  it("refuse un coût négatif", () => {
    const lb = { taskId: "facture-fr", runDate: "2026-10-08", sampleSize: 25,
      rows: [{ ...row, costPerDoc: -1 }] };
    expect(() => LeaderboardSchema.parse(lb)).toThrow();
  });
});

describe("Value imbriqué", () => {
  it("accepte un null à l'intérieur d'une ligne (franchise de TVA)", () => {
    const gt = {
      docId: "f-001",
      fields: { lignes: [{ designation: "Conseil", quantite: 1, prix_unitaire_ht: 100, taux_tva: null }] },
    };
    const lignes = GroundTruthSchema.parse(gt).fields.lignes as Array<Record<string, unknown>>;
    expect(lignes[0]!.taux_tva).toBeNull();
  });
});
