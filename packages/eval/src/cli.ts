import { mkdir, writeFile, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BenchmarkHistorySchema, DocScoreSchema, ReviewItemSchema,
  type BenchmarkHistory, type DocScore, type ReviewItem,
} from "@hub/schema";
import { z } from "zod";
import { createInterface } from "node:readline/promises";
import { runTask } from "./run";
import { selectForReview, type ReviewCandidate } from "./review";
import { scoreDocument } from "./score";
import { appendHistory, applyReview, buildLeaderboard } from "./publish";
import { existsSync } from "node:fs";
import { fetchCatalogue, assertUsable, HUB_MODELS } from "./models";
import { createOpenRouterGenerate } from "./openrouter";
import { estimateRunCost } from "./estimate";
import {
  loadTask, loadPrompt, loadDocuments, loadGroundTruths, loadRunResults,
  runsRoot, publishedDir, pixelsTotaux, type LoadedDocument,
} from "./load";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Le périmètre des documents, appliqué à l'identique au run et à la notation.
 *
 * L'ordre compte : --limit désigne les N premiers documents du tirage,
 * --max-pages et --max-pixels écartent ensuite les trop lourds. Dans l'autre
 * sens, des documents hors tirage entreraient dans le jeu — l'erreur qui a
 * fait déborder un run.
 *
 * Les deux plafonds viennent de limites de fournisseurs : l'un refuse plus de
 * huit images par requête, l'autre plafonne le total de pixels. On écarte ces
 * documents pour tout le monde plutôt que d'en priver un seul modèle : un
 * classement doit comparer des modèles, pas des sous-ensembles.
 */
function perimetre(documents: LoadedDocument[]): LoadedDocument[] {
  const limit = arg("limit");
  const maxPages = arg("max-pages");
  const maxPixels = arg("max-pixels");
  let retenus = documents;

  // --deja <run> : les documents qu'un run précédent a déjà mesurés. Les écarter
  // avant tout le reste évite de repayer une réponse qu'on possède, quand on
  // élargit un jeu de test sans vouloir rejouer ce qui est déjà fait.
  const deja = arg("deja");
  if (deja !== undefined) {
    // Plusieurs runs : `--deja a,b`. Élargir un jeu de test sur trois campagnes
    // demande d'écarter tout ce qui a déjà été payé, pas seulement le dernier run.
    const faits = new Set(deja.split(",").flatMap((r) => [...documentsMesures(r.trim())]));
    retenus = retenus.filter((d) => !faits.has(d.docId));
  }

  if (limit !== undefined) retenus = retenus.slice(0, Number(limit));
  if (maxPages !== undefined) retenus = retenus.filter((d) => d.images.length <= Number(maxPages));
  if (maxPixels !== undefined) retenus = retenus.filter((d) => pixelsTotaux(d.images) <= Number(maxPixels));
  return retenus;
}

/**
 * Les documents qu'un run a réellement notés.
 *
 * On lit `scores.json` et non le dossier des réponses brutes : un document dont
 * seuls quelques modèles ont répondu n'est pas mesuré, et doit être rejoué en
 * entier plutôt que complété — un classement compare des modèles sur les mêmes
 * documents, ou ne compare rien.
 */
function documentsMesures(runId: string): Set<string> {
  const fichier = join(runsRoot(), runId, "scores.json");
  if (!existsSync(fichier)) {
    throw new Error(`Run introuvable : ${fichier}. Vérifier --deja.`);
  }
  const scores = z.array(DocScoreSchema).parse(JSON.parse(readFileSync(fichier, "utf8")));
  return new Set(scores.map((s) => s.docId));
}

