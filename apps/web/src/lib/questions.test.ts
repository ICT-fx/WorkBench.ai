import { describe, it, expect } from "vitest";
import type { DocScore } from "@hub/schema";
import { lireQuestions, lignesQuestions, type QuestionPosee } from "./questions";
import { loadEchecsImputes, loadExclusions, loadQuestionsPosees } from "./data";

const q = (docId: string, sousTache = "calcul"): QuestionPosee => ({
  docId, sousTache, societe: "Société", rapport: "R_2022_10K", pages: "12", question: "Combien ?", url: "https://x",
});

/** Un modèle noté sur une question : `verdict` pour le critère qu'elle pose. */
const note = (model: string, docId: string, verdict: "correct" | "faux" | "hallucine", critere = "calcul"): DocScore => ({
  model, docId, needsReview: verdict !== "correct",
  byCriterion: { [critere]: { got: null, expected: null, verdict, points: verdict === "correct" ? 1 : 0, maxPoints: 1 } },
});

describe("lireQuestions", () => {
  it("lit les lignes d'un manifeste qui pose une question par document", () => {
    const lues = lireQuestions([{
      file_id: "fb-1", question: "Combien ?", sous_tache: "releve", societe: "3M", rapport: "3M_2018_10K", pages: "58", url: "https://x",
    }]);
    expect(lues).toEqual([{
      docId: "fb-1", question: "Combien ?", sousTache: "releve", societe: "3M", rapport: "3M_2018_10K", pages: "58", url: "https://x",
    }]);
  });

  it("rend une liste vide pour un manifeste sans colonne question, comme celui des factures", () => {
    expect(lireQuestions([{ file_id: "a", title: "invoice", gross_amount: "1,880.00", url: "https://x" }])).toEqual([]);
  });
});

describe("lignesQuestions", () => {
  const panel = 3;
  const modeles = ["a", "b", "c"];
  const toutes = (docId: string, verdicts: ("correct" | "faux" | "hallucine")[]) =>
    verdicts.map((v, i) => note(modeles[i]!, docId, v));
  const aucune = new Map<string, string>();

  it("compte, par question, les modèles justes sur le critère qu'elle pose", () => {
    const [l] = lignesQuestions([q("q-1")], toutes("q-1", ["correct", "faux", "correct"]), panel, aucune);
    expect(l).toMatchObject({ statut: "classee", models: 3, corrects: 2, hallucinations: 0 });
  });

  it("compte les hallucinations à part", () => {
    const [l] = lignesQuestions([q("q-1", "libelle")], toutes("q-1", ["correct", "hallucine", "hallucine"]).map((s) => ({
      ...s, byCriterion: { libelle: s.byCriterion.calcul! },
    })), panel, aucune);
    expect(l).toMatchObject({ corrects: 1, hallucinations: 2 });
  });

  it("met hors classement une question qu'un modèle n'a pas traitée", () => {
    const [l] = lignesQuestions([q("q-1")], toutes("q-1", ["correct", "correct"]), panel, aucune);
    expect(l).toMatchObject({ statut: "hors-classement", models: 2 });
  });

  it("met hors classement une question que personne n'a notée", () => {
    expect(lignesQuestions([q("q-1")], [], panel, aucune)[0]).toMatchObject({ statut: "hors-classement", models: 0 });
  });

  it("marque écartée une question dont le run n'a rien noté, avec son motif", () => {
    const [l] = lignesQuestions([q("q-1")], [], panel, new Map([["q-1", "échelle ambiguë"]]));
    expect(l).toMatchObject({ statut: "ecartee", motif: "échelle ambiguë" });
  });

  it("l'exclusion l'emporte, même si des notes existent encore", () => {
    const [l] = lignesQuestions([q("q-1")], toutes("q-1", ["correct", "correct", "correct"]), panel, new Map([["q-1", "x"]]));
    expect(l!.statut).toBe("ecartee");
  });

  it("range les classées de la plus disputée à la plus consensuelle, puis les sorties du classement", () => {
    const scores = [
      ...toutes("facile", ["correct", "correct", "correct"]),
      ...toutes("dure", ["faux", "faux", "correct"]),
      ...toutes("moyenne", ["faux", "correct", "correct"]),
      ...toutes("incomplete", ["faux", "faux"]),
    ];
    const lignes = lignesQuestions(
      ["facile", "dure", "moyenne", "incomplete", "ecartee"].map((d) => q(d)), scores, panel, new Map([["ecartee", "motif"]]));
    expect(lignes.map((l) => l.docId)).toEqual(["dure", "moyenne", "facile", "incomplete", "ecartee"]);
  });

  it("départage à égalité par l'identifiant, pour que l'ordre ne change pas d'un build à l'autre", () => {
    const scores = [...toutes("b", ["faux", "correct", "correct"]), ...toutes("a", ["faux", "correct", "correct"])];
    expect(lignesQuestions([q("b"), q("a")], scores, panel, aucune).map((l) => l.docId)).toEqual(["a", "b"]);
  });
});

