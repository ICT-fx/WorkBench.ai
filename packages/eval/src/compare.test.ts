import { describe, it, expect } from "vitest";
import type { Criterion } from "@hub/schema";
import { compareField } from "./compare";

const num: Criterion = { id: "total_ttc", label: "TTC", kind: "number", weight: 3, critical: true, tolerance: 0 };
const date: Criterion = { id: "date_emission", label: "Date", kind: "date", weight: 2, critical: true };
const exact: Criterion = { id: "siret_emetteur", label: "SIRET", kind: "exact", weight: 3, critical: true };
const lines: Criterion = { id: "lignes", label: "Lignes", kind: "lines", weight: 2, critical: false };
const text: Criterion = { id: "mentions_speciales", label: "Mentions", kind: "text", weight: 1, critical: false };

describe("les trois verdicts face à un champ absent", () => {
  it("attendu null, rien produit → correct", () => {
    expect(compareField(num, null, null)).toBe("correct");
  });
  it("attendu null, une valeur produite → hallucine", () => {
    expect(compareField(num, null, 42)).toBe("hallucine");
  });
  it("attendu une valeur, rien produit → manquant", () => {
    expect(compareField(num, 42, null)).toBe("manquant");
  });
  it("une chaîne vide vaut une absence, pas une valeur inventée", () => {
    expect(compareField(exact, null, "")).toBe("correct");
  });
  it("les formules d'abstention courantes valent une absence", () => {
    for (const abstention of ["N/A", "n/a", "non trouvé", "non renseigné", "-", "—", "null", "aucune"]) {
      expect(compareField(exact, null, abstention)).toBe("correct");
    }
  });
  it("undefined vaut une absence", () => {
    expect(compareField(num, 42, undefined)).toBe("manquant");
  });
});

describe("montants", () => {
  it("accepte une valeur au centime près et refuse au-delà", () => {
    expect(compareField(num, 1234.56, 1234.56)).toBe("correct");
    expect(compareField(num, 1234.56, 1234.57)).toBe("faux");
  });
  it("lit un montant rendu en chaîne avec virgule et séparateur de milliers", () => {
    expect(compareField(num, 1234.56, "1 234,56")).toBe("correct");
    expect(compareField(num, 1234.56, "1.234,56 €")).toBe("correct");
    expect(compareField(num, 1234.56, "1,234.56")).toBe("correct");
  });
  it("accepte l'espace insécable étroit des formats français", () => {
    expect(compareField(num, 12102, "12 102,00 €")).toBe("correct");
  });
  it("distingue un avoir d'une facture de même montant", () => {
    expect(compareField(num, -120, 120)).toBe("faux");
    expect(compareField(num, -120, "-120,00 €")).toBe("correct");
  });
  it("respecte une tolérance explicite quand le critère en définit une", () => {
    const tolerant: Criterion = { ...num, tolerance: 0.02 };
    expect(compareField(tolerant, 100, 100.02)).toBe("correct");
    expect(compareField(tolerant, 100, 100.03)).toBe("faux");
  });
  it("ne prend pas un montant inférieur à 1 pour un séparateur de milliers", () => {
    // « 0,125 » et « 0.125 » valent 0,125 : un groupe de milliers ne commence
    // jamais par zéro. Les lire comme 125 multiplierait le montant par mille.
    expect(compareField(num, 0.125, "0,125")).toBe("correct");
    expect(compareField(num, 0.125, "0.125")).toBe("correct");
  });

  it("lit plusieurs groupes de milliers", () => {
    expect(compareField(num, 1234567, "1.234.567")).toBe("correct");
    expect(compareField(num, 1234567.89, "1.234.567,89")).toBe("correct");
  });

  it("refuse une valeur non numérique", () => {
    expect(compareField(num, 100, "cent euros")).toBe("faux");
  });
});

describe("dates", () => {
  it("normalise les formats courants vers la même date", () => {
    expect(compareField(date, "2026-03-04", "04/03/2026")).toBe("correct");
    expect(compareField(date, "2026-03-04", "4 mars 2026")).toBe("correct");
    expect(compareField(date, "2026-03-04", "04-03-2026")).toBe("correct");
    expect(compareField(date, "2026-03-04", "2026-03-04")).toBe("correct");
  });
  it("ne confond pas jour et mois sur une date ambiguë au format US", () => {
    expect(compareField(date, "2026-03-04", "03/04/2026")).toBe("faux");
  });
  it("refuse une date illisible", () => {
    expect(compareField(date, "2026-03-04", "le mois dernier")).toBe("faux");
  });
});

describe("dates selon la convention du pays du document", () => {
  const dateUS: Criterion = { ...date, dateOrder: "MDY" };

  it("lit 02/03/20 comme le 3 février sur un document américain", () => {
    expect(compareField(dateUS, "2026-02-03", "02/03/26")).toBe("correct");
  });

  it("et comme le 2 mars sur un document français", () => {
    expect(compareField(date, "2026-03-02", "02/03/26")).toBe("correct");
  });

  it("refuse l'autre lecture, sinon l'inversion jour/mois ne se verrait jamais", () => {
    expect(compareField(dateUS, "2026-03-02", "02/03/26")).toBe("faux");
    expect(compareField(date, "2026-02-03", "02/03/26")).toBe("faux");
  });

  it("accepte une année sur deux chiffres", () => {
    expect(compareField(dateUS, "2020-02-03", "2/3/20")).toBe("correct");
  });

  it("lit l'ISO de la même façon quelle que soit la convention", () => {
    expect(compareField(dateUS, "2026-02-03", "2026-02-03")).toBe("correct");
    expect(compareField(date, "2026-02-03", "2026-02-03")).toBe("correct");
  });

  it("lit un mois écrit en toutes lettres quelle que soit la convention", () => {
    expect(compareField(dateUS, "2026-02-03", "February 3, 2026")).toBe("correct");
  });
});

