import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";

import {
  LeaderboardSchema, TaskSchema, GroundTruthSchema, LabSchema, ModelCatalogueSchema,
  DomainSchema, BenchmarkSchema, BenchmarkHistorySchema, NewsSchema, DocScoreSchema, ReviewItemSchema, parseCsv,
} from "@hub/schema";
import { appliquerArbitrages, requalifications, type Requalification } from "./arbitrage";
import { lireQuestions, type QuestionPosee } from "./questions";
import type {
  Benchmark, BenchmarkHistory, DocScore, Domain, GroundTruth, Lab, Leaderboard, ModelCatalogue,
  News, ReviewItem, Task,
} from "@hub/schema";

/** Remonte jusqu'au dépôt : le cwd diffère entre `next dev`, le build et les tests. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "data", "published"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Dossier data/published introuvable depuis ${process.cwd()}. ` +
    "Lancer les commandes depuis le dépôt, et publier un classement avant de construire le site.",
  );
}

export function loadLeaderboard(taskId: string): Leaderboard {
  const file = join(repoRoot(), "data", "published", `${taskId}.json`);
  try {
    return LeaderboardSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (e) {
    // Faire échouer le build : mieux vaut pas de site qu'un classement à moitié affiché.
    throw new Error(`Classement publié invalide (${file})\n${String(e)}`);
  }
}

/** Lit et valide un fichier du catalogue ; un catalogue invalide arrête le build. */
function loadJson<T>(schema: z.ZodType<T>, ...segments: string[]): T {
  const file = join(repoRoot(), "data", ...segments);
  try {
    return schema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (e) {
    throw new Error(`Fichier de données invalide (${file})\n${String(e)}`);
  }
}

export const loadLabs = (): Lab[] => loadJson(z.array(LabSchema), "catalogue", "labs.json");
export const loadModelCatalogue = (): ModelCatalogue => loadJson(ModelCatalogueSchema, "catalogue", "models.json");
export const loadDomains = (): Domain[] => loadJson(z.array(DomainSchema), "catalogue", "domains.json");
export const loadBenchmarks = (): Benchmark[] => loadJson(z.array(BenchmarkSchema), "catalogue", "benchmarks.json");
export const loadNews = (): News[] => loadJson(z.array(NewsSchema), "news.json");

/** L'historique n'existe qu'à partir de la deuxième publication d'un benchmark. */
export function loadHistory(benchmarkId: string): BenchmarkHistory | null {
  const file = join(repoRoot(), "data", "published", "history", `${benchmarkId}.json`);
  if (!existsSync(file)) return null;
  return loadJson(BenchmarkHistorySchema, "published", "history", `${benchmarkId}.json`);
}

/** Une tâche n'a de définition exécutable que si le pipeline sait la jouer. */
export const hasTask = (taskId: string): boolean =>
  existsSync(join(repoRoot(), "data", "tasks", taskId, "task.json"));

/**
 * Les cas pièges sont une construction : des documents fabriqués pour mettre une
 * difficulté précise sous les yeux. Un jeu de documents réels n'en a pas, et la
 * section correspondante n'existe alors pas sur le site.
 */
export const hasCases = (taskId: string): boolean =>
  existsSync(join(repoRoot(), "data", "tasks", taskId, "cases.json"));

export function publishedTaskIds(): string[] {
  const dir = join(repoRoot(), "data", "published");
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

export function loadTask(taskId: string): Task {
  const file = join(repoRoot(), "data", "tasks", taskId, "task.json");
  return TaskSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Le prompt d'un run, et à défaut celui de la tâche.
 *
 * Le fichier de la tâche évolue d'un run à l'autre ; chaque run en garde la
 * copie qu'il a réellement envoyée. Afficher celle de la tâche à côté de
 * chiffres produits par une autre version serait faux, même sans le vouloir.
 */
export function loadPrompt(taskId: string, runId?: string): string {
  for (const run of runId === undefined ? [] : runId.split("+")) {
    const fichier = join(repoRoot(), "data", "runs", run, "prompt.md");
    if (existsSync(fichier)) return readFileSync(fichier, "utf8");
  }
  return readFileSync(join(repoRoot(), "data", "tasks", taskId, "prompt.md"), "utf8");
}

export function loadGroundTruth(taskId: string, docId: string): GroundTruth {
  const file = join(repoRoot(), "data", "tasks", taskId, "ground-truth", `${docId}.json`);
  return GroundTruthSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/** Le journal d'arbitrage humain d'un run : vide tant que personne n'a tranché. */
function loadReview(run: string): ReviewItem[] {
  const file = join(repoRoot(), "data", "runs", run, "review.json");
  if (!existsSync(file)) return [];
  return z.array(ReviewItemSchema).parse(JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Les notations d'un run, arbitrages humains appliqués. Le site les lit pour
 * choisir quels documents montrer et pour afficher le verdict champ par champ ;
 * il ne note rien lui-même.
 *
 * Ce sont les verdicts sur lesquels le classement publié est calculé : la note du
 * comparateur, sauf là où un humain a tranché autrement.
 *
 * Un classement publié peut porter plusieurs runs, séparés par « + » : les runs
 * restent immuables et séparés sur le disque, c'est la lecture qui les réunit.
 */
export function loadScores(runId: string): DocScore[] {
  return runId.split("+").flatMap((run) => {
    const file = join(repoRoot(), "data", "runs", run, "scores.json");
    if (!existsSync(file)) return [];
    return appliquerArbitrages(z.array(DocScoreSchema).parse(JSON.parse(readFileSync(file, "utf8"))), loadReview(run));
  });
}

/** Les réponses dont un humain a changé le verdict, dans les runs d'un classement. */
export const loadRequalifications = (runId: string): Requalification[] =>
  runId.split("+").flatMap((run) => requalifications(loadReview(run)));

export type SourceDocument = {
  docId: string;
  /** L'adresse du document d'origine, sur l'archive publique de la source. */
  url: string;
};

/**
 * L'adresse d'origine de chaque document du jeu de test.
 *
 * C'est ce qui rend une mesure vérifiable par un lecteur : il doit pouvoir
 * ouvrir la facture elle-même, chez celui qui la publie, et non une copie que
 * nous aurions faite. Le manifeste est le fichier que la préparation a
 * téléchargé ; il reste dans le dépôt, inchangé.
 */
export function loadDocumentSources(taskId: string): Map<string, string> {
  const fichier = join(repoRoot(), "data", "tasks", taskId, "manifest.csv");
  if (!existsSync(fichier)) return new Map();
  const lignes = parseCsv(readFileSync(fichier, "utf8"));
  return new Map(
    lignes.flatMap((l) => {
      const id = l.file_id;
      const url = l.url;
      return id === undefined || url === undefined || url === "" ? [] : [[id, url] as const];
    }),
  );
}

/**
 * Les questions d'une tâche qui en pose une par document, lues dans son manifeste.
 * Liste vide pour une tâche dont tous les documents reçoivent le même prompt.
 */
export function loadQuestionsPosees(taskId: string): QuestionPosee[] {
  const fichier = join(repoRoot(), "data", "tasks", taskId, "manifest.csv");
  if (!existsSync(fichier)) return [];
  return lireQuestions(parseCsv(readFileSync(fichier, "utf8")));
}

/**
 * Les questions écartées après un run, avec leur motif.
 *
 * Leurs réponses restent enregistrées, mais elles n'entrent plus dans le
 * classement. Les cacher du site reviendrait à retoucher le jeu de test sans le
 * dire : elles y sont listées, avec la raison.
 */
export function loadExclusions(taskId: string): Map<string, string> {
  const fichier = join(repoRoot(), "data", "tasks", taskId, "exclusions.json");
  if (!existsSync(fichier)) return new Map();
  const liste = z.array(z.object({ docId: z.string(), motif: z.string().min(1), date: z.string() }))
    .parse(JSON.parse(readFileSync(fichier, "utf8")));
  return new Map(liste.map((e) => [e.docId, e.motif]));
}

/**
 * Les échecs imputés au modèle : il n'a rien rendu d'exploitable, et on lui compte
 * « manquant » plutôt que de retirer la question à tout le panel.
 */
export function loadEchecsImputes(taskId: string): { model: string; docId: string; motif: string }[] {
  const fichier = join(repoRoot(), "data", "tasks", taskId, "echecs-imputes.json");
  if (!existsSync(fichier)) return [];
  return z.array(z.object({ model: z.string(), docId: z.string(), motif: z.string().min(1), date: z.string() }))
    .parse(JSON.parse(readFileSync(fichier, "utf8"))).map(({ model, docId, motif }) => ({ model, docId, motif }));
}

export type ReponseModele = {
  model: string;
  /** La valeur brute produite par le modèle pour ce champ, telle qu'écrite. */
  valeur: unknown;
  enEchec: boolean;
};

/**
 * La clé JSON sous laquelle un modèle écrit sa réponse à un critère : l'identifiant
 * du critère, sauf quand le barème en déclare une autre. Les questions financières
 * se répondent toutes sous « answer », quel que soit le critère qu'elles posent.
 */
export const cleReponse = (task: Task, criterionId: string): string =>
  task.criteria.find((c) => c.id === criterionId)?.key ?? criterionId;

/**
 * Ce que chaque modèle a répondu sur un document donné, sous la clé `cle`.
 *
 * Lit les réponses brutes du run, jamais les scores : afficher la réponse
 * telle qu'elle a été produite est ce qui permet au lecteur de juger par
 * lui-même plutôt que de nous croire sur parole.
 *
 * `cle` vient de `cleReponse`, pas de l'identifiant du critère. Lue sous
 * « calcul », une réponse écrite sous « answer » vaut « rien » : la page a
 * affiché vingt-sept abstentions qui n'avaient pas eu lieu.
 */
export function loadReponses(runId: string, docId: string, cle: string): ReponseModele[] {
  // Le document n'appartient qu'à un seul run — la publication refuse le
  // contraire — donc le premier run qui le contient est le bon.
  const rawDir = runId.split("+")
    .map((run) => join(repoRoot(), "data", "runs", run, "raw"))
    .find((dir) => existsSync(dir) && readdirSync(dir).some(
      (dossier) => existsSync(join(dir, dossier, `${docId}.json`))));
  if (rawDir === undefined) return [];

  return readdirSync(rawDir).map((dossier) => {
    const file = join(rawDir, dossier, `${docId}.json`);
    if (!existsSync(file)) return { model: dossier, valeur: null, enEchec: true };
    const result = JSON.parse(readFileSync(file, "utf8")) as {
      model: string; raw: unknown; error?: string;
    };
    return {
      model: result.model,
      valeur: (result.raw as Record<string, unknown> | null)?.[cle] ?? null,
      enEchec: result.error !== undefined,
    };
  });
}

export const documentImages = (taskId: string, docId: string): string[] => {
  const dir = join(repoRoot(), "data", "tasks", taskId, "documents");
  const pages = readdirSync(dir)
    .filter((f) => f === `${docId}.png` || f.startsWith(`${docId}-p`))
    .sort();
  return pages.map((f) => `/documents/${taskId}/${f}`);
};

export type CasPiege = {
  docId: string;
  template: string;
  traps: { id: string; label: string }[];
};

export function loadCases(taskId: string): CasPiege[] {
  const file = join(repoRoot(), "data", "tasks", taskId, "cases.json");
  return JSON.parse(readFileSync(file, "utf8")) as CasPiege[];
}
