import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DocScoreSchema, ReviewItemSchema, type DocScore, type ReviewItem } from "@hub/schema";
import { z } from "zod";
import { runTask } from "./run.js";
import { scoreDocument } from "./score.js";
import { applyReview, buildLeaderboard } from "./publish.js";
import { fetchCatalogue, assertUsable, V1_MODELS } from "./models.js";
import { createGatewayGenerate } from "./gateway.js";
import {
  loadTask, loadPrompt, loadDocuments, loadGroundTruths, loadRunResults,
  runsRoot, publishedDir,
} from "./load.js";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const today = (): string => new Date().toISOString().slice(0, 10);

async function cmdRun(taskId: string): Promise<void> {
  const models = arg("models")?.split(",") ?? [...V1_MODELS];
  const runId = arg("run") ?? `${today()}_${taskId}`;

  if (process.env.AI_GATEWAY_API_KEY === undefined) {
    throw new Error(
      "AI_GATEWAY_API_KEY absente. Créer une clé sur vercel.com (AI Gateway), puis :\n" +
      "  export AI_GATEWAY_API_KEY=...",
    );
  }

  const catalogue = await fetchCatalogue();
  assertUsable(catalogue, models);

  const [task, promptText, documents] = await Promise.all([
    loadTask(taskId), loadPrompt(taskId), loadDocuments(taskId),
  ]);

  const limit = arg("limit");
  const subset = limit === undefined ? documents : documents.slice(0, Number(limit));

  console.log(`Run ${runId} : ${subset.length} documents × ${models.length} modèles ` +
    `= ${subset.length * models.length} appels.`);

  const summary = await runTask({
    task, promptText, documents: subset, models, runId,
    outRoot: runsRoot, generate: createGatewayGenerate(catalogue),
    resume: flag("resume"),
  });

  console.log(`Terminé : ${summary.calls} appels, ${summary.errors} en échec, ` +
    `${summary.reused} réutilisés. → ${summary.runDir}`);
}

async function cmdScore(taskId: string): Promise<void> {
  const runId = arg("run") ?? `${today()}_${taskId}`;
  const runDir = join(runsRoot(), runId);

  const [task, groundTruths, results] = await Promise.all([
    loadTask(taskId), loadGroundTruths(taskId), loadRunResults(runDir),
  ]);

  const scores: DocScore[] = [];
  for (const result of results) {
    if (result.error !== undefined) continue;
    const gt = groundTruths.get(result.docId);
    if (gt === undefined) throw new Error(`Vérité terrain manquante pour ${result.docId}`);
    const parsed = (result.raw ?? {}) as Record<string, unknown>;
    scores.push(DocScoreSchema.parse(scoreDocument(task, gt, parsed, result.model)));
  }

  await writeFile(join(runDir, "scores.json"), `${JSON.stringify(scores, null, 2)}\n`);
  const sansRelecture = scores.filter((s) => !s.needsReview).length;
  console.log(`${scores.length} documents notés, ${sansRelecture} sans relecture nécessaire.`);
  console.log(`→ ${join(runDir, "scores.json")}`);
}

async function readReview(runDir: string): Promise<ReviewItem[]> {
  try {
    return z.array(ReviewItemSchema).parse(
      JSON.parse(await readFile(join(runDir, "review.json"), "utf8")));
  } catch {
    return [];
  }
}

async function cmdPublish(taskId: string): Promise<void> {
  const runId = arg("run") ?? `${today()}_${taskId}`;
  const runDir = join(runsRoot(), runId);

  const [task, results] = await Promise.all([loadTask(taskId), loadRunResults(runDir)]);
  const scores = z.array(DocScoreSchema).parse(
    JSON.parse(await readFile(join(runDir, "scores.json"), "utf8")));
  const review = await readReview(runDir);

  const arbitres = applyReview(task, scores, review);
  const leaderboard = buildLeaderboard({
    taskId,
    status: flag("demo") ? "demo" : "reel",
    runDate: runId.slice(0, 10),
    scores: arbitres,
    results,
    sampleSize: new Set(scores.map((s) => s.docId)).size,
  });

  await mkdir(publishedDir(), { recursive: true });
  const out = join(publishedDir(), `${taskId}.json`);
  await writeFile(out, `${JSON.stringify(leaderboard, null, 2)}\n`);

  console.log(`Classement publié (${review.length} arbitrage(s) humain(s) appliqué(s)) :`);
  for (const [i, row] of leaderboard.rows.entries()) {
    console.log(`  ${i + 1}. ${row.model.padEnd(28)} ` +
      `${String(row.sansRelecture).padStart(5)} % sans relecture · ` +
      `${String(row.exactitude).padStart(5)} % exactitude · ` +
      `${String(row.hallucinations).padStart(5)} % hallucinations`);
  }
  console.log(`→ ${out}`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const taskId = arg("task") ?? "facture-fr";

  switch (command) {
    case "run": return cmdRun(taskId);
    case "score": return cmdScore(taskId);
    case "publish": return cmdPublish(taskId);
    default:
      console.error("Usage : eval <run|score|review|publish> [--task facture-fr] [--run <id>]");
      process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
