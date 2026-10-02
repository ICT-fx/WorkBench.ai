import { describe, it, expect } from "vitest";
import { montant, dateUS, toGroundTruth, tirage, ValeurIllisible } from "./deepform";
import { parseCsv } from "@hub/schema";

describe("lecture du manifeste", () => {
  it("lit un CSV avec des virgules dans les champs entre guillemets", () => {
    const r = parseCsv('a,b\n1,"Bloomberg, Inc."\n');
    expect(r[0]).toEqual({ a: "1", b: "Bloomberg, Inc." });
  });
});

describe("montants", () => {
  it("lit les deux écritures présentes dans le manifeste", () => {
    expect(montant("$1,880.00")).toBe(1880);
    expect(montant("14,625.00")).toBe(14625);
  });
  it("rend null sur une cellule vide, pas zéro", () => {
    expect(montant("")).toBeNull();
    expect(montant("   ")).toBeNull();
  });

  it("refuse un montant présent mais illisible", () => {
    expect(() => montant("à confirmer")).toThrow(ValeurIllisible);
  });
});

describe("dates américaines", () => {
  it("lit 02/03/20 comme le 3 février 2020", () => {
    expect(dateUS("02/03/20")).toBe("2020-02-03");
  });
  it("accepte une année sur quatre chiffres", () => {
    expect(dateUS("12/25/2020")).toBe("2020-12-25");
  });
  it("lit les mois écrits, présents tels quels dans le manifeste", () => {
    expect(dateUS("February 12, 2020")).toBe("2020-02-12");
    expect(dateUS("May12/20")).toBe("2020-05-12");
    expect(dateUS("Feb 3 2020")).toBe("2020-02-03");
  });

  it("rend null sur une cellule vide", () => {
    expect(dateUS("")).toBeNull();
    expect(dateUS("   ")).toBeNull();
  });

  it("refuse de deviner une valeur présente mais illisible, et le fait savoir", () => {
    // « 4/26/202 » est une coquille du manifeste. La transformer en null en
    // ferait un piège à hallucination imaginaire : un modèle qui lit
    // correctement la date serait accusé de l'avoir inventée.
    expect(() => dateUS("4/26/202")).toThrow(ValeurIllisible);
    expect(() => dateUS("13/45/20")).toThrow(ValeurIllisible);
    expect(() => dateUS("le mois dernier")).toThrow(ValeurIllisible);
  });
});

describe("vérité terrain", () => {
  const ligne = {
    file_id: "abc", title: "t", contract_num: "507337-1", advertiser: "Mike Bloomberg 2020, Inc.",
    gross_amount: "$1,880.00", flight_from: "02/03/20", flight_to: "03/29/20", issues: "", url: "u",
  };

  it("normalise les cinq champs et pose la sonde à null", () => {
    expect(toGroundTruth(ligne).fields).toEqual({
      contract_num: "507337-1", advertiser: "Mike Bloomberg 2020, Inc.",
      gross_amount: 1880, flight_from: "2020-02-03", flight_to: "2020-03-29",
      vat_number: null,
    });
  });

  it("laisse toujours la sonde vide : aucune de ces factures ne porte de TVA", () => {
    expect(toGroundTruth({ ...ligne, contract_num: "autre" }).fields.vat_number).toBeNull();
  });

  it("met à null un champ absent du document, ce qui en fait un piège", () => {
    const gt = toGroundTruth({ ...ligne, contract_num: "", gross_amount: "" });
    expect(gt.fields.contract_num).toBeNull();
    expect(gt.fields.gross_amount).toBeNull();
  });
});

describe("tirage", () => {
  it("donne le même échantillon à graine égale", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i);
    expect(tirage(xs, 10, 7)).toEqual(tirage(xs, 10, 7));
  });
  it("et un autre à graine différente", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i);
    expect(tirage(xs, 10, 7)).not.toEqual(tirage(xs, 10, 8));
  });
});
