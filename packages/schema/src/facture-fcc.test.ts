import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TaskSchema } from "./index";

const task = TaskSchema.parse(
  JSON.parse(readFileSync("data/tasks/facture-fcc/task.json", "utf8")),
);

const notes = task.criteria.filter((c) => c.exclu === undefined);

describe("barème facture-fcc", () => {
  it("contient les six champs demandés au modèle, ni plus ni moins", () => {
    expect(task.criteria.map((c) => c.id).sort()).toEqual([
      "advertiser", "contract_num", "flight_from", "flight_to", "gross_amount", "vat_number",
    ]);
  });

  it("ne note que les trois champs dont la question n'a qu'une réponse", () => {
    expect(notes.map((c) => c.id).sort()).toEqual(["flight_to", "gross_amount", "vat_number"]);
  });

  it("écrit la raison de chaque champ écarté, pour qu'elle soit publiable", () => {
    // Un champ retiré sans raison lisible est indistinguable d'un champ retiré
    // parce qu'il arrangeait le classement.
    for (const c of task.criteria.filter((x) => x.exclu !== undefined)) {
      expect(c.exclu!.length).toBeGreaterThan(40);
    }
  });

  it("marque comme critiques exactement les champs qui déclenchent une relecture", () => {
    expect(notes.filter((c) => c.critical).map((c) => c.id).sort()).toEqual(["flight_to", "gross_amount"]);
  });

  it("donne une tolérance nulle au montant", () => {
    expect(task.criteria.find((c) => c.id === "gross_amount")!.tolerance).toBe(0);
  });

  it("pèse le montant total au maximum", () => {
    expect(task.criteria.find((c) => c.id === "gross_amount")!.weight).toBe(3);
  });

  it("lit les dates à l'américaine, comme les documents les écrivent", () => {
    // Lire 02/03 à la française sur une facture américaine a déjà produit une
    // vingtaine d'erreurs attribuées à tort aux modèles.
    for (const c of task.criteria.filter((x) => x.kind === "date")) {
      expect(c.dateOrder).toBe("MDY");
    }
  });

  it("donne à chaque critère le kind attendu par les comparateurs", () => {
    expect(Object.fromEntries(task.criteria.map((c) => [c.id, c.kind]))).toEqual({
      contract_num: "exact", advertiser: "exact", vat_number: "exact",
      flight_from: "date", flight_to: "date",
      gross_amount: "number",
    });
  });
});

describe("prompt facture-fcc", () => {
  const prompt = readFileSync("data/tasks/facture-fcc/prompt.md", "utf8");

  it("impose null quand l'information est absente", () => {
    expect(prompt).toMatch(/null/);
    expect(prompt.toLowerCase()).toMatch(/does not appear|absent/);
    expect(prompt.toLowerCase()).toMatch(/never guess/);
  });

  it("nomme les six clés attendues en sortie", () => {
    for (const id of task.criteria.map((c) => c.id)) {
      expect(prompt).toContain(id);
    }
  });

  it("fixe le format des dates et des montants", () => {
    expect(prompt).toContain("YYYY-MM-DD");
    expect(prompt.toLowerCase()).toMatch(/no currency symbol|no thousands/);
  });
});
