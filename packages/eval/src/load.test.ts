import { describe, it, expect } from "vitest";
import { composerPrompt, loadEchecsImputes, loadExclusions, loadTaskDocuments, sansExclusions } from "./load";

const gabarit = [
  "Answer from these pages only.",
  "",
  "Question: {{question}}",
  "",
  "<!-- forme: nombre -->",
  "A plain decimal number.",
  "<!-- forme: verdict -->",
  "yes, no or not_applicable.",
].join("\n");

describe("composerPrompt", () => {
  it("insère la question posée à ce document", () => {
    expect(composerPrompt(gabarit, "What is FY2018 capex?", "nombre"))
      .toContain("Question: What is FY2018 capex?");
  });

  it("ne garde que la consigne de la forme demandée", () => {
    const p = composerPrompt(gabarit, "Did debt increase?", "verdict");
    expect(p).toContain("yes, no or not_applicable.");
    expect(p).not.toContain("A plain decimal number.");
    expect(p).not.toContain("<!--");
  });

  it("refuse une forme que le gabarit ne connaît pas, plutôt que d'envoyer un prompt sans consigne", () => {
    expect(() => composerPrompt(gabarit, "Which segment?", "libelle")).toThrow(/libelle/);
  });

  it("refuse un gabarit qui ne porte pas la question", () => {
    expect(() => composerPrompt("<!-- forme: nombre -->\nA number.", "Q?", "nombre")).toThrow(/question/);
  });

  it("laisse intacte une question qui contient des accolades ou un dollar", () => {
    expect(composerPrompt(gabarit, "Is $& above {{question}}?", "nombre"))
      .toContain("Question: Is $& above {{question}}?");
  });
});

describe("exclusions de documents", () => {
  const docs = [
    { docId: "q-1", images: [Buffer.from("a")] },
    { docId: "q-2", images: [Buffer.from("b")] },
    { docId: "q-3", images: [Buffer.from("c")] },
  ];

  it("retire du périmètre les documents écartés, en gardant l'ordre des autres", () => {
    const exclus = new Map([["q-2", "échelle ambiguë"]]);
    expect(sansExclusions(docs, exclus).map((d) => d.docId)).toEqual(["q-1", "q-3"]);
  });

  it("laisse le périmètre intact quand rien n'est écarté", () => {
    expect(sansExclusions(docs, new Map())).toEqual(docs);
  });

  it("rend une table vide pour une tâche sans fichier d'exclusions", async () => {
    expect((await loadExclusions("facture-fcc")).size).toBe(0);
  });
});

describe("échecs imputés au modèle", () => {
  it("rend une table vide pour une tâche sans fichier", async () => {
    expect((await loadEchecsImputes("facture-fcc")).size).toBe(0);
  });
});

describe("documents d'une tâche", () => {
  it("rend des documents en texte seul, chacun avec sa question dans le prompt", async () => {
    const docs = await loadTaskDocuments("departage-finqa");
    expect(docs).toHaveLength(40);
    expect(docs.every((d) => d.images.length === 0)).toBe(true);
    expect(docs.every((d) => d.promptText!.includes("Question: ") && d.promptText!.includes('"answer"'))).toBe(true);
    expect(docs.map((d) => d.docId)).toEqual([...docs.map((d) => d.docId)].sort());
  });

  it("garde aux questions sur pages leurs images et leur prompt", async () => {
    const docs = await loadTaskDocuments("analyse-financiere");
    expect(docs).toHaveLength(67);
    expect(docs.every((d) => d.images.length >= 1 && d.promptText !== undefined)).toBe(true);
  });
});
