import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  BenchmarkHistorySchema, DocScoreSchema, LeaderboardSchema, ReviewItemSchema, RunMetaSchema,
  type DocScore, type Leaderboard,
} from "@hub/schema";
import {
  loadEchecsImputes, loadExclusions, loadGroundTruths, loadProtocole, loadPrompt, loadRunResults, loadTask,
  loadTaskDocuments, publishedDir, runsRoot,
} from "./load";
import { empreinteBareme, empreinteDocument, empreintePrompt } from "./protocole";
import { applyReview, buildLeaderboard } from "./publish";
import { scoreResults } from "./score";

/**
 * La chaîne qui mène d'une réponse de modèle à un chiffre du site, rejouée sur les
 * fichiers du dépôt : réponses brutes → notes → classement publié → historique.
 *
 * Le site ne lit que `data/published/`. Ce fichier s'écrit par une commande, et rien
 * n'empêche de le modifier à la main ou d'oublier de republier après une correction
 * du barème. Ces tests échouent dès qu'un maillon ne redonne plus le suivant.
 */

const lireJson = <T>(schema: z.ZodType<T>, fichier: string): T =>
  schema.parse(JSON.parse(readFileSync(fichier, "utf8")));

const publies: Leaderboard[] = readdirSync(publishedDir())
  .filter((f) => f.endsWith(".json"))
  .map((f) => lireJson(LeaderboardSchema, join(publishedDir(), f)));

const notesDuRun = (run: string): DocScore[] =>
  lireJson(z.array(DocScoreSchema), join(runsRoot(), run, "scores.json"));

