import { describe, it, expect } from "vitest";
import { TaskSchema, GroundTruthSchema, type GroundTruth, type Task } from "@hub/schema";
import { scoreDocument } from "./score";

/**
 * Un barème de test, écrit ici plutôt que lu dans `data/`.
 *
 * Les tests portent sur la logique de notation, pas sur un jeu de données : les
 * accrocher à une tâche réelle les faisait échouer le jour où cette tâche a été
 * retirée du dépôt. Le barème couvre ce dont la notation a besoin — un champ
 * critique, un champ secondaire, un champ légitimement absent, un champ écarté.
 */
const task: Task = TaskSchema.parse({
  id: "tache-test",
  label: "Tâche de test",
  question: "Le barème se comporte-t-il comme annoncé ?",
  criteria: [
    { id: "total_ttc", label: "Total TTC", kind: "number", weight: 3, critical: true, tolerance: 0 },
    { id: "total_tva", label: "Total TVA", kind: "number", weight: 3, critical: true, tolerance: 0 },
    { id: "numero_facture", label: "Numéro", kind: "exact", weight: 2, critical: true },
    { id: "echeance", label: "Échéance", kind: "date", weight: 1, critical: false },
    { id: "tva_intracom", label: "TVA intracom", kind: "exact", weight: 1, critical: false },
    { id: "mention", label: "Mention écartée", kind: "text", weight: 1, critical: false,
      exclu: "Écarté : la question admet plusieurs réponses défendables sur ce document." },
  ],
});

// Une facture en franchise de TVA : TVA et TVA intracom sont légitimement absentes.
const gt: GroundTruth = GroundTruthSchema.parse({
  docId: "f-019",
  fields: {
    total_ttc: 1200, total_tva: null, numero_facture: "F-2026-019",
    echeance: "2026-02-28", tva_intracom: null, mention: "franchise en base",
  },
});

const parfait = Object.fromEntries(
  Object.entries(gt.fields).map(([k, v]) => [k, v])) as Record<string, unknown>;

const score = (over: Record<string, unknown>) =>
  scoreDocument(task, gt, { ...parfait, ...over }, "modele-test");

describe("scoreDocument", () => {
  it("donne tous les points à une extraction parfaite", () => {
    const s = score({});
    expect(s.needsReview).toBe(false);
    const total = Object.values(s.byCriterion).reduce((a, f) => a + f.points, 0);
    const max = Object.values(s.byCriterion).reduce((a, f) => a + f.maxPoints, 0);
    expect(total).toBe(max);
    expect(max).toBe(10); // 3 + 3 + 2 + 1 + 1, le critère écarté ne comptant pas
  });

  it("bascule needsReview dès qu'un seul champ critique est faux", () => {
    expect(score({ total_ttc: 999 }).needsReview).toBe(true);
  });

  it("ne bascule pas needsReview pour un champ non critique faux", () => {
    expect(score({ echeance: "2099-01-01" }).needsReview).toBe(false);
  });

  it("compte zéro point pour une hallucination, comme pour un champ faux", () => {
    const s = score({ total_tva: 320 }); // la facture est en franchise : rien à trouver
    expect(s.byCriterion.total_tva!.verdict).toBe("hallucine");
    expect(s.byCriterion.total_tva!.points).toBe(0);
  });

  it("traite l'hallucination sur un champ critique comme un motif de relecture", () => {
    expect(score({ total_tva: 320 }).needsReview).toBe(true);
  });

  it("attribue les points au prorata du poids du critère", () => {
    const s = score({});
    expect(s.byCriterion.total_ttc!.points).toBe(3);
    expect(s.byCriterion.echeance!.points).toBe(1);
  });

  it("note manquant un champ que le modèle a omis de sa réponse", () => {
    const sans = { ...parfait };
    delete sans.numero_facture;
    const s = scoreDocument(task, gt, sans, "modele-test");
    expect(s.byCriterion.numero_facture!.verdict).toBe("manquant");
    expect(s.needsReview).toBe(true);
  });

  it("note tous les critères du barème même si la réponse est vide", () => {
    const s = scoreDocument(task, gt, {}, "modele-test");
    expect(Object.keys(s.byCriterion)).toHaveLength(5);
    // Les deux champs légitimement absents sont corrects : ne rien dire est juste.
    expect(s.byCriterion.total_tva!.verdict).toBe("correct");
    expect(s.byCriterion.tva_intracom!.verdict).toBe("correct");
    expect(s.byCriterion.total_ttc!.verdict).toBe("manquant");
  });

  it("ignore les clés inventées hors barème plutôt que de les noter", () => {
    const s = score({ iban_emetteur: "FR76..." });
    expect(Object.keys(s.byCriterion)).toHaveLength(5);
  });

  it("ne note pas un critère écarté, et n'en garde aucune trace dans la note", () => {
    // La réponse du modèle reste dans le fichier brut ; elle ne pèse simplement
    // sur rien, parce que la question posée admettait plusieurs bonnes réponses.
    const s = score({ mention: "n'importe quoi" });
    expect(s.byCriterion.mention).toBeUndefined();
    expect(s.needsReview).toBe(false);
  });
});
