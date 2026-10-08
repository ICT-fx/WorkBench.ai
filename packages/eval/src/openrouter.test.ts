import { describe, it, expect } from "vitest";
import { extraireJson } from "./openrouter";

describe("extraireJson", () => {
  it("lit un JSON nu", () => {
    expect(extraireJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("lit un JSON encadré de balises de code", () => {
    expect(extraireJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("lit un JSON précédé d'un commentaire du modèle", () => {
    expect(extraireJson('Voici ce que j\'ai trouvé :\n{"a":1}\nJ\'espère que cela aide.'))
      .toEqual({ a: 1 });
  });

  it("garde les objets imbriqués intacts", () => {
    expect(extraireJson('{"a":{"b":[1,2]}}')).toEqual({ a: { b: [1, 2] } });
  });

  it("lit le JSON quand l'explication qui suit contient des accolades", () => {
    // Observé le 07/10 : Mistral Large répond puis détaille son calcul en LaTeX.
    // De la première à la dernière accolade, l'extrait n'était plus du JSON.
    const texte = '```json\n{"answer": 8578}\n```\n\n**Calculation:** $\\frac{11512 + 2763}{1} - \\text{capex}$ = {8578}';
    expect(extraireJson(texte)).toEqual({ answer: 8578 });
  });

  it("lit une réponse que le modèle a écrite deux fois", () => {
    expect(extraireJson('{"answer": "yes"} ```json\n{"answer": "yes"}\n```')).toEqual({ answer: "yes" });
  });

  it("rend null quand deux objets se contredisent, plutôt que d'en choisir un", () => {
    expect(extraireJson('{"answer": 1} puis finalement {"answer": 2}')).toBeNull();
  });

  it("réunit deux objets qui ne se contredisent pas", () => {
    // Observé le 07/10 : Mistral Large ajoute, après sa réponse, un second objet
    // détaillant son raisonnement sous d'autres clés. Rien n'est contredit.
    expect(extraireJson('```json\n{"answer": "yes"}\n```\n{"categories": ["a", "b"]}'))
      .toEqual({ answer: "yes", categories: ["a", "b"] });
  });

  it("garde l'ordre : la réponse écrite d'abord n'est pas écrasée par une clé étrangère", () => {
    expect(extraireJson('{"note": "x"} {"answer": 3}')).toEqual({ note: "x", answer: 3 });
  });

  it("ignore une accolade de prose avant l'objet, et une accolade dans une chaîne", () => {
    expect(extraireJson('Voir {note} ci-dessous. {"answer": "a } b"}')).toEqual({ answer: "a } b" });
  });

  it("rend le même objet qu'avant sur tout texte qu'il lisait déjà", () => {
    // Un seul objet, avec ou sans texte autour : le résultat ne doit pas bouger.
    const objet = { answer: 12.5, detail: { a: [1, { b: "}" }] } };
    for (const [avant, apres] of [["", ""], ["Voici : ", ""], ["```json\n", "\n```"], ["", "\nJ'espère que cela aide."]]) {
      expect(extraireJson(`${avant}${JSON.stringify(objet)}${apres}`)).toEqual(objet);
    }
  });

  it("rend null plutôt que de deviner quand il n'y a pas d'objet", () => {
    expect(extraireJson("je ne sais pas lire ce document")).toBeNull();
    expect(extraireJson("[1,2,3]")).toBeNull();
    expect(extraireJson('{"a":')).toBeNull();
  });
});

describe("dimensionsJpeg", () => {
  it("lit la taille dans l'en-tête d'un vrai document du jeu", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { dimensionsJpeg } = await import("./load");
    const dir = "data/tasks/facture-fcc/documents";
    const premier = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort()[0]!;
    const d = dimensionsJpeg(await readFile(`${dir}/${premier}`));
    expect(d).not.toBeNull();
    expect(d!.largeur).toBeGreaterThan(300);
    expect(d!.hauteur).toBeGreaterThan(300);
  });
});
