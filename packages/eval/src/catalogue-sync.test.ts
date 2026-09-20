import { describe, expect, it } from "vitest";
import { mergeSeed } from "./catalogue-sync";

const seed = [
  { id: "labo/present", name: "Présent", lab: "labo", released: "2026-01-01", weights: "fermes" as const },
  { id: "labo/absent", name: "Absent", lab: "labo", released: "2026-02-01", weights: null },
];

describe("synchronisation du catalogue", () => {
  it("convertit les tarifs au token en dollars par million, sans bruit flottant", () => {
    const { models } = mergeSeed(seed, [{
      id: "labo/present", context_window: 200000, max_tokens: 64000, tags: ["reasoning"],
      modalities: { input: ["text", "image", "file"] }, pricing: { input: "0.0000003", output: "0.0000012" },
    }]);
    expect(models[0]).toMatchObject({
      priceIn: 0.3, priceOut: 1.2, contextWindow: 200000, reasoning: true,
      // « file » n'est pas une modalité que le site sait nommer : on l'ignore plutôt que d'échouer.
      modalities: ["text", "image"],
    });
  });

  it("laisse à null ce que le catalogue ne dit pas, et signale le modèle absent", () => {
    const { models, absents } = mergeSeed(seed, []);
    expect(absents).toEqual(["labo/present", "labo/absent"]);
    expect(models[1]).toMatchObject({ priceIn: null, contextWindow: null, modalities: ["text"], reasoning: false });
  });
});
