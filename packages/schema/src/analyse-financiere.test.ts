import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { TaskSchema, GroundTruthSchema, parseCsv } from "./index";

const DOSSIER = "data/tasks/analyse-financiere";
const task = TaskSchema.parse(JSON.parse(readFileSync(`${DOSSIER}/task.json`, "utf8")));
const prompt = readFileSync(`${DOSSIER}/prompt.md`, "utf8");
const manifeste = parseCsv(readFileSync(`${DOSSIER}/manifest.csv`, "utf8"));
const verites = readdirSync(`${DOSSIER}/ground-truth`).map((f) =>
  GroundTruthSchema.parse(JSON.parse(readFileSync(`${DOSSIER}/ground-truth/${f}`, "utf8"))));

describe("barème analyse-financiere", () => {
  it("porte un critère par sous-tâche, tous lus sous la même clé", () => {
    expect(task.criteria.map((c) => c.id)).toEqual(["releve", "calcul", "verdict", "libelle"]);
    expect(task.criteria.every((c) => c.key === "answer")).toBe(true);
  });

  it("pèse chaque question pareil : une question vaut une question", () => {
    expect(task.criteria.every((c) => c.weight === 1 && c.critical)).toBe(true);
  });

  it("lit les nombres comme un rapport américain les écrit, à 0,5 % près", () => {
    // Les références sont arrondies par l'analyste : au centime, un modèle qui
    // lit le chiffre exact de la page serait compté faux.
    for (const c of task.criteria.filter((x) => x.kind === "number")) {
      expect(c.toleranceRelative).toBe(0.005);
      expect(c.decimalSeparator).toBe(".");
    }
    expect(task.criteria.filter((c) => c.kind === "number").map((c) => c.id)).toEqual(["releve", "calcul"]);
  });
});

