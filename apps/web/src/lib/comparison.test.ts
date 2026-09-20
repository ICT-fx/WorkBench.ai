import { describe, expect, it } from "vitest";
import {
  MAX_MODELS, added, bestOfRow, defaultModels, defaultRows, knownAmount, leadWithinMargin, matchesQuery,
  meanMargin, parseSelection, radarCeiling, radarFloor, removed, replaced, resolveSelection, serializeSelection,
  splitLabel, ticksFromZero, type Known, type Selection,
} from "./comparison";

const known: Known = {
  models: new Set(["a_un", "a_deux", "b_trois", "c_quatre", "d_cinq", "e_six", "f_sept"]),
  rows: new Set(["indice", "d:finance", "d:rh", "b:facture-fr"]),
};

const defaults: Selection = { models: ["a_un", "b_trois", "c_quatre"], rows: ["indice", "d:finance", "d:rh"] };

const lire = (query: string) => parseSelection(new URLSearchParams(query), known);

describe("lecture de la sélection dans l'URL", () => {
  it("lit les modèles et les lignes dans l'ordre de l'adresse", () => {
    expect(lire("m=b_trois,a_un&l=d:rh,indice")).toEqual({
      models: ["b_trois", "a_un"], rows: ["d:rh", "indice"], solo: false,
    });
  });

  it("ignore les modèles et les lignes qui n'existent pas", () => {
    expect(lire("m=a_un,disparu,b_trois&l=d:finance,d:inconnu,x")).toMatchObject({
      models: ["a_un", "b_trois"], rows: ["d:finance"],
    });
  });

  it("ne garde qu'un exemplaire d'un modèle répété, à sa première place", () => {
    expect(lire("m=a_un,b_trois,a_un").models).toEqual(["a_un", "b_trois"]);
  });

  it("tronque à cinq modèles, doublons et inconnus écartés d'abord", () => {
    const { models } = lire("m=a_un,a_un,disparu,a_deux,b_trois,c_quatre,d_cinq,e_six,f_sept");
    expect(models).toEqual(["a_un", "a_deux", "b_trois", "c_quatre", "d_cinq"]);
    expect(models).toHaveLength(MAX_MODELS);
  });

  it("tolère les espaces et les paramètres encodés d'une adresse recopiée", () => {
    expect(lire("m=a_un%2C%20b_trois&l=d%3Afinance")).toMatchObject({ models: ["a_un", "b_trois"], rows: ["d:finance"] });
  });

  it("rend une sélection vide quand l'adresse ne dit rien", () => {
    expect(lire("")).toEqual({ models: [], rows: [], solo: false });
  });
});

describe("sélection affichée", () => {
  it("retombe sur la sélection par défaut quand l'adresse est vide ou invalide", () => {
    expect(resolveSelection(lire(""), defaults)).toEqual(defaults);
    expect(resolveSelection(lire("m=disparu,,&l=zzz"), defaults)).toEqual(defaults);
  });

  it("entoure le modèle venu d'une fiche des modèles par défaut, lui en tête", () => {
    expect(resolveSelection(lire("m=e_six"), defaults).models).toEqual(["e_six", "a_un", "b_trois", "c_quatre"]);
  });

  it("ne répète pas le modèle demandé s'il fait déjà partie du défaut", () => {
    expect(resolveSelection(lire("m=b_trois"), defaults).models).toEqual(["b_trois", "a_un", "c_quatre"]);
  });

  it("ne dépasse jamais cinq modèles en complétant", () => {
    const larges = { ...defaults, models: ["a_un", "a_deux", "b_trois", "c_quatre", "d_cinq"] };
    expect(resolveSelection(lire("m=f_sept"), larges).models).toEqual(["f_sept", "a_un", "a_deux", "b_trois", "c_quatre"]);
  });

  it("respecte le visiteur qui a tout retiré sauf un modèle", () => {
    expect(resolveSelection(lire("m=e_six&seul=1"), defaults).models).toEqual(["e_six"]);
  });

  it("garde telle quelle une sélection de plusieurs modèles", () => {
    expect(resolveSelection(lire("m=e_six,f_sept&l=b:facture-fr"), defaults)).toEqual({
      models: ["e_six", "f_sept"], rows: ["b:facture-fr"],
    });
  });
});