describe("lignesQuestions : un échec imputé au modèle", () => {
  const panel = 3;
  const tous = (docId: string) => ["a", "b", "c"].map((m) => note(m, docId, "correct"));
  // « c » n'a rien rendu : on lui a compté « manquant », et la question reste classée.
  const avecManquant = [...tous("q-1").slice(0, 2), { ...note("c", "q-1", "faux"), byCriterion: { calcul: { got: null, expected: "5", verdict: "manquant" as const, points: 0, maxPoints: 1 } } }];

  it("garde la question classée pour tous, et dit qui n'a pas répondu", () => {
    const [l] = lignesQuestions([q("q-1")], avecManquant, panel, new Map(), [{ model: "c", docId: "q-1", motif: "n'a rien écrit" }]);
    expect(l).toMatchObject({ statut: "classee", models: 3, corrects: 2 });
    expect(l!.imputes).toEqual([{ model: "c", motif: "n'a rien écrit" }]);
  });

  it("n'attache à une question que les échecs qui la concernent", () => {
    const lignes = lignesQuestions([q("q-1"), q("q-2")], [...avecManquant, ...tous("q-2")], panel, new Map(),
      [{ model: "c", docId: "q-1", motif: "m" }]);
    expect(lignes.find((l) => l.docId === "q-2")!.imputes).toEqual([]);
  });
});

describe("questions d'analyse-financiere, lues dans le dépôt", () => {
  const questions = loadQuestionsPosees("analyse-financiere");

  it("pose 67 questions, chacune avec son texte et le rapport d'où elle vient", () => {
    expect(questions).toHaveLength(67);
    expect(questions.filter((x) => x.question === "" || !x.url.startsWith("https://"))).toEqual([]);
  });

  it("écarte trois questions à l'échelle ambiguë, avec un motif", () => {
    const exclusions = loadExclusions("analyse-financiere");
    expect([...exclusions.keys()].sort()).toEqual(["fb-03473", "fb-10136", "fb-10420"]);
    expect([...exclusions.values()].every((m) => m.length > 80)).toBe(true);
  });

  it("ne pose aucune question aux factures, qui reçoivent toutes le même prompt", () => {
    expect(loadQuestionsPosees("facture-fcc")).toEqual([]);
    expect(loadExclusions("facture-fcc").size).toBe(0);
    expect(loadEchecsImputes("facture-fcc")).toEqual([]);
  });

  it("impute cinq échecs à leur modèle, chacun avec son motif", () => {
    const imputes = loadEchecsImputes("analyse-financiere");
    expect(imputes.map((e) => `${e.model}/${e.docId}`).sort()).toEqual([
      "mistralai/ministral-8b-2512/fb-03031", "mistralai/mistral-large-2512/fb-02981",
      "mistralai/mistral-large-2512/fb-04302", "mistralai/mistral-large-2512/fb-06741", "moonshotai/kimi-k3/fb-04458",
    ]);
    expect(imputes.every((e) => e.motif.length > 80)).toBe(true);
  });
});
