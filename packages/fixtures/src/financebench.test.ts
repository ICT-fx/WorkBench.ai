import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCsv } from "@hub/schema";
import {
  QUOTAS, tirageParForme, referenceNombre, recoupement, uniteImprimee,
  formesAcceptees, figureSurLaPage, ligneCsv, type Eligible,
} from "./financebench";

const eligibles: Eligible[] = [
  ...["a", "b", "c", "d", "e", "f"].map((s, i) => ({ id: `calc-${i}`, categorie: "calcul", societe: s })),
  ...[0, 1, 2, 3].map((i) => ({ id: `mono-${i}`, categorie: "oui", societe: "une-seule" })),
  { id: "autre-0", categorie: "oui", societe: "autre" },
];

describe("tirageParForme", () => {
  it("retient le quota de chaque catégorie", () => {
    const t = tirageParForme(eligibles, { calcul: 4, oui: 3 });
    expect(t.filter((id) => id.startsWith("calc-"))).toHaveLength(4);
    expect(t).toHaveLength(7);
  });

  it("ne prend pas plus de deux questions d'une même société dans une catégorie", () => {
    const oui = tirageParForme(eligibles, { oui: 3 });
    expect(oui.filter((id) => id.startsWith("mono-"))).toHaveLength(2);
    expect(oui).toContain("autre-0");
  });

  it("donne le même tirage quel que soit l'ordre du fichier", () => {
    const quotas = { calcul: 3, oui: 2 };
    expect(tirageParForme([...eligibles].reverse(), quotas)).toEqual(tirageParForme(eligibles, quotas));
  });

  it("s'arrête quand un quota ne peut pas être tenu, plutôt que de rendre moins", () => {
    expect(() => tirageParForme(eligibles, { oui: 4 })).toThrow(/quota de 4/);
  });
});

describe("le périmètre versionné", () => {
  const tri = parseCsv(readFileSync("data/tasks/analyse-financiere/tri.csv", "utf8"));

  it("trie les 150 questions ouvertes, chacune avec un statut", () => {
    expect(tri).toHaveLength(150);
    expect(new Set(tri.map((l) => l.statut)))
      .toEqual(new Set(["retenue", "éligible, non tirée", "écartée", "écartée après le run", "extension", "extension écartée après le run"]));
  });

  it("donne un motif à chaque question écartée", () => {
    expect(tri.filter((l) => (l.statut ?? "").startsWith("écartée") && l.motif === "")).toEqual([]);
  });

  it("retient exactement ce que la règle de tirage produit", () => {
    // Si ce test tombe, une ligne a été retenue ou écartée à la main.
    const tirees = tirageParForme(
      tri.filter((l) => l.categorie !== "").map((l) => ({
        id: l.financebench_id!, categorie: l.categorie!, societe: l.societe!,
      })), QUOTAS);
    // Une question écartée après le run reste dans le tirage : c'est lui qui l'a fait entrer.
    const tirage = tri.filter((l) => l.statut === "retenue" || l.statut === "écartée après le run")
      .map((l) => l.financebench_id!);
    expect([...tirees].sort()).toEqual([...tirage].sort());
    expect(tirage).toHaveLength(50);
    expect(tri.filter((l) => l.statut === "retenue")).toHaveLength(48);
  });
});

describe("referenceNombre", () => {
  it("garde l'écriture de l'analyste, sans son unité", () => {
    expect(referenceNombre("$1616.00")).toBe("1616.00");
    expect(referenceNombre("1.9%")).toBe("1.9");
    expect(referenceNombre("-0.02")).toBe("-0.02");
    expect(referenceNombre("0")).toBe("0");
  });

  it("arrête la préparation sur une valeur qui n'est pas un nombre nu", () => {
    expect(() => referenceNombre("about 12")).toThrow(/illisible/);
    expect(() => referenceNombre("$1,616.00")).toThrow(/illisible/);
    expect(() => referenceNombre("")).toThrow(/illisible/);
  });
});

describe("vérifications de page", () => {
  it("mesure la part des nombres du jeu retrouvés dans le PDF", () => {
    expect(recoupement("Sales 1,616 and 302.5", "Net sales 1,616 ... 302.5 ... 77")).toBe(1);
    expect(recoupement("Sales 1,616 and 302.5", "rien de commun 9")).toBe(0);
  });

  it("reconnaît l'unité imprimée sous ses écritures courantes", () => {
    expect(uniteImprimee("(In millions, except per share data)")).toBe("millions");
    expect(uniteImprimee("Dollars in thousands")).toBe("thousands");
    expect(uniteImprimee("(MILLIONS, EXCEPT PER COMMON SHARE DATA)")).toBe("millions");
    expect(uniteImprimee("Net sales 1,616")).toBeNull();
  });

  it("cherche un libellé comme un mot entier, pas comme un fragment", () => {
    const formes = formesAcceptees("Corporate | Corporate segment");
    expect(formes).toEqual(["Corporate", "Corporate segment"]);
    expect(figureSurLaPage("Consumer & Community Banking  Corporate  Total", formes)).toBe(true);
    expect(figureSurLaPage("Incorporated in Delaware", formes)).toBe(false);
  });
});

describe("ligneCsv", () => {
  it("se relit à l'identique, virgules et guillemets compris", () => {
    const valeurs = ["fb-00001", 'What is "net AR", in USD millions?', "$1616.00"];
    const relu = parseCsv(`a,b,c\n${ligneCsv(valeurs)}\n`)[0]!;
    expect([relu.a, relu.b, relu.c]).toEqual(valeurs);
  });
});
