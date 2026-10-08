import { describe, it, expect } from "vitest";
import type { Criterion, Leaderboard, ModelResult, RunCalendar } from "@hub/schema";
import {
  PARAMETRES_APPEL, construireProtocole, documentsDuTest, empreinteBareme, empreinteDocument, empreintePrompt,
} from "./protocole";

const criteria: Criterion[] = [
  { id: "total", label: "Total", kind: "number", weight: 3, critical: true, tolerance: 0 },
];

const documents = [
  { docId: "f-001", images: [Buffer.from("page-1"), Buffer.from("page-2")] },
  { docId: "f-002", images: [Buffer.from("page-unique")] },
  { docId: "f-003", images: [Buffer.from("hors-test")] },
];

const classement: Leaderboard = {
  taskId: "tache-test", runId: "2026-10-05_tache-test+2026-10-08_tache-test", status: "reel", runDate: "2026-10-08",
  sampleSize: 2, excluded: 0,
  rows: [{
    model: "labo/modele", modelVersion: "labo/modele", sansRelecture: 100, exactitude: 100, hallucinations: 0,
    costPerDoc: 0.01, latencyP50: 1000, errorCount: 0, docCount: 2,
  }],
};

const reponse = (docId: string, over: Partial<ModelResult> = {}): ModelResult => ({
  runId: "2026-10-05_tache-test", model: "labo/modele", modelVersion: "labo/modele", docId,
  raw: { total: 1 }, latencyMs: 1000, costUsd: 0.01, ...over,
});

const figer = (over: Partial<Parameters<typeof construireProtocole>[0]> = {}) => construireProtocole({
  leaderboard: classement, criteria, promptText: "Lis la facture.", documents,
  results: [reponse("f-001"), reponse("f-002")], docIds: new Set(["f-001", "f-002"]), ...over,
});

describe("empreinte d'un document envoyé", () => {
  const doc = documents[0]!;

  it("est la même pour le même envoi", () => {
    expect(empreinteDocument(doc, "p")).toBe(empreinteDocument({ ...doc, images: [...doc.images] }, "p"));
  });

  it("change dès qu'une page, l'ordre des pages ou le prompt change", () => {
    const reference = empreinteDocument(doc, "p");
    expect(empreinteDocument({ ...doc, images: [doc.images[0]!, Buffer.from("page-2 ")] }, "p")).not.toBe(reference);
    expect(empreinteDocument({ ...doc, images: [doc.images[1]!, doc.images[0]!] }, "p")).not.toBe(reference);
    expect(empreinteDocument(doc, "p ")).not.toBe(reference);
  });

  // Deux pages « ab » + « c » ne doivent pas valoir une page « abc ».
  it("ne confond pas un découpage de pages avec un autre", () => {
    expect(empreinteDocument({ docId: "d", images: [Buffer.from("ab"), Buffer.from("c")] }, "p"))
      .not.toBe(empreinteDocument({ docId: "d", images: [Buffer.from("abc")] }, "p"));
  });

  it("prend le prompt propre au document quand la tâche en compose un par question", () => {
    const question = { ...doc, promptText: "Question A" };
    expect(empreinteDocument(question, "gabarit")).toBe(empreinteDocument(question, "autre gabarit"));
    expect(empreinteDocument(question, "g")).not.toBe(empreinteDocument({ ...doc, promptText: "Question B" }, "g"));
  });
});