describe("écriture de la sélection dans l'URL", () => {
  it("écrit des virgules et des deux-points lisibles", () => {
    expect(serializeSelection({ models: ["a_un", "b_trois"], rows: ["indice", "d:rh"] })).toBe("m=a_un,b_trois&l=indice,d:rh");
  });

  it("tait les lignes quand ce sont celles par défaut", () => {
    expect(serializeSelection({ models: ["a_un", "b_trois"], rows: defaults.rows }, defaults.rows)).toBe("m=a_un,b_trois");
  });

  it("écrit les lignes par défaut dès que leur ordre change", () => {
    expect(serializeSelection({ models: ["a_un", "b_trois"], rows: ["d:rh", "indice", "d:finance"] }, defaults.rows))
      .toBe("m=a_un,b_trois&l=d:rh,indice,d:finance");
  });

  it("signale le modèle resté seul, pour ne pas le confondre avec un lien de fiche", () => {
    expect(serializeSelection({ models: ["e_six"], rows: defaults.rows }, defaults.rows)).toBe("m=e_six&seul=1");
  });

  it("restitue à la lecture ce qui a été écrit", () => {
    const selections: Selection[] = [
      { models: ["e_six"], rows: ["b:facture-fr"] },
      { models: ["a_un", "f_sept", "b_trois"], rows: defaults.rows },
      { models: ["a_un", "a_deux", "b_trois", "c_quatre", "d_cinq"], rows: ["d:rh", "b:facture-fr", "indice"] },
    ];
    for (const selection of selections) {
      const relue = resolveSelection(lire(serializeSelection(selection, defaults.rows)), defaults);
      expect(relue).toEqual(selection);
    }
  });
});

const candidat = (id: string, indice: number | null, weights: "ouverts" | "fermes" | null = "fermes", country = "US") =>
  ({ model: { id, weights }, lab: { country }, indice });

describe("sélection par défaut", () => {
  it("réunit le podium, le meilleur modèle ouvert et le meilleur modèle français", () => {
    const scores = [
      candidat("a/premier", 90), candidat("b/deuxieme", 88), candidat("c/troisieme", 85),
      candidat("d/quatrieme", 80), candidat("e/ouvert-1", 78, "ouverts", "CN"), candidat("e/ouvert-2", 70, "ouverts", "CN"),
      candidat("f/francais-ferme", 65, "fermes", "FR"), candidat("f/francais-2", 60, "fermes", "FR"),
    ];
    expect(defaultModels(scores)).toEqual(["a_premier", "b_deuxieme", "c_troisieme", "e_ouvert-1", "f_francais-ferme"]);
  });

  it("ne compte qu'une fois un modèle à la fois ouvert et français", () => {
    const scores = [
      candidat("a/premier", 90), candidat("b/deuxieme", 88), candidat("c/troisieme", 85),
      candidat("mistral/large.3", 80, "ouverts", "FR"), candidat("e/ouvert", 70, "ouverts", "CN"),
    ];
    expect(defaultModels(scores)).toEqual(["a_premier", "b_deuxieme", "c_troisieme", "mistral_large-3"]);
  });

  it("ne répète pas un modèle du podium qui est aussi le meilleur ouvert", () => {
    const scores = [candidat("a/ouvert", 90, "ouverts"), candidat("b/deux", 88), candidat("c/trois", 85), candidat("d/fr", 50, "fermes", "FR")];
    expect(defaultModels(scores)).toEqual(["a_ouvert", "b_deux", "c_trois", "d_fr"]);
  });

  it("classe par indice sans se fier à l'ordre reçu, et laisse de côté les non classés", () => {
    const scores = [candidat("z/sans-indice", null, "ouverts", "FR"), candidat("b/bas", 40), candidat("a/haut", 95)];
    expect(defaultModels(scores)).toEqual(["a_haut", "b_bas"]);
  });

  it("propose quand même des modèles tant qu'aucun indice n'est publié", () => {
    const scores = [candidat("a/un", null), candidat("b/deux", null), candidat("c/trois", null), candidat("d/quatre", null)];
    expect(defaultModels(scores)).toEqual(["a_un", "b_deux", "c_trois"]);
  });

  it("ouvre la grille sur l'indice puis tous les métiers", () => {
    expect(defaultRows([{ id: "finance" }, { id: "service-client" }])).toEqual(["indice", "d:finance", "d:service-client"]);
  });
});

describe("meilleure cellule d'une ligne", () => {
  it("désigne la plus haute valeur", () => {
    expect(bestOfRow([60, 82.5, 71])).toEqual([1]);
  });

  it("désigne la plus basse quand moins vaut mieux", () => {
    expect(bestOfRow([0.2, 0.004, 0.05], { lowerIsBetter: true })).toEqual([1]);
  });

  it("désigne tous les ex æquo", () => {
    expect(bestOfRow([80, 75, 80])).toEqual([0, 2]);
  });

  it("saute les cellules vides sans décaler les positions", () => {
    expect(bestOfRow([null, 40, null, 55])).toEqual([3]);
  });

  it("ne désigne personne sans au moins deux valeurs à comparer", () => {
    expect(bestOfRow([72])).toEqual([]);
    expect(bestOfRow([null, 72, null])).toEqual([]);
    expect(bestOfRow([null, null])).toEqual([]);
    expect(bestOfRow([])).toEqual([]);
  });

  it("ne tient pas un coût inconnu pour le moins cher", () => {
    expect(bestOfRow([0, 0.03, null, 0.01].map(knownAmount), { lowerIsBetter: true })).toEqual([3]);
  });
});

