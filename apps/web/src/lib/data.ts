import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";

import {
  LeaderboardSchema, TaskSchema, GroundTruthSchema, LabSchema, ModelCatalogueSchema,
  DomainSchema, BenchmarkSchema, BenchmarkHistorySchema, NewsSchema, DocScoreSchema, parseCsv,
} from "@hub/schema";
import type {
  Benchmark, BenchmarkHistory, DocScore, Domain, GroundTruth, Lab, Leaderboard, ModelCatalogue,
  News, Task,
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

export function loadPrompt(taskId: string): string {
  return readFileSync(join(repoRoot(), "data", "tasks", taskId, "prompt.md"), "utf8");
}

export function loadGroundTruth(taskId: string, docId: string): GroundTruth {
  const file = join(repoRoot(), "data", "tasks", taskId, "ground-truth", `${docId}.json`);
  return GroundTruthSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Les notations d'un run. Le site les lit pour choisir quels documents montrer
 * et pour afficher le verdict champ par champ ; il ne les recalcule jamais.
 *
 * Un classement publié peut porter plusieurs runs, séparés par « + » : les runs
 * restent immuables et séparés sur le disque, c'est la lecture qui les réunit.
 */
export function loadScores(runId: string): DocScore[] {
  return runId.split("+").flatMap((run) => {
    const file = join(repoRoot(), "data", "runs", run, "scores.json");
    if (!existsSync(file)) return [];
    return z.array(DocScoreSchema).parse(JSON.parse(readFileSync(file, "utf8")));
  });
}

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

export type ReponseModele = {
  model: string;
  /** La valeur brute produite par le modèle pour ce champ, telle qu'écrite. */
  valeur: unknown;
  enEchec: boolean;
};

/**
 * Ce que chaque modèle a répondu sur un champ d'un document donné.
 *
 * Lit les réponses brutes du run, jamais les scores : afficher la réponse
 * telle qu'elle a été produite est ce qui permet au lecteur de juger par
 * lui-même plutôt que de nous croire sur parole.
 */
export function loadReponses(runId: string, docId: string, criterionId: string): ReponseModele[] {
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
      valeur: (result.raw as Record<string, unknown> | null)?.[criterionId] ?? null,
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
