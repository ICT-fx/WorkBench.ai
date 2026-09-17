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
