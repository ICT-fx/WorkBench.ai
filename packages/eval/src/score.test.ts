import { describe, it, expect } from "vitest";
import { TaskSchema, GroundTruthSchema, type GroundTruth, type ModelResult, type Task } from "@hub/schema";
import { scoreDocument, scoreEchecImpute, scoreResults } from "./score";

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

describe("une question ne porte qu'un critère", () => {
  // Quatre formes de réponse, une seule posée par question. Un critère que la
  // vérité terrain ne déclare pas n'est ni juste ni faux : lu comme `null`, il
  // vaudrait « absent du document » et donnerait des points pour rien.
  const parForme: Task = TaskSchema.parse({
    id: "tache-formes",
    label: "Tâche à formes",
    question: "Ne note-t-on que ce qui est posé ?",
    criteria: [
      { id: "calcul", label: "Calcul", kind: "number", weight: 1, critical: true, key: "answer", toleranceRelative: 0.005, decimalSeparator: "." },
      { id: "verdict", label: "Verdict", kind: "exact", weight: 1, critical: true, key: "answer" },
      { id: "libelle", label: "Libellé", kind: "exact", weight: 1, critical: true, key: "answer" },
    ],
  });

  it("ne note pas un critère que la vérité terrain ne déclare pas", () => {
    const question = GroundTruthSchema.parse({ docId: "q-1", fields: { calcul: "1.9" } });
    const s = scoreDocument(parForme, question, { answer: 1.94 }, "modele-test");
    expect(Object.keys(s.byCriterion)).toEqual(["calcul"]);
    expect(s.byCriterion.calcul!.verdict).toBe("correct");
    expect(s.needsReview).toBe(false);
  });

  it("lit la réponse dans la clé du critère, pas dans son identifiant", () => {
    const question = GroundTruthSchema.parse({ docId: "q-2", fields: { verdict: "no" } });
    expect(scoreDocument(parForme, question, { answer: "no" }, "m").byCriterion.verdict!.verdict).toBe("correct");
    expect(scoreDocument(parForme, question, { verdict: "no" }, "m").byCriterion.verdict!.verdict).toBe("manquant");
  });

  it("note un champ déclaré null : absent du document, donc piège", () => {
    const piege = GroundTruthSchema.parse({ docId: "q-3", fields: { libelle: null } });
    expect(scoreDocument(parForme, piege, { answer: null }, "m").byCriterion.libelle!.verdict).toBe("correct");
    expect(scoreDocument(parForme, piege, { answer: "Class A notes" }, "m").byCriterion.libelle!.verdict).toBe("hallucine");
  });
});

describe("un échec que l'on impute au modèle", () => {
  // Un modèle qui réfléchit sans jamais écrire de réponse, ou qui se contredit, a fait
  // son propre travail : on ne retire pas la question à tout le monde à cause de lui.
  const parForme: Task = TaskSchema.parse({
    id: "tache-formes", label: "Tâche à formes", question: "Un échec propre au modèle est-il compté contre lui ?",
    criteria: [
      { id: "calcul", label: "Calcul", kind: "number", weight: 1, critical: true, key: "answer" },
      { id: "libelle", label: "Libellé", kind: "exact", weight: 1, critical: true, key: "answer" },
    ],
  });

  it("note « manquant », zéro point, sur le critère que la question pose", () => {
    const gt = GroundTruthSchema.parse({ docId: "q-1", fields: { calcul: "5.4" } });
    const s = scoreEchecImpute(parForme, gt, "kimi");
    expect(Object.keys(s.byCriterion)).toEqual(["calcul"]);
    expect(s.byCriterion.calcul).toMatchObject({ verdict: "manquant", points: 0, maxPoints: 1, got: null, expected: "5.4" });
    expect(s.needsReview).toBe(true);
  });

  it("ne donne aucun point sur une question piège : « rien » y est une bonne réponse, pas un échec", () => {
    // Lu comme une réponse vide, un échec sur « il n'y en a pas » vaudrait un point.
    const gt = GroundTruthSchema.parse({ docId: "q-2", fields: { libelle: null } });
    const s = scoreEchecImpute(parForme, gt, "kimi");
    expect(s.byCriterion.libelle).toMatchObject({ verdict: "manquant", points: 0 });
  });
});

describe("scoreResults", () => {
  const t: Task = TaskSchema.parse({
    id: "t", label: "T", question: "Q ?",
    criteria: [{ id: "calcul", label: "Calcul", kind: "number", weight: 1, critical: true, key: "answer" }],
  });
  const gts = new Map([
    ["q-1", GroundTruthSchema.parse({ docId: "q-1", fields: { calcul: "10" } })],
    ["q-2", GroundTruthSchema.parse({ docId: "q-2", fields: { calcul: "20" } })],
  ]);
  const res = (model: string, docId: string, extra: Partial<ModelResult> = {}): ModelResult => ({
    runId: "r", model, modelVersion: model, docId, raw: { answer: 10 }, latencyMs: 1, costUsd: 0, ...extra,
  });
  const retenus = new Set(["q-1", "q-2"]);

  it("note chaque réponse reçue", () => {
    const { scores } = scoreResults({ task: t, groundTruths: gts, results: [res("a", "q-1")], retenus, imputes: new Map() });
    expect(scores).toHaveLength(1);
    expect(scores[0]!.byCriterion.calcul!.verdict).toBe("correct");
  });

  it("laisse de côté un échec que personne n'a imputé au modèle", () => {
    const echec = res("a", "q-2", { raw: null, error: "429 Too Many Requests" });
    const { scores } = scoreResults({ task: t, groundTruths: gts, results: [echec], retenus, imputes: new Map() });
    expect(scores).toEqual([]);
  });

  it("note « manquant » un échec imputé au modèle, et lui seul", () => {
    const echec = res("a", "q-2", { raw: null, error: "réponse sans JSON exploitable" });
    const autre = res("b", "q-2", { raw: null, error: "429 Too Many Requests" });
    const { scores } = scoreResults({
      task: t, groundTruths: gts, results: [echec, autre], retenus,
      imputes: new Map([["a/q-2", "contradiction"]]),
    });
    expect(scores.map((s) => `${s.model}/${s.docId}/${s.byCriterion.calcul!.verdict}`)).toEqual(["a/q-2/manquant"]);
  });

  it("ignore une imputation qui ne correspond à aucun échec : une réponse reçue n'est jamais réécrite", () => {
    const { scores } = scoreResults({
      task: t, groundTruths: gts, results: [res("a", "q-1")], retenus, imputes: new Map([["a/q-1", "à tort"]]),
    });
    expect(scores[0]!.byCriterion.calcul!.verdict).toBe("correct");
  });

  it("écarte les documents hors périmètre, et signale ceux qui n'ont plus de vérité terrain", () => {
    const { scores, sansReference } = scoreResults({
      task: t, groundTruths: gts,
      results: [res("a", "q-1"), res("a", "hors"), res("a", "q-3")],
      retenus: new Set(["q-1", "q-3"]), imputes: new Map(),
    });
    expect(scores.map((s) => s.docId)).toEqual(["q-1"]);
    expect([...sansReference]).toEqual(["q-3"]);
  });
});