describe("avance dans la marge d'erreur", () => {
  it("ne départage pas deux scores plus proches que la plus large des deux marges", () => {
    expect(leadWithinMargin([80, 78.5, 60], [1, 2, 1])).toBe(true);
  });

  it("départage quand l'écart dépasse la marge", () => {
    expect(leadWithinMargin([80, 75], [3, 2])).toBe(false);
  });

  it("compare le premier au deuxième, où qu'ils soient dans la ligne", () => {
    expect(leadWithinMargin([50, null, 79, 80], [9, null, 1.5, 1])).toBe(true);
    expect(leadWithinMargin([50, null, 70, 80], [9, null, 1.5, 1])).toBe(false);
  });

  it("ne dit rien sans marge publiée ni sans deuxième", () => {
    expect(leadWithinMargin([80, 79.9], [null, null])).toBe(false);
    expect(leadWithinMargin([80, null], [5, null])).toBe(false);
  });
});

describe("marge d'un score par métier", () => {
  it("combine les marges de benchmarks indépendants", () => {
    // √(3² + 4²) / 2 = 2,5
    expect(meanMargin([3, 4])).toBe(2.5);
  });

  it("reste inconnue dès qu'une marge manque", () => {
    expect(meanMargin([3, undefined])).toBeNull();
    expect(meanMargin([])).toBeNull();
  });
});

describe("modification de la sélection", () => {
  it("ajoute en fin de liste, sans doublon ni dépassement", () => {
    expect(added(["a", "b"], "c", 5)).toEqual(["a", "b", "c"]);
    expect(added(["a", "b"], "a", 5)).toEqual(["a", "b"]);
    expect(added(["a", "b", "c", "d", "e"], "f", 5)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("retire, sauf le dernier", () => {
    expect(removed(["a", "b"], "a")).toEqual(["b"]);
    expect(removed(["b"], "b")).toEqual(["b"]);
  });

  it("remplace à la même place, et refuse un modèle déjà présent", () => {
    expect(replaced(["a", "b", "c"], 1, "z")).toEqual(["a", "z", "c"]);
    expect(replaced(["a", "b", "c"], 1, "c")).toEqual(["a", "b", "c"]);
    expect(replaced(["a"], 3, "z")).toEqual(["a"]);
  });
});

describe("recherche dans les listes", () => {
  it("ignore les accents et la casse", () => {
    expect(matchesQuery("comptabilite", "Comptabilité")).toBe(true);
    expect(matchesQuery("DÉPANNER", "Dépanner les collègues")).toBe(true);
  });

  it("exige chaque mot, dans n'importe quel champ", () => {
    expect(matchesQuery("opus anthropic", "Claude Opus 5", "Anthropic")).toBe(true);
    expect(matchesQuery("opus google", "Claude Opus 5", "Anthropic")).toBe(false);
  });

  it("accepte tout quand la requête est vide", () => {
    expect(matchesQuery("  ", "Finance")).toBe(true);
  });
});

describe("échelles des graphiques", () => {
  it("centre le radar cinq points sous le plus bas score, à la dizaine inférieure", () => {
    expect(radarFloor([47.2, 88, null])).toBe(40);
    // Le bord suit le plus haut score au lieu de rester figé à 100.
    expect(radarCeiling([47.2, 83.2, null])).toBe(90);
    expect(radarCeiling([99])).toBe(100);
    expect(radarCeiling([null])).toBe(100);
    expect(radarFloor([44, 90])).toBe(30);
  });

  it("ne descend pas sous zéro et ne s'effondre pas sans donnée", () => {
    expect(radarFloor([3, 50])).toBe(0);
    expect(radarFloor([null])).toBe(0);
  });

  it("gradue de zéro jusqu'au-dessus du maximum, en pas ronds", () => {
    expect(ticksFromZero(14.3)).toEqual([0, 5, 10, 15]);
    expect(ticksFromZero(0.0234)).toEqual([0, 0.01, 0.02, 0.03]);
    expect(ticksFromZero(100)).toEqual([0, 25, 50, 75, 100]);
  });

  it("garde une échelle même quand il n'y a rien à mesurer", () => {
    expect(ticksFromZero(0)).toEqual([0, 1]);
  });

  it("coupe un long libellé d'axe en deux lignes équilibrées", () => {
    expect(splitLabel("Ressources humaines")).toEqual(["Ressources", "humaines"]);
    expect(splitLabel("Achats & logistique")).toEqual(["Achats &", "logistique"]);
    expect(splitLabel("Comptabilité")).toEqual(["Comptabilité"]);
    // Une conjonction ne commence pas la seconde ligne.
    expect(splitLabel("Informatique et réseaux")).toEqual(["Informatique et", "réseaux"]);
  });
});
