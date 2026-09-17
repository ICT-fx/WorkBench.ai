import { describe, it, expect } from "vitest";
import type { LeaderboardRow } from "@hub/schema";
import { recommandations, SEUIL_HALLUCINATION } from "./recommandations";

const row = (o: Partial<LeaderboardRow> & { model: string }): LeaderboardRow => ({
  modelVersion: `${o.model}-v1`, sansRelecture: 50, exactitude: 50,
  hallucinations: 0, costPerDoc: 0.01, latencyP50: 1000, errorCount: 0, docCount: 25, ...o,
});

describe("recommandations", () => {
  const rows = [
    row({ model: "exact-et-cher", exactitude: 97, sansRelecture: 88, costPerDoc: 0.05 }),
    row({ model: "equilibre", exactitude: 92, sansRelecture: 80, costPerDoc: 0.004 }),
    row({ model: "bon-marche", exactitude: 71, sansRelecture: 40, costPerDoc: 0.0004 }),
  ];

  it("désigne le plus exact pour la précision maximale", () => {
    expect(recommandations(rows)!.precision.model).toBe("exact-et-cher");
  });

  it("désigne le meilleur rapport exactitude/coût", () => {
    expect(recommandations(rows)!.rapport.model).toBe("equilibre");
  });

  it("ne présente pas comme bonne affaire un modèle bon marché mais imprécis", () => {
    const r = recommandations(rows)!;
    // bon-marche est vingt fois moins cher par point d'exactitude, mais il ne
    // traite que 40 % des factures sans relecture : ce n'est pas une affaire.
    expect(r.rapport.model).not.toBe("bon-marche");
  });

  it("désigne le moins halluciné pour le moindre risque", () => {
    const avecRisques = [
      row({ model: "prudent", exactitude: 80, hallucinations: 0 }),
      row({ model: "bavard", exactitude: 95, hallucinations: 12 }),
    ];
    expect(recommandations(avecRisques)!.risque.model).toBe("prudent");
  });

  it("écarte de toute recommandation un modèle qui invente", () => {
    const bavardEnTete = [
      row({ model: "bavard", exactitude: 99, sansRelecture: 95, costPerDoc: 0.0001, hallucinations: 4 }),
      row({ model: "honnete", exactitude: 85, sansRelecture: 70, costPerDoc: 0.02, hallucinations: 0 }),
    ];
    const r = recommandations(bavardEnTete)!;
    // Premier partout, mais il invente : il ne peut être recommandé pour rien.
    expect([r.precision.model, r.rapport.model, r.risque.model]).toEqual(["honnete", "honnete", "honnete"]);
  });

  it("ne recommande rien plutôt que de recommander un modèle qui invente", () => {
    expect(recommandations([row({ model: "seul", hallucinations: SEUIL_HALLUCINATION + 1 })])).toBeNull();
  });

  it("ne recommande rien quand le classement est vide", () => {
    expect(recommandations([])).toBeNull();
  });

  it("écarte aussi un modèle dont trop d'appels ont échoué", () => {
    const rows = [
      row({ model: "instable", exactitude: 99, errorCount: 3, docCount: 22, hallucinations: 0 }),
      row({ model: "stable", exactitude: 80, errorCount: 0, docCount: 25, hallucinations: 0 }),
    ];
    expect(recommandations(rows)!.precision.model).toBe("stable");
  });
});
