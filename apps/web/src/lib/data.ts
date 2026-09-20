import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import {
  LeaderboardSchema, TaskSchema, GroundTruthSchema, LabSchema, ModelCatalogueSchema,
  DomainSchema, BenchmarkSchema, BenchmarkHistorySchema, NewsSchema,
} from "@hub/schema";
import type {
  Benchmark, BenchmarkHistory, Domain, GroundTruth, Lab, Leaderboard, ModelCatalogue, News, Task,
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
  const rawDir = join(repoRoot(), "data", "runs", runId, "raw");
  if (!existsSync(rawDir)) return [];

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
