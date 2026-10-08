import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { TaskSchema, GroundTruthSchema } from "./index";

const task = TaskSchema.parse(
  JSON.parse(readFileSync("data/tasks/facture-fcc/task.json", "utf8")),
);

describe("barème facture-fcc", () => {
  it("ne note que ce qui n'admet qu'une seule bonne réponse", () => {
    // Ces factures portent six identifiants distincts et deux périodes
    // également défendables. Noter ces champs mesurerait si le modèle devine
    // ce qu'on voulait, pas s'il sait lire : la question ne leur est plus posée.
    expect(task.criteria.map((c) => c.id).sort()).toEqual(["gross_amount", "vat_number"]);
  });

  it("ne porte aucun champ écarté : ce qui n'est pas notable n'est pas demandé", () => {
    expect(task.criteria.every((c) => c.exclu === undefined)).toBe(true);
  });

  it("fait du montant le champ critique, pesé au maximum, au centime près", () => {
    const montant = task.criteria.find((c) => c.id === "gross_amount")!;
    expect(montant.critical).toBe(true);
    expect(montant.weight).toBe(3);
    expect(montant.tolerance).toBe(0);
  });

  it("garde le numéro de TVA comme piège à hallucination, non critique", () => {
    // Aucune de ces factures américaines n'en porte : toute valeur est inventée.
    const tva = task.criteria.find((c) => c.id === "vat_number")!;
    expect(tva.critical).toBe(false);
    expect(tva.kind).toBe("exact");
  });
});

describe("prompt facture-fcc", () => {
  const prompt = readFileSync("data/tasks/facture-fcc/prompt.md", "utf8");

  it("impose null quand l'information est absente", () => {
    expect(prompt).toMatch(/null/);
    expect(prompt.toLowerCase()).toMatch(/does not appear|absent/);
    expect(prompt.toLowerCase()).toMatch(/never guess/);
  });

  it("demande les champs que le barème note", () => {
    for (const id of task.criteria.map((c) => c.id)) expect(prompt).toContain(id);
  });

  it("fixe le format des montants", () => {
    expect(prompt.toLowerCase()).toMatch(/no currency symbol|no thousands/);
  });
});

describe("vérités terrain facture-fcc", () => {
  it("déclarent toutes les deux champs notés : un champ omis ne serait pas noté", () => {
    // Depuis qu'un champ omis vaut « non posé », un oubli dans la vérité terrain
    // sortirait le document de la note sans bruit. Ici, tout est posé partout.
    const dossier = "data/tasks/facture-fcc/ground-truth";
    for (const fichier of readdirSync(dossier)) {
      const gt = GroundTruthSchema.parse(JSON.parse(readFileSync(`${dossier}/${fichier}`, "utf8")));
      for (const c of task.criteria) expect(c.id in gt.fields, `${fichier} · ${c.id}`).toBe(true);
    }
  });
});
