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
