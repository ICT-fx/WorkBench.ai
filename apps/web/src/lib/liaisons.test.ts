import { describe, it, expect } from "vitest";
import {
  cleReponse, hasTask, loadBenchmarks, loadDomains, loadGroundTruth, loadHistory, loadLabs, loadLeaderboard,
  loadModelCatalogue, loadQuestionsPosees, loadEchecsImputes, loadExclusions, loadReponses, loadScores, loadTask,
  publishedTaskIds,
} from "./data";
import { buildHub } from "./hub";
import { runsByBenchmark } from "./models";
import { lignesQuestions } from "./questions";
import { scatterPoints } from "./views";
import type { Site } from "./site";

/**
 * Les liaisons entre les fichiers de `data/` et ce que les pages reçoivent.
 *
 * Le site n'a pas de base de données : il lit `data/` au build, et chaque tableau,
 * chaque graphique part des objets vérifiés ici. `packages/eval/src/chaine.test.ts`
 * prouve que le classement publié sort bien des réponses des modèles ; ce fichier
 * prouve que rien ne se perd ni ne se déforme entre ce classement et l'écran.
 */

const catalogue = loadModelCatalogue();
const benchmarks = loadBenchmarks();
const domains = loadDomains();
const publies = publishedTaskIds().map(loadLeaderboard);
const hub = buildHub({ labs: loadLabs(), models: catalogue.models, domains, benchmarks, leaderboards: publies });
const site: Site = {
  hub, labs: loadLabs(), models: catalogue.models, domains, benchmarks,
  leaderboards: new Map(publies.map((lb) => [lb.taskId, lb])), pricesSyncedAt: catalogue.syncedAt,
  versionsSyncedAt: catalogue.versionsSyncedAt ?? null,
};

describe("le catalogue et les classements publiés", () => {
  it("donne une fiche à chaque classement, et un classement aux seules tâches jouables", () => {
    for (const lb of publies) {
      expect(benchmarks.some((b) => b.id === lb.taskId), lb.taskId).toBe(true);
      expect(hasTask(lb.taskId), lb.taskId).toBe(true);
    }
    // Une tâche au programme n'a pas de chiffres : ni classement, ni historique.
    for (const b of benchmarks.filter((x) => !publies.some((lb) => lb.taskId === x.id))) {
      expect(loadHistory(b.id), b.id).toBeNull();
    }
  });

  it("affiche sur la fiche la taille d'échantillon du classement", () => {
    for (const lb of publies) {
      expect(benchmarks.find((b) => b.id === lb.taskId)!.sampleSize, lb.taskId).toBe(lb.sampleSize);
    }
  });

  it("classe tous les modèles du catalogue, et eux seuls, sur chaque benchmark", () => {
    const attendus = catalogue.models.map((m) => m.id).sort();
    for (const lb of publies) expect(lb.rows.map((r) => r.model).sort(), lb.taskId).toEqual(attendus);
  });

  it("déclare les mêmes sous-tâches dans la fiche, dans le barème et dans chaque ligne du classement", () => {
    for (const lb of publies) {
      const fiche = benchmarks.find((b) => b.id === lb.taskId)!.subtasks.map((s) => s.id).sort();
      expect(loadTask(lb.taskId).criteria.map((c) => c.id).sort(), lb.taskId).toEqual(fiche);
      for (const row of lb.rows) expect(Object.keys(row.bySubtask ?? {}).sort(), `${lb.taskId} ${row.model}`).toEqual(fiche);
    }
  });
});