describe("un classement publié", () => {
  it("existe pour les deux tâches mesurées, et pour elles seules", () => {
    expect(publies.map((p) => p.taskId).sort()).toEqual(["analyse-financiere", "facture-fcc"]);
  });

  describe.each(publies.map((p) => [p.taskId, p] as const))("%s", (taskId, publie) => {
    const runs = publie.runId.split("+");

    it("nomme des runs qui sont dans le dépôt, avec leurs notes et leurs réponses", () => {
      for (const run of runs) {
        expect(existsSync(join(runsRoot(), run, "scores.json")), run).toBe(true);
        expect(existsSync(join(runsRoot(), run, "raw")), run).toBe(true);
      }
    });

    it("est exactement celui que ses runs redonnent", async () => {
      const task = await loadTask(taskId);
      const scores = runs.flatMap(notesDuRun);
      const results = (await Promise.all(runs.map((r) => loadRunResults(join(runsRoot(), r))))).flat();
      const review = runs.flatMap((r) => {
        const fichier = join(runsRoot(), r, "review.json");
        return existsSync(fichier) ? lireJson(z.array(ReviewItemSchema), fichier) : [];
      });
      const notes = new Set(scores.map((s) => s.docId));

      const { incomplets: _, ...refait } = buildLeaderboard({
        taskId, runId: publie.runId, status: publie.status, runDate: publie.runDate,
        scores: applyReview(task, scores, review),
        results: results.filter((r) => notes.has(r.docId)),
        sampleSize: notes.size,
      });
      expect(refait).toEqual(publie);
    });

    it("garde les notes que la notation redonne aujourd'hui, réponse par réponse", async () => {
      const [task, groundTruths, imputes, exclusions] = await Promise.all([
        loadTask(taskId), loadGroundTruths(taskId), loadEchecsImputes(taskId), loadExclusions(taskId),
      ]);
      // Tout document doté d'une vérité terrain et non écarté. La notation part des
      // pages présentes sur le disque ; ici non, parce que les pages des factures ne
      // sont pas versionnées et qu'un dépôt cloné ne les a pas.
      const retenus = new Set([...groundTruths.keys()].filter((docId) => !exclusions.has(docId)));
      const cle = (s: { model: string; docId: string }): string => `${s.model}/${s.docId}`;

      for (const run of runs) {
        const results = await loadRunResults(join(runsRoot(), run));
        const refaites = new Map(scoreResults({ task, groundTruths, results, retenus, imputes }).scores
          .map((s) => [cle(s), DocScoreSchema.parse(s)]));
        // Un run ancien a pu être noté sous un plafond de pages : la notation d'aujourd'hui
        // peut donc couvrir plus de documents que le fichier, jamais en noter un autrement.
        for (const note of notesDuRun(run)) expect(refaites.get(cle(note)), `${run} ${cle(note)}`).toEqual(note);
      }
    });

    it("note chaque modèle sur les mêmes documents, une fois chacun", () => {
      const scores = runs.flatMap(notesDuRun);
      const parModele = new Map<string, string[]>();
      for (const s of scores) parModele.set(s.model, [...(parModele.get(s.model) ?? []), s.docId]);

      expect(parModele.size).toBe(publie.rows.length);
      const reference = [...new Set(scores.map((s) => s.docId))].sort();
      expect(reference).toHaveLength(publie.sampleSize);
      for (const [modele, docs] of parModele) expect([...docs].sort(), modele).toEqual(reference);
      for (const row of publie.rows) expect(row.docCount, row.model).toBe(publie.sampleSize);
    });

    describe("son test figé", () => {
      it("porte sur les documents du classement, le prompt des runs et le barème de la tâche", async () => {
        const protocole = (await loadProtocole(taskId))!;
        expect(protocole).not.toBeNull();
        expect(protocole.runId).toBe(publie.runId);
        expect(protocole.documents.map((d) => d.docId)).toEqual([...new Set(runs.flatMap(notesDuRun).map((s) => s.docId))].sort());
        expect(protocole.documents).toHaveLength(publie.sampleSize);
        for (const run of runs) {
          expect(lireJson(RunMetaSchema, join(runsRoot(), run, "run.json")).promptHash, run).toBe(protocole.promptHash);
        }
        expect(empreintePrompt(await loadPrompt(taskId))).toBe(protocole.promptHash);
        expect(empreinteBareme((await loadTask(taskId)).criteria)).toBe(protocole.criteriaHash);
      });

      it("nomme chaque modèle du classement, avec sa version et les dates de ses appels", async () => {
        const protocole = (await loadProtocole(taskId))!;
        expect(protocole.models.map((m) => [m.alias, m.version])).toEqual(publie.rows.map((r) => [r.model, r.modelVersion]));
        for (const m of protocole.models) {
          expect(m.canonical, m.alias).not.toBeNull();
          expect(m.firstCall <= m.lastCall, m.alias).toBe(true);
          // Le premier appel d'un modèle ne précède pas le premier run du test.
          expect(m.firstCall.slice(0, 7) >= runs[0]!.slice(0, 7), m.alias).toBe(true);
        }
      });

      it("donne à chaque document l'empreinte de ce que le pipeline enverrait aujourd'hui", async () => {
        const protocole = (await loadProtocole(taskId))!;
        const [documents, prompt] = await Promise.all([loadTaskDocuments(taskId), loadPrompt(taskId)]);
        const parId = new Map(documents.map((d) => [d.docId, d]));
        let verifies = 0;
        for (const attendu of protocole.documents) {
          const doc = parId.get(attendu.docId);
          // Les pages des factures ne sont pas toutes versionnées : un dépôt cloné ne
          // peut vérifier que les documents dont il a toutes les pages.
          if (doc === undefined || doc.images.length !== attendu.pages) continue;
          expect(empreinteDocument(doc, prompt), attendu.docId).toBe(attendu.fingerprint);
          verifies++;
        }
        // Les pages des rapports financiers, elles, sont dans le dépôt : toutes se vérifient.
        if (taskId === "analyse-financiere") expect(verifies).toBe(protocole.documents.length);
      });
    });

    it("termine l'historique par cette même publication", () => {
      const historique = lireJson(BenchmarkHistorySchema, join(publishedDir(), "history", `${taskId}.json`));
      const dernier = historique.runs.at(-1)!;
      expect(dernier.runId).toBe(publie.runId);
      // Aucune entrée n'est une étape de la publication courante : élargir un test
      // ou y ajouter un modèle ne fait pas un point de plus dans le temps.
      const courants = new Set(runs);
      expect(historique.runs.slice(0, -1).filter((r) => r.runId.split("+").every((x) => courants.has(x)))).toEqual([]);
      expect(dernier.rows).toEqual(publie.rows.map((r) => ({
        model: r.model, exactitude: r.exactitude, costPerDoc: r.costPerDoc, latencyP50: r.latencyP50,
      })));
    });
  });
});
