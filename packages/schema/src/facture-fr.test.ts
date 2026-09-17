import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TaskSchema } from "./index";

const task = TaskSchema.parse(
  JSON.parse(readFileSync("data/tasks/facture-fr/task.json", "utf8")),
);

describe("barème facture-fr", () => {
  it("contient les dix critères du design, ni plus ni moins", () => {
    expect(task.criteria.map((c) => c.id).sort()).toEqual([
      "date_emission", "echeance", "lignes", "mentions_speciales", "numero_facture",
      "siret_emetteur", "total_ht", "total_ttc", "total_tva", "tva_intracom",
    ]);
  });

  it("marque comme critiques exactement les champs qui déclenchent une relecture", () => {
    expect(task.criteria.filter((c) => c.critical).map((c) => c.id).sort()).toEqual([
      "date_emission", "numero_facture", "siret_emetteur", "total_ht", "total_ttc", "total_tva",
    ]);
  });

  it("donne une tolérance nulle aux montants", () => {
    for (const id of ["total_ht", "total_tva", "total_ttc"]) {
      expect(task.criteria.find((c) => c.id === id)!.tolerance).toBe(0);
    }
  });

  it("pèse les montants et le SIRET au maximum", () => {
    for (const id of ["total_ht", "total_tva", "total_ttc", "siret_emetteur"]) {
      expect(task.criteria.find((c) => c.id === id)!.weight).toBe(3);
    }
  });

  it("donne à chaque critère le kind attendu par les comparateurs", () => {
    const kinds = Object.fromEntries(task.criteria.map((c) => [c.id, c.kind]));
    expect(kinds).toEqual({
      numero_facture: "exact", siret_emetteur: "exact", tva_intracom: "exact",
      date_emission: "date", echeance: "date",
      total_ht: "number", total_tva: "number", total_ttc: "number",
      lignes: "lines", mentions_speciales: "text",
    });
  });
});

describe("prompt facture-fr", () => {
  const prompt = readFileSync("data/tasks/facture-fr/prompt.md", "utf8");

  it("impose null quand l'information est absente", () => {
    expect(prompt).toMatch(/null/);
    expect(prompt.toLowerCase()).toMatch(/ne figure pas|absent/);
    expect(prompt.toLowerCase()).toMatch(/ne devine jamais/);
  });

  it("nomme les dix clés attendues en sortie", () => {
    for (const id of task.criteria.map((c) => c.id)) {
      expect(prompt).toContain(id);
    }
  });

  it("fixe le format des dates et des montants", () => {
    expect(prompt).toContain("AAAA-MM-JJ");
    expect(prompt.toLowerCase()).toMatch(/sans symbole|sans séparateur/);
  });
});