describe("prompt analyse-financiere", () => {
  it("porte la question et une consigne par forme de réponse", () => {
    expect(prompt).toContain("{{question}}");
    for (const forme of ["nombre", "verdict", "libelle"]) {
      expect(prompt).toContain(`<!-- forme: ${forme} -->`);
    }
  });

  it("demande de répondre sous la clé que le barème lit", () => {
    expect(prompt.match(/"answer"/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("donne la consigne « null s'il n'y en a pas » à tous les libellés, pas aux seuls pièges", () => {
    const libelle = prompt.split("<!-- forme: libelle -->")[1]!;
    expect(libelle).toMatch(/null/);
    expect(prompt.split("<!-- forme: libelle -->")[0]).not.toMatch(/null/);
  });
});

describe("périmètre analyse-financiere", () => {
  it("compte 67 questions, chacune avec son texte et sa forme", () => {
    // 50 tirées par quotas, puis 17 calculs ajoutés après le premier run.
    expect(manifeste).toHaveLength(67);
    expect(manifeste.filter((l) => l.question === "" || l.forme === "")).toEqual([]);
    expect(new Set(manifeste.map((l) => l.file_id)).size).toBe(67);
  });

  it("répartit les questions 8 / 35 / 12 / 12", () => {
    const parSousTache = (id: string): number => manifeste.filter((l) => l.sous_tache === id).length;
    expect(["releve", "calcul", "verdict", "libelle"].map(parSousTache)).toEqual([8, 35, 12, 12]);
  });

  it("donne à chaque question une vérité terrain qui ne déclare qu'un critère, le sien", () => {
    expect(verites).toHaveLength(67);
    const sousTache = new Map(manifeste.map((l) => [l.file_id!, l.sous_tache!]));
    for (const gt of verites) {
      expect(Object.keys(gt.fields), gt.docId).toEqual([sousTache.get(gt.docId)]);
    }
  });

  it("garde les nombres tels que l'analyste les a écrits", () => {
    // En chaîne, pour que « 1616.00 » et « 1.9 » gardent leur décimale d'arrondi.
    for (const gt of verites) {
      const [id, valeur] = Object.entries(gt.fields)[0]!;
      if (id === "releve" || id === "calcul") expect(valeur, gt.docId).toMatch(/^-?\d+(\.\d+)?$/);
    }
  });

  it("compte trois questions pièges, dont la bonne réponse est « il n'y en a pas »", () => {
    expect(verites.filter((gt) => Object.values(gt.fields)[0] === null).map((gt) => gt.docId).sort())
      .toEqual(["fb-00476", "fb-00521", "fb-00746"]);
  });

  it("équilibre les verdicts : 5 oui, 6 non, 1 sans objet", () => {
    const verdicts = verites.flatMap((gt) => ("verdict" in gt.fields ? [gt.fields.verdict] : []));
    const compte = (v: string): number => verdicts.filter((x) => x === v).length;
    expect([compte("yes"), compte("no"), compte("not_applicable")]).toEqual([5, 6, 1]);
  });

  it("renvoie chaque question vers le rapport d'origine", () => {
    expect(manifeste.filter((l) => !l.url!.startsWith("https://github.com/patronus-ai/financebench/"))).toEqual([]);
  });
});

describe("exclusions analyse-financiere", () => {
  const exclusions = JSON.parse(readFileSync(`${DOSSIER}/exclusions.json`, "utf8")) as
    { docId: string; motif: string; date: string }[];
  const tri = parseCsv(readFileSync(`${DOSSIER}/tri.csv`, "utf8"));

  it("écarte trois questions à l'échelle ambiguë, chacune avec son motif", () => {
    // Les deux rendements des actifs, et le taux de rétention de l'extension.
    expect(exclusions.map((e) => e.docId).sort()).toEqual(["fb-03473", "fb-10136", "fb-10420"]);
    for (const e of exclusions) {
      expect(e.motif.length, e.docId).toBeGreaterThan(80);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("ne cite que des questions préparées", () => {
    const connues = new Set(manifeste.map((l) => l.file_id));
    for (const e of exclusions) expect(connues.has(e.docId), e.docId).toBe(true);
  });

  it("concorde avec le tri : écartée après le run, avec le même motif de fond", () => {
    const apresRun = tri.filter((l) => l.statut === "écartée après le run" || l.statut === "extension écartée après le run");
    expect(apresRun.map((l) => `fb-${l.financebench_id!.slice(-5)}`).sort())
      .toEqual(exclusions.map((e) => e.docId).sort());
    expect(apresRun.every((l) => l.motif!.length > 0)).toBe(true);
  });

  it("garde la vérité terrain des questions écartées : elles restent consultables", () => {
    for (const e of exclusions) expect(verites.some((gt) => gt.docId === e.docId), e.docId).toBe(true);
  });
});

describe("échecs imputés au modèle, analyse-financiere", () => {
  const imputes = JSON.parse(readFileSync(`${DOSSIER}/echecs-imputes.json`, "utf8")) as
    { model: string; docId: string; motif: string; date: string }[];

  it("liste cinq échecs, chacun avec ce qui a été lu dans la réponse", () => {
    expect(imputes.map((e) => `${e.model}/${e.docId}`).sort()).toEqual([
      "mistralai/ministral-8b-2512/fb-03031", "mistralai/mistral-large-2512/fb-02981",
      "mistralai/mistral-large-2512/fb-04302", "mistralai/mistral-large-2512/fb-06741", "moonshotai/kimi-k3/fb-04458",
    ]);
    for (const e of imputes) expect(e.motif.length, e.docId).toBeGreaterThan(80);
  });

  it("ne cite que des questions posées, et jamais une question écartée", () => {
    const posees = new Set(manifeste.map((l) => l.file_id));
    const ecartees = new Set((JSON.parse(readFileSync(`${DOSSIER}/exclusions.json`, "utf8")) as { docId: string }[]).map((e) => e.docId));
    for (const e of imputes) {
      expect(posees.has(e.docId), e.docId).toBe(true);
      expect(ecartees.has(e.docId), e.docId).toBe(false);
    }
  });
});

describe("l'extension d'analyse-financiere", () => {
  const tri = parseCsv(readFileSync(`${DOSSIER}/tri.csv`, "utf8"));
  const extension = tri.filter((l) => l.statut === "extension" || l.statut === "extension écartée après le run");

  it("ajoute 17 calculs, pas une autre forme de réponse", () => {
    expect(extension).toHaveLength(17);
    expect(extension.every((l) => l.sous_tache === "calcul" && l.forme === "nombre")).toBe(true);
  });

  it("n'en retire aucun du premier tirage : ce sont d'autres questions", () => {
    const tirage = new Set(tri.filter((l) => l.statut === "retenue" || l.statut === "écartée après le run").map((l) => l.financebench_id));
    expect(extension.filter((l) => tirage.has(l.financebench_id!))).toEqual([]);
  });

  it("écarte, avant le run, le taux de distribution des dividendes, dont l'échelle est ambiguë", () => {
    // Un ratio que le métier écrit en pourcentage : le piège exact des deux questions ROA.
    const ligne = tri.find((l) => l.financebench_id === "financebench_id_06272")!;
    expect(ligne.statut).toBe("écartée");
    expect(ligne.motif).toMatch(/Échelle/);
  });
});
