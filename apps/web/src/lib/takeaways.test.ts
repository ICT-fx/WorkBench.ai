import { describe, expect, it } from "vitest";
import type { Benchmark, Leaderboard, LeaderboardRow } from "@hub/schema";
import { getDictionary } from "@/i18n";
import { takeaways } from "./takeaways";

const benchmark: Benchmark = {
  id: "test", domain: "finance", label: { fr: "Test", en: "Test" }, question: { fr: "?", en: "?" },
  description: { fr: "d", en: "d" }, input: "texte", unit: { fr: "facture", en: "invoice" }, sampleSize: 40,
  subtasks: [{ id: "facile", label: { fr: "Facile", en: "Easy" } }, { id: "dur", label: { fr: "Dur", en: "Hard" } }],
  maturity: "maquette",
};

const row = (model: string, exactitude: number, over: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  model, modelVersion: "v", sansRelecture: 50, exactitude, hallucinations: 0, costPerDoc: 0.1,
  latencyP50: 1000, errorCount: 0, docCount: 40, ci: 2, bySubtask: { facile: exactitude + 5, dur: exactitude - 20 }, ...over,
});

const classement = (rows: LeaderboardRow[]): Leaderboard =>
  ({ taskId: "test", runId: "r", status: "reel", runDate: "2026-09-15", sampleSize: 40, rows });

const lire = (rows: LeaderboardRow[], excluded = 0) => takeaways({
  benchmark, leaderboard: classement(rows), excluded, locale: "fr", dict: getDictionary("fr"),
  names: new Map([["a/un", "Un"], ["b/deux", "Deux"], ["c/trois", "Trois"]]),
});

describe("phrases « À retenir »", () => {
  it("nomme le podium avec les noms d'affichage, pas les identifiants", () => {
    const [podium] = lire([row("a/un", 90), row("b/deux", 80), row("c/trois", 70)]);
    expect(podium).toContain("Un prend la tête");
    expect(podium).toContain("Deux");
    expect(podium).not.toContain("a/un");
  });

  it("dit que le test ne départage pas deux modèles plus proches que la marge d'erreur", () => {
    expect(lire([row("a/un", 90), row("b/deux", 89), row("c/trois", 70)]).some((p) => p.includes("marge d'erreur"))).toBe(true);
    expect(lire([row("a/un", 90), row("b/deux", 80), row("c/trois", 70)]).some((p) => p.includes("marge d'erreur"))).toBe(false);
  });

  it("chiffre le meilleur rapport précision-prix face au premier", () => {
    const phrases = lire([row("a/un", 90, { costPerDoc: 0.2 }), row("b/deux", 88, { costPerDoc: 0.02 }), row("c/trois", 60)]);
    expect(phrases.some((p) => p.includes("Deux") && p.includes("10 fois moins cher"))).toBe(true);
  });

  it("signale le modèle qui invente, seulement quand il invente vraiment", () => {
    expect(lire([row("a/un", 90), row("b/deux", 80, { hallucinations: 12 })]).some((p) => p.includes("Deux invente"))).toBe(true);
    expect(lire([row("a/un", 90), row("b/deux", 80, { hallucinations: 1 })]).some((p) => p.includes("invente dans"))).toBe(false);
  });

  it("désigne la sous-tâche où même le meilleur plafonne", () => {
    expect(lire([row("a/un", 90), row("b/deux", 80)]).some((p) => p.includes("« Dur »"))).toBe(true);
  });

  it("mentionne les modèles écartés faute de savoir lire un document", () => {
    expect(lire([row("a/un", 90), row("b/deux", 80)], 13).at(-1)).toContain("13 modèles");
  });

  it("ne dit rien d'un classement à un seul modèle", () => {
    expect(lire([row("a/un", 90)])).toEqual([]);
  });
});