async function cmdRun(taskId: string): Promise<void> {
  const models = arg("models")?.split(",") ?? [...HUB_MODELS];
  const runId = arg("run") ?? `${today()}_${taskId}`;

  const catalogue = await fetchCatalogue();
  assertUsable(catalogue, models);

  const [task, promptText, documents] = await Promise.all([
    loadTask(taskId), loadPrompt(taskId), loadDocuments(taskId),
  ]);

  const subset = perimetre(documents);

  // L'estimation ne passe aucun appel et n'exige aucune clé : on sait ce qu'on
  // va dépenser avant de le dépenser.
  if (flag("estimate")) {
    const e = estimateRunCost(catalogue, models, subset.map((d) => ({ images: d.images.length })), promptText);
    const usd = (n: number) => `${n.toFixed(2)} $`;
    console.log(`Estimation : ${subset.length} documents × ${models.length} modèles = ${e.calls} appels\n`);
    for (const m of e.perModel) {
      console.log(`  ${m.model.padEnd(28)} ${usd(m.usd).padStart(9)}   (plafond ${usd(m.ceilingUsd)})`);
    }
    console.log(`\n  Total estimé : ${usd(e.totalUsd)} — plafond si les modèles raisonnent longuement : ${usd(e.ceilingUsd)}`);
    console.log(`  Hypothèses : ${e.hypotheses.imageTokens} tokens par page d'image, ` +
      `${e.hypotheses.outputTokens} tokens de réponse, tarifs publics du catalogue du jour.`);
    return;
  }

  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) { try { process.loadEnvFile(f); } catch { /* illisible */ } }
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error(
      "Aucune clé OpenRouter. La créer sur https://openrouter.ai/settings/keys,\n" +
      "puis la placer dans .env.local :  OPENROUTER_API_KEY=sk-or-v1-...\n" +
      "Vérifier ensuite avec : npm run key:check\n" +
      "Pour connaître le coût avant de lancer : npm run eval:run -- --estimate",
    );
  }

  console.log(`Run ${runId} : ${subset.length} documents × ${models.length} modèles ` +
    `= ${subset.length * models.length} appels.`);

  const summary = await runTask({
    task, promptText, documents: subset, models, runId,
    outRoot: runsRoot,
    generate: createOpenRouterGenerate({
      apiKey,
      // Le report sur un autre hébergeur est autorisé : l'interdire a fait
      // échouer tous les appels d'un modèle dont l'hébergeur principal était
      // en panne. L'hébergeur réellement utilisé est enregistré à chaque
      // appel, ce qui suffit à rendre le run vérifiable.
      provider: { allow_fallbacks: true },
      // Certains modèles réfléchissent longuement avant de répondre : à 3 000
      // jetons, quarante-trois réponses sont revenues vides ou tronquées,
      // faute de place pour écrire le JSON après la réflexion.
      maxTokens: 8000,
      surReprise: (model, docId, tentative, ms) => {
        console.log(`  ↻ ${model} ${docId.slice(0, 8)} : reprise ${tentative} dans ${Math.round(ms / 1000)} s`);
      },
    }),
    resume: flag("resume"),
    // Deux appels à la fois : au-delà, OpenRouter réserve plus de crédit que
    // le compte n'en a de disponible et refuse les requêtes.
    concurrency: Number(arg("concurrency") ?? 2),
  });

  console.log(`Terminé : ${summary.calls} appels, ${summary.errors} en échec, ` +
    `${summary.reused} réutilisés. → ${summary.runDir}`);
}

