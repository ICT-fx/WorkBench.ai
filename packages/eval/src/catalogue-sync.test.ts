import { describe, expect, it } from "vitest";
import { mergeSeed } from "./catalogue-sync";

const seed = [
  { id: "labo/present", name: "Présent", lab: "labo", released: "2026-01-01", weights: "fermes" as const },
  { id: "labo/absent", name: "Absent", lab: "labo", released: "2026-02-01", weights: null },
];

describe("synchronisation du catalogue", () => {
  it("convertit les tarifs au token en dollars par million, sans bruit flottant", () => {
    const { models } = mergeSeed(seed, [{
      id: "labo/present", context_length: 200000,
      top_provider: { max_completion_tokens: 64000 }, supported_parameters: ["reasoning"],
      architecture: { input_modalities: ["text", "image", "file", "braille"] },
      pricing: { prompt: "0.0000003", completion: "0.0000012" },
    }]);
    expect(models[0]).toMatchObject({
      priceIn: 0.3, priceOut: 1.2, contextWindow: 200000, maxOutput: 64000, reasoning: true,
      // « file » est le nom qu'OpenRouter donne au PDF natif, qui est notre
      // modalité `pdf`. Une modalité qu'on ne sait pas nommer est ignorée
      // plutôt que de faire échouer la synchronisation.
      modalities: ["text", "image", "pdf"],
    });
  });

  it("lit aussi la forme de catalogue de la passerelle Vercel", () => {
    const { models } = mergeSeed(seed, [{
      id: "labo/present", context_window: 128000, max_tokens: 8192, tags: ["reasoning"],
      modalities: { input: ["text", "image"] }, pricing: { input: "0.000001", output: "0.000002" },
    }]);
    expect(models[0]).toMatchObject({
      priceIn: 1, priceOut: 2, contextWindow: 128000, maxOutput: 8192, modalities: ["text", "image"],
    });
  });

  it("relève la version datée de chaque identifiant, ou null quand le catalogue ne la donne pas", () => {
    const { models } = mergeSeed(seed, [{ id: "labo/present", canonical_slug: "labo/present-20260921" }]);
    expect(models.map((m) => m.canonicalSlug)).toEqual(["labo/present-20260921", null]);
  });

  it("laisse à null ce que le catalogue ne dit pas, et signale le modèle absent", () => {
    const { models, absents } = mergeSeed(seed, []);
    expect(absents).toEqual(["labo/present", "labo/absent"]);
    expect(models[1]).toMatchObject({ priceIn: null, contextWindow: null, modalities: ["text"], reasoning: false });
  });
});