describe("champs exacts", () => {
  it("ignore les espaces et la casse mais pas les chiffres", () => {
    expect(compareField(exact, "40483304800022", "404 833 048 00022")).toBe("correct");
    expect(compareField(exact, "40483304800022", "40483304800023")).toBe("faux");
  });
  it("ignore les accents et la ponctuation de séparation", () => {
    expect(compareField(exact, "FR31249785644", "fr-31 249 785 644")).toBe("correct");
  });
});

describe("lignes", () => {
  const attendues = [
    { designation: "Licence logicielle — 12 mois", quantite: 3, prix_unitaire_ht: 420, taux_tva: 20 },
    { designation: "Formation utilisateurs", quantite: 2, prix_unitaire_ht: 950, taux_tva: 20 },
  ];
  it("accepte des lignes identiques dans un ordre différent", () => {
    expect(compareField(lines, attendues, [attendues[1], attendues[0]])).toBe("correct");
  });
  it("accepte une désignation reformulée si les chiffres concordent", () => {
    expect(compareField(lines, attendues, [
      { designation: "Licence logicielle 12 mois", quantite: 3, prix_unitaire_ht: 420, taux_tva: 20 },
      { designation: "Formation des utilisateurs", quantite: 2, prix_unitaire_ht: 950, taux_tva: 20 },
    ])).toBe("correct");
  });
  it("refuse quand une ligne manque", () => {
    expect(compareField(lines, attendues, [attendues[0]])).toBe("faux");
  });
  it("refuse quand un montant de ligne est faux", () => {
    expect(compareField(lines, attendues, [
      attendues[0], { ...attendues[1]!, prix_unitaire_ht: 95 },
    ])).toBe("faux");
  });
});

describe("mentions", () => {
  it("accepte une reformulation qui conserve les termes porteurs de sens", () => {
    expect(compareField(text, "TVA non applicable, article 293 B du CGI",
      "TVA non applicable — art. 293 B du CGI")).toBe("correct");
  });
  it("refuse une mention qui perd la référence légale", () => {
    expect(compareField(text, "TVA non applicable, article 293 B du CGI",
      "Pas de TVA sur cette facture")).toBe("faux");
  });
});

describe("nombres arrondis d'un rapport américain", () => {
  // Les références de FinanceBench sont arrondies, et le rapport écrit ses
  // décimales avec un point : la tolérance et la lecture suivent le document.
  const fin: Criterion = {
    id: "calcul", label: "Calcul", kind: "number", weight: 1, critical: true,
    toleranceRelative: 0.005, decimalSeparator: ".",
  };

  it.each([
    ["1616.00", 1615.9, "correct"],     // la page porte 1 615,9, la référence arrondit
    ["303.00", 302.578, "correct"],     // 302 578 milliers, rendus en millions
    ["303.00", 302578, "faux"],         // l'unité demandée n'est pas respectée
    ["1.9", 1.94, "correct"],           // moitié du dernier chiffre affiché : 0,05
    ["1.9", 2.0, "faux"],
    ["0.66", "0.664", "correct"],
    ["1.73", "1.734", "correct"],       // 1,734 et non 1 734
    ["-0.02", -0.019, "correct"],
    ["-0.02", 0.02, "faux"],            // le signe compte
    ["1.9", "1.9%", "correct"],         // l'écriture ne fait pas tomber une valeur juste
    ["1616.00", "$1,616", "correct"],
    ["0", 0, "correct"],
    ["0", 411, "faux"],
  ] as const)("attendu %s, produit %s → %s", (attendu, produit, verdict) => {
    expect(compareField(fin, attendu, produit)).toBe(verdict);
  });

  it("garde la lecture française quand le séparateur n'est pas fixé", () => {
    expect(compareField(num, 1234, "1.234")).toBe("correct");
  });
});

describe("libellé parmi plusieurs formes acceptées", () => {
  it("accepte l'une des formes, sans égard à la casse ni à la ponctuation", () => {
    expect(compareField(exact, ["Corporate", "Corporate segment"], "corporate")).toBe("correct");
    expect(compareField(exact, ["operations", "operating activities"], "Operating activities")).toBe("correct");
  });

  it("refuse un libellé qui contient la forme attendue sans l'être", () => {
    // Une comparaison par inclusion compterait juste un autre segment de la banque.
    expect(compareField(exact, ["Corporate", "Corporate segment"], "Corporate & Investment Bank")).toBe("faux");
  });

  it("lit un verdict sans le prendre pour une abstention", () => {
    expect(compareField(exact, "yes", "Yes")).toBe("correct");
    expect(compareField(exact, "no", "no")).toBe("correct");
    expect(compareField(exact, "no", "yes")).toBe("faux");
  });

  it("distingue « il n'y en a pas » d'un poste inventé", () => {
    expect(compareField(exact, null, "None")).toBe("correct");
    expect(compareField(exact, null, "Class A notes")).toBe("hallucine");
  });
});
