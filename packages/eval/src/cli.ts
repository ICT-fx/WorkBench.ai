import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DocScoreSchema, ReviewItemSchema, type DocScore, type ReviewItem } from "@hub/schema";
import { z } from "zod";
import { createInterface } from "node:readline/promises";
import { runTask } from "./run";
import { selectForReview, type ReviewCandidate } from "./review";
import { scoreDocument } from "./score";
import { applyReview, buildLeaderboard } from "./publish";
import { fetchCatalogue, assertUsable, V1_MODELS } from "./models";
import { createGatewayGenerate } from "./gateway";
import {
  loadTask, loadPrompt, loadDocuments, loadGroundTruths, loadRunResults,
  runsRoot, publishedDir,
} from "./load";

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

const MOTIFS: Record<ReviewCandidate["reason"], string> = {
  hallucination: "HALLUCINATION — le document ne contient rien à cet endroit",
  format: "ÉCRITURE DIFFÉRENTE — jugé correct, à confirmer",
  echantillon: "CONTRÔLE — tirage au sort parmi les champs jugés corrects",
};

const show = (v: unknown): string =>
  v === null ? "(rien)" : typeof v === "string" ? v : JSON.stringify(v);

async function cmdReview(taskId: string): Promise<void> {
  const runId = arg("run") ?? `${today()}_${taskId}`;
  const runDir = join(runsRoot(), runId);

  const task = await loadTask(taskId);
  const scores = z.array(DocScoreSchema).parse(
    JSON.parse(await readFile(join(runDir, "scores.json"), "utf8")));
  const decided = await readReview(runDir);

  const candidates = selectForReview(scores, {
    seed: Number(arg("seed") ?? 17),
    alreadyDecided: decided,
  });

  const parMotif = candidates.reduce<Record<string, number>>((acc, c) => {
    acc[c.reason] = (acc[c.reason] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Run ${runId} — ${candidates.length} champ(s) à arbitrer ` +
    `(${decided.length} déjà tranché(s)) :`);
  for (const [motif, n] of Object.entries(parMotif)) console.log(`  · ${motif} : ${n}`);

  if (flag("dry-run") || candidates.length === 0) {
    if (candidates.length === 0) console.log("Rien à arbitrer.");
    return;
  }

  const labels = Object.fromEntries(task.criteria.map((c) => [c.id, c.label]));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const journal = [...decided];

  for (const [i, c] of candidates.entries()) {
    console.log(`\n[${i + 1}/${candidates.length}] ${MOTIFS[c.reason]}`);
    console.log(`  document ${c.docId} · modèle ${c.model} · ${labels[c.criterionId] ?? c.criterionId}`);
    console.log(`  attendu : ${show(c.expected)}`);
    console.log(`  produit : ${show(c.got)}`);
    console.log(`  verdict automatique : ${c.autoVerdict}`);

    const answer = (await rl.question("  [Entrée] confirmer · c correct · f faux · h halluciné · q quitter > "))
      .trim().toLowerCase();
    if (answer === "q") break;

    const humanVerdict = answer === "c" ? "correct"
      : answer === "f" ? "faux"
      : answer === "h" ? "hallucine"
      : c.autoVerdict;

    journal.push({
      model: c.model, docId: c.docId, criterionId: c.criterionId,
      autoVerdict: c.autoVerdict, humanVerdict, decidedAt: new Date().toISOString(),
    });
    // Écrit à chaque décision : une session interrompue n'est jamais perdue.
    await writeFile(join(runDir, "review.json"), `${JSON.stringify(journal, null, 2)}\n`);
  }

  rl.close();
  console.log(`\n${journal.length} arbitrage(s) enregistré(s) dans ${join(runDir, "review.json")}`);
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
    runId,
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
    case "review": return cmdReview(taskId);
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
