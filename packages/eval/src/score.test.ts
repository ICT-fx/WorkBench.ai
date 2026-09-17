import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TaskSchema, GroundTruthSchema, type GroundTruth, type Task } from "@hub/schema";
import { scoreDocument } from "./score.js";

const task: Task = TaskSchema.parse(
  JSON.parse(readFileSync("data/tasks/facture-fr/task.json", "utf8")));

// f-019 : franchise en base, donc TVA et TVA intracom légitimement absentes.
const gt: GroundTruth = GroundTruthSchema.parse(
  JSON.parse(readFileSync("data/tasks/facture-fr/ground-truth/f-019.json", "utf8")));

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
    expect(max).toBe(22); // 4×3 + 4×2 + 2×1
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
    expect(Object.keys(s.byCriterion)).toHaveLength(10);
    // Les deux champs légitimement absents sont corrects : ne rien dire est juste.
    expect(s.byCriterion.total_tva!.verdict).toBe("correct");
    expect(s.byCriterion.tva_intracom!.verdict).toBe("correct");
    expect(s.byCriterion.total_ttc!.verdict).toBe("manquant");
  });

  it("ignore les clés inventées hors barème plutôt que de les noter", () => {
    const s = score({ iban_emetteur: "FR76..." });
    expect(Object.keys(s.byCriterion)).toHaveLength(10);
  });
});