describe("le test figé à la publication", () => {
  it("nomme les documents du classement, et eux seuls, avec leurs pages et leur empreinte", () => {
    const p = figer();
    expect(p.documents.map((d) => [d.docId, d.pages])).toEqual([["f-001", 2], ["f-002", 1]]);
    expect(p.documents[0]!.fingerprint).toBe(empreinteDocument(documents[0]!, "Lis la facture."));
  });

  it("porte les empreintes du prompt et du barème, et les paramètres d'appel", () => {
    const p = figer();
    expect(p.promptHash).toBe(empreintePrompt("Lis la facture."));
    expect(p.criteriaHash).toBe(empreinteBareme(criteria));
    expect(p.parameters).toEqual(PARAMETRES_APPEL);
  });

  it("refuse de figer un test dont un document n'a plus ses pages", () => {
    expect(() => figer({ documents: documents.slice(1) })).toThrow(/sans pages sur le disque/);
  });

  it("date les appels d'un modèle par la date portée par chaque réponse", () => {
    const p = figer({ results: [
      reponse("f-001", { calledAt: "2026-10-05T09:00:00.000Z" }),
      reponse("f-002", { calledAt: "2026-10-08T17:30:00.000Z", runId: "2026-10-08_tache-test" }),
    ] });
    expect(p.models[0]).toMatchObject({ firstCall: "2026-10-05T09:00:00.000Z", lastCall: "2026-10-08T17:30:00.000Z" });
  });

  it("à défaut, par le calendrier relevé pour le run, puis par le jour que nomme le run", () => {
    const calendrier: RunCalendar = {
      runId: "2026-10-05_tache-test", source: "dates d'écriture", recordedAt: "2026-10-08",
      models: { "labo/modele": { first: "2026-10-05T08:00:00.000Z", last: "2026-10-06T10:00:00.000Z", calls: 2 } },
    };
    expect(figer({ calendriers: new Map([["2026-10-05_tache-test", calendrier]]) }).models[0])
      .toMatchObject({ firstCall: "2026-10-05T08:00:00.000Z", lastCall: "2026-10-06T10:00:00.000Z" });
    expect(figer().models[0]).toMatchObject({ firstCall: "2026-10-05", lastCall: "2026-10-05" });
  });

  it("ne compte pas les appels sur des documents sortis du classement", () => {
    const p = figer({ results: [
      reponse("f-001", { calledAt: "2026-10-05T09:00:00.000Z", provider: "Hôte A" }),
      reponse("f-002", { calledAt: "2026-10-05T09:05:00.000Z", provider: "Hôte A" }),
      reponse("f-003", { calledAt: "2026-11-30T09:00:00.000Z", provider: "Hôte B" }),
    ] });
    expect(p.models[0]).toMatchObject({ lastCall: "2026-10-05T09:05:00.000Z", providers: ["Hôte A"] });
  });

  it("joint la version datée du catalogue, avec son jour de relevé, ou dit qu'elle manque", () => {
    expect(figer({ canoniques: new Map([["labo/modele", "labo/modele-20260921"]]), canoniquesAu: "2026-10-08" }).models[0])
      .toMatchObject({ version: "labo/modele", canonical: "labo/modele-20260921", canonicalAsOf: "2026-10-08" });
    expect(figer().models[0]).toMatchObject({ canonical: null, canonicalAsOf: null });
  });
});

describe("rejouer le test publié sur un nouveau modèle", () => {
  const protocole = figer();

  it("rend les documents du test, dans l'ordre publié, sans ceux qui n'en font pas partie", () => {
    const retenus = documentsDuTest(protocole, [...documents].reverse(), "Lis la facture.", criteria);
    expect(retenus.map((d) => d.docId)).toEqual(["f-001", "f-002"]);
  });

  it("s'arrête si le prompt a été réécrit", () => {
    expect(() => documentsDuTest(protocole, documents, "Lis bien la facture.", criteria)).toThrow(/le prompt a changé/);
  });

  it("s'arrête si le barème a changé", () => {
    const autre: Criterion[] = [{ ...criteria[0]!, weight: 1 }];
    expect(() => documentsDuTest(protocole, documents, "Lis la facture.", autre)).toThrow(/le barème a changé/);
  });

  it("s'arrête si une page a été rendue autrement, ou si un document manque", () => {
    const retouches = [{ ...documents[0]!, images: [Buffer.from("page-1"), Buffer.from("page-2-autre-resolution")] }, documents[1]!];
    expect(() => documentsDuTest(protocole, retouches, "Lis la facture.", criteria)).toThrow(/f-001 : ce qui serait envoyé/);
    expect(() => documentsDuTest(protocole, documents.slice(0, 1), "Lis la facture.", criteria)).toThrow(/f-002 : document absent/);
  });
});