async function cmdScore(taskId: string): Promise<void> {
  const runId = arg("run") ?? `${today()}_${taskId}`;
  const runDir = join(runsRoot(), runId);

  const [task, groundTruths, results, documents] = await Promise.all([
    loadTask(taskId), loadGroundTruths(taskId), loadRunResults(runDir), loadDocuments(taskId),
  ]);
  // La notation refuse --limit : ce filtre est positionnel, et le dossier des
  // documents grossit entre deux runs. Appliqué des mois plus tard, « les 25
  // premiers » ne désignent plus les mêmes factures — l'essai a noté sept
  // documents de septembre sur dix-neuf, sans rien signaler. Le périmètre d'un
  // run est ce que le run contient ; les plafonds, eux, restent utiles car ils
  // décrivent une propriété du document.
  if (arg("limit") !== undefined) {
    throw new Error(
      "--limit ne s'applique pas à la notation : il désigne un rang, pas un document, " +
      "et le tirage s'allonge d'un run à l'autre. Noter avec les seuls plafonds " +
      "(--max-pages, --max-pixels) ; la publication écarte ensuite les documents " +
      "que tout le panel n'a pas lus.");
  }
  const retenus = new Set(perimetre(documents).map((d) => d.docId));

  const scores: DocScore[] = [];
  for (const result of results) {
    if (result.error !== undefined) continue;
    if (!retenus.has(result.docId)) continue;
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

/**
 * Publie un classement à partir d'un ou plusieurs runs.
 *
 * Plusieurs runs : `--run a,b`. Les runs restent immuables et séparés sur le
 * disque ; seule la lecture les réunit, et le `runId` publié les nomme tous les
 * deux. Fusionner n'est légitime que si les modèles ont reçu la même question :
 * quand le prompt a changé entre deux runs, les champs touchés doivent être
 * écartés du barème, sans quoi le classement comparerait des réponses à des
 * questions différentes.
 */
async function cmdPublish(taskId: string): Promise<void> {
  const runIds = (arg("run") ?? `${today()}_${taskId}`).split(",").map((r) => r.trim());
  const runDirs = runIds.map((r) => join(runsRoot(), r));

  const task = await loadTask(taskId);
  const parRun = await Promise.all(runDirs.map(async (runDir) => ({
    results: await loadRunResults(runDir),
    scores: z.array(DocScoreSchema).parse(
      JSON.parse(await readFile(join(runDir, "scores.json"), "utf8"))),
    review: await readReview(runDir),
  })));

  const results = parRun.flatMap((r) => r.results);
  const scores = parRun.flatMap((r) => r.scores);
  const review = parRun.flatMap((r) => r.review);

  // Un document présent dans deux runs serait compté deux fois pour un modèle,
  // et son coût moyen faussé. Mieux vaut refuser que publier un chiffre bancal.
  const doublons = new Set<string>();
  const vus = new Set<string>();
  for (const s of scores) {
    const cle = `${s.model}/${s.docId}`;
    if (vus.has(cle)) doublons.add(s.docId);
    vus.add(cle);
  }
  if (doublons.size > 0) {
    throw new Error(
      `Publication refusée : ${doublons.size} document(s) noté(s) dans plusieurs runs ` +
      `(${[...doublons].slice(0, 3).join(", ")}…). Un document doit n'appartenir qu'à un run.`);
  }

  const arbitres = applyReview(task, scores, review);
  // Le classement ne porte que sur les documents notés. Un run peut contenir
  // des appels sur des documents écartés depuis : les inclure fausserait le
  // coût moyen et le compteur d'échecs.
  const notes = new Set(scores.map((s) => s.docId));
  const retenus = results.filter((r) => notes.has(r.docId));
  const leaderboard = buildLeaderboard({
    taskId,
    runId: runIds.join("+"),
    status: flag("demo") ? "demo" : "reel",
    // La date d'un classement fusionné est celle du run le plus récent : c'est
    // la date à laquelle la mesure publiée est complète.
    runDate: [...runIds].sort().at(-1)!.slice(0, 10),
    scores: arbitres,
    results: retenus,
    sampleSize: new Set(scores.map((s) => s.docId)).size,
  });

  await mkdir(join(publishedDir(), "history"), { recursive: true });
  const out = join(publishedDir(), `${taskId}.json`);
  await writeFile(out, `${JSON.stringify(leaderboard, null, 2)}\n`);

  // Chaque publication s'ajoute à l'historique : c'est lui qui trace l'évolution dans le temps.
  const historyFile = join(publishedDir(), "history", `${taskId}.json`);
  let history: BenchmarkHistory | null = null;
  try {
    history = BenchmarkHistorySchema.parse(JSON.parse(await readFile(historyFile, "utf8")));
  } catch {
    // Première publication de ce benchmark : pas encore d'historique.
  }
  await writeFile(historyFile, `${JSON.stringify(appendHistory(history, leaderboard), null, 2)}\n`);

  if (leaderboard.incomplets > 0) {
    console.log(`${leaderboard.incomplets} document(s) écarté(s) : tout le panel ne les a pas lus.`);
  }
  console.log(`Classement publié sur ${leaderboard.sampleSize} documents, ` +
    `depuis ${runIds.length} run(s) (${review.length} arbitrage(s) humain(s) appliqué(s)) :`);
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
  const taskId = arg("task") ?? "facture-fcc";

  switch (command) {
    case "run": return cmdRun(taskId);
    case "score": return cmdScore(taskId);
    case "review": return cmdReview(taskId);
    case "publish": return cmdPublish(taskId);
    default:
      console.error("Usage : eval <run|score|review|publish> [--task facture-fcc] [--run <id>[,<id>]]\n  --deja <run>   écarte les documents déjà mesurés par ce run");
      process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