describe("ce que les pages reçoivent", () => {
  it("porte dans le hub la ligne publiée de chaque modèle, sans la retoucher", () => {
    for (const lb of publies) {
      for (const row of lb.rows) {
        expect(hub.scores.find((s) => s.model.id === row.model)!.byBenchmark[lb.taskId], `${lb.taskId} ${row.model}`).toBe(row);
      }
    }
  });

  it("calcule l'indice comme la moyenne des scores par métier mesuré", () => {
    expect(hub.coverage).toMatchObject({
      domainsMeasured: 2, domainsTotal: domains.length, benchmarksMeasured: publies.length, benchmarksTotal: benchmarks.length,
    });
    for (const s of hub.scores) {
      const parMetier = hub.coverage.domains.map((d) => s.byDomain[d]!);
      expect(s.indice, s.model.id).toBe(Math.round((parMetier.reduce((a, b) => a + b, 0) / parMetier.length) * 10) / 10);
    }
    // Tous classés, du meilleur indice au moins bon, sans rang sauté.
    expect(hub.scores.map((s) => s.rank)).toEqual(hub.scores.map((_, i) => i + 1));
    expect(hub.scores.every((s, i) => i === 0 || s.indice! <= hub.scores[i - 1]!.indice!)).toBe(true);
  });

  it("place un point par modèle dans le nuage, à l'exactitude et au coût publiés", () => {
    for (const lb of publies) {
      const points = scatterPoints(site, lb, "fr");
      expect(points).toHaveLength(lb.rows.length);
      for (const row of lb.rows) {
        expect(points.find((p) => p.id === row.model), `${lb.taskId} ${row.model}`)
          .toMatchObject({ accuracy: row.exactitude, cost: row.costPerDoc, ci: row.ci });
      }
    }
  });

  it("termine la courbe de stabilité de chaque modèle par son score publié", () => {
    const histories = publies.map((lb) => loadHistory(lb.taskId)!);
    for (const m of catalogue.models) {
      for (const serie of runsByBenchmark(histories, m.id)) {
        const publie = site.leaderboards.get(serie.benchmarkId)!.rows.find((r) => r.model === m.id)!;
        expect(serie.points.at(-1)!.value, `${serie.benchmarkId} ${m.id}`).toBe(publie.exactitude);
      }
    }
  });
});

describe("les réponses montrées sous un classement", () => {
  // Les questions financières se répondent toutes sous la clé « answer ». Lues sous
  // l'identifiant du critère, elles valaient « rien » : la page affichait vingt-sept
  // abstentions, y compris pour les modèles notés justes.
  it("ne montre jamais comme une abstention une réponse notée juste, sauf quand s'abstenir était la réponse", () => {
    for (const lb of publies) {
      const task = loadTask(lb.taskId);
      const scores = loadScores(lb.runId);
      for (const docId of new Set(scores.map((s) => s.docId))) {
        const fields = loadGroundTruth(lb.taskId, docId).fields;
        for (const [critere, attendu] of Object.entries(fields)) {
          if (attendu === null || !task.criteria.some((c) => c.id === critere)) continue;
          const reponses = new Map(loadReponses(lb.runId, docId, cleReponse(task, critere)).map((r) => [r.model, r]));
          for (const s of scores.filter((x) => x.docId === docId && x.byCriterion[critere]?.verdict === "correct")) {
            expect(reponses.get(s.model)?.valeur ?? null, `${lb.taskId} ${docId} ${s.model}`).not.toBeNull();
          }
        }
      }
    }
  });

  it("compte dans le tableau des questions autant de bonnes réponses que le classement en publie", () => {
    const lb = site.leaderboards.get("analyse-financiere")!;
    const lignes = lignesQuestions(
      loadQuestionsPosees(lb.taskId), loadScores(lb.runId), lb.rows.length, loadExclusions(lb.taskId), loadEchecsImputes(lb.taskId),
    );
    const classees = lignes.filter((l) => l.statut === "classee");
    expect(classees).toHaveLength(lb.sampleSize);
    // Une question vaut un point : le total des « justes » du tableau est celui des exactitudes.
    const duClassement = lb.rows.reduce((a, r) => a + Math.round((r.exactitude * lb.sampleSize) / 100), 0);
    expect(classees.reduce((a, l) => a + l.corrects, 0)).toBe(duClassement);
    expect(classees.every((l) => l.models === lb.rows.length)).toBe(true);
  });
});
