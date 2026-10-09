import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { DocScoreSchema, ReviewItemSchema, type DocScore, type ReviewItem } from "@hub/schema";
import { applyReview } from "../../../../packages/eval/src/publish";
import { appliquerArbitrages, requalifications } from "./arbitrage";
import { loadLeaderboard, loadRequalifications, loadScores, loadTask, publishedTaskIds } from "./data";

const note = (model: string, verdict: "correct" | "faux" | "hallucine"): DocScore => ({
  model, docId: "d-1", needsReview: verdict !== "correct",
  byCriterion: {
    libelle: { got: "x", expected: null, verdict, points: verdict === "correct" ? 1 : 0, maxPoints: 1 },
    autre: { got: 1, expected: 1, verdict: "correct", points: 2, maxPoints: 2 },
  },
});

const decision = (model: string, autoVerdict: ReviewItem["autoVerdict"], humanVerdict: ReviewItem["humanVerdict"]): ReviewItem => ({
  model, docId: "d-1", criterionId: "libelle", autoVerdict, humanVerdict, reason: "motif", decidedAt: "2026-10-09T08:00:00.000Z",
});

describe("arbitrages humains appliqués aux notes", () => {
  it("remplace le verdict du comparateur par celui de l'humain, et rien d'autre", () => {
    const [a, b] = appliquerArbitrages([note("m/a", "hallucine"), note("m/b", "hallucine")], [decision("m/a", "hallucine", "faux")]);
    expect(a!.byCriterion.libelle).toMatchObject({ verdict: "faux", points: 0 });
    expect(a!.byCriterion.autre).toMatchObject({ verdict: "correct", points: 2 });
    expect(b!.byCriterion.libelle!.verdict).toBe("hallucine");
  });

  it("rend les points d'un champ que l'humain juge correct", () => {
    const [a] = appliquerArbitrages([note("m/a", "faux")], [decision("m/a", "faux", "correct")]);
    expect(a!.byCriterion.libelle).toMatchObject({ verdict: "correct", points: 1 });
  });

  it("ne touche à rien quand l'humain confirme le comparateur", () => {
    const scores = [note("m/a", "correct")];
    expect(appliquerArbitrages(scores, [decision("m/a", "correct", "correct")])[0]).toBe(scores[0]);
  });

  it("ne compte comme requalification qu'un verdict réellement changé", () => {
    expect(requalifications([decision("m/a", "hallucine", "faux"), decision("m/b", "correct", "correct")]))
      .toEqual([{ model: "m/a", docId: "d-1", criterionId: "libelle", de: "hallucine", vers: "faux", motif: "motif" }]);
  });
});

describe("les arbitrages du dépôt", () => {
  const racine = join("data", "runs");

  // Le site applique les arbitrages avec sa propre fonction, le pipeline avec la
  // sienne : si elles divergeaient, un tableau contredirait le classement au-dessus.
  it("donnent au site les verdicts sur lesquels le classement publié est calculé", () => {
    for (const taskId of publishedTaskIds()) {
      const lb = loadLeaderboard(taskId);
      const task = loadTask(taskId);
      const duPipeline = lb.runId.split("+").flatMap((run) => {
        const lire = <T,>(schema: z.ZodType<T>, fichier: string): T[] =>
          (existsSync(fichier) ? z.array(schema).parse(JSON.parse(readFileSync(fichier, "utf8"))) : []);
        return applyReview(task, lire(DocScoreSchema, join(racine, run, "scores.json")), lire(ReviewItemSchema, join(racine, run, "review.json")));
      });
      const verdicts = (scores: DocScore[]) => scores.map((s) =>
        [s.model, s.docId, Object.entries(s.byCriterion).map(([id, f]) => [id, f.verdict, f.points])]);
      expect(verdicts(loadScores(lb.runId)), taskId).toEqual(verdicts(duPipeline));
    }
  });

  it("ne laissent aucune hallucination non arbitrée dans un classement publié", () => {
    for (const taskId of publishedTaskIds()) {
      const lb = loadLeaderboard(taskId);
      const restantes = loadScores(lb.runId).flatMap((s) =>
        Object.entries(s.byCriterion).filter(([, f]) => f.verdict === "hallucine").map(([id]) => `${s.model} ${s.docId} ${id}`));
      // Le comparateur ne sait pas si une valeur figure ailleurs sur la page : tant
      // qu'un humain n'a pas ouvert le document, « halluciné » n'est qu'une présomption.
      const arbitrees = new Set(loadRequalifications(lb.runId).map((r) => `${r.model} ${r.docId} ${r.criterionId}`));
      expect(restantes.filter((r) => !arbitrees.has(r)), taskId).toEqual([]);
      expect(lb.rows.filter((r) => r.hallucinations > 0).map((r) => r.model), taskId).toEqual([]);
    }
  });

  it("requalifient six réponses, chacune avec son motif", () => {
    const toutes = publishedTaskIds().flatMap((t) => loadRequalifications(loadLeaderboard(t).runId));
    expect(toutes.map((r) => `${r.model} ${r.docId.slice(0, 8)} ${r.de}→${r.vers}`).sort()).toEqual([
      "amazon/nova-lite-v1 fb-00476 hallucine→faux",
      "amazon/nova-pro-v1 fb-00476 hallucine→faux",
      "amazon/nova-pro-v1 fb-00746 hallucine→faux",
      "meta-llama/llama-4-maverick f56e2fc1 hallucine→faux",
      "mistralai/mistral-medium-3-5 88d79dde hallucine→faux",
      "moonshotai/kimi-k3 88d79dde hallucine→faux",
    ]);
    expect(toutes.every((r) => r.motif.length > 60)).toBe(true);
  });
});
