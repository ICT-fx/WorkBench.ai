/**
 * Fabrique les réponses brutes d'un run de DÉMONSTRATION.
 *
 * Aucune de ces réponses ne vient d'un modèle : elles sont inventées pour
 * développer et tester le site avant d'avoir une clé d'API. Le site n'affiche
 * des réponses brutes que pour un panel — le dernier modèle capable de lire une
 * image chez chacun des grands labos — dont le taux d'erreur suit le classement
 * de démonstration (`npm run demo:hub`), publié avec `status: "demo"`.
 */
import { mkdir, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  ModelResultSchema, GroundTruthSchema, BenchmarkSchema, LabSchema, ModelCatalogueSchema,
  type GroundTruth, type ModelResult,
} from "@hub/schema";
import { DERNIER_RUN, ligne, peutPasser, rng, runIdDemo } from "./demo-model";

const TASK_ID = "facture-fr";
const RUN_ID = runIdDemo(DERNIER_RUN, TASK_ID);

type Profil = {
  alias: string;
  version: string;
  /** Probabilité de se tromper sur un champ donné. */
  erreur: number;
  /** Probabilité d'inventer une valeur là où il n'y a rien. */
  hallucination: number;
  /** Probabilité qu'un appel échoue. */
  echec: number;
  latence: number;
  prixParAppel: number;
};

const json = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

/** Le panel : chez chaque labo doté d'une couleur, le modèle le plus récent qui lit les images. */
async function panel(): Promise<Profil[]> {
  const dir = join("data", "catalogue");
  const { models } = ModelCatalogueSchema.parse(await json(join(dir, "models.json")));
  const labs = z.array(LabSchema).parse(await json(join(dir, "labs.json")));
  const task = z.array(BenchmarkSchema).parse(await json(join(dir, "benchmarks.json")))
    .find((b) => b.id === TASK_ID);
  if (task === undefined) throw new Error(`Benchmark ${TASK_ID} absent du catalogue`);

  return labs.filter((l) => l.slot !== undefined).flatMap((lab) => {
    const dernier = models
      .filter((m) => m.lab === lab.id && peutPasser(m, task) && m.released <= DERNIER_RUN)
      .sort((a, b) => b.released.localeCompare(a.released))[0];
    if (dernier === undefined) return [];
    const row = ligne(dernier, task, DERNIER_RUN);
    return [{
      alias: row.model,
      version: row.modelVersion,
      erreur: (100 - row.exactitude) / 100,
      hallucination: row.hallucinations / 100,
      echec: row.errorCount / task.sampleSize,
      latence: row.latencyP50,
      prixParAppel: row.costPerDoc,
    }];
  });
}

function abimer(value: unknown, rand: () => number): unknown {
  if (typeof value === "number") return Math.round(value * (1 + (rand() - 0.5) * 0.2) * 100) / 100;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return `${y}-${d}-${m}`; // inversion jour/mois, l'erreur classique
    }
    return `${value.slice(0, -1)}${(Number(value.slice(-1)) + 1) % 10}`;
  }
  return value;
}

const INVENTIONS: Record<string, unknown> = {
  total_tva: 246.5,
  tva_intracom: "FR40123456789",
  echeance: "2026-12-31",
  mentions_speciales: "Paiement à 30 jours",
  siret_emetteur: "12345678900017",
};

function repondre(gt: GroundTruth, profil: Profil): Record<string, unknown> {
  const rand = rng(`${profil.alias}:${gt.docId}`);
  const out: Record<string, unknown> = {};
  for (const [key, expected] of Object.entries(gt.fields)) {
    if (expected === null) {
      out[key] = rand() < profil.hallucination ? (INVENTIONS[key] ?? "valeur inventée") : null;
    } else {
      out[key] = rand() < profil.erreur ? abimer(expected, rand) : expected;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const gtDir = join("data", "tasks", TASK_ID, "ground-truth");
  const files = (await readdir(gtDir)).filter((f) => f.endsWith(".json")).sort();
  const truths = await Promise.all(files.map(async (f) =>
    GroundTruthSchema.parse(JSON.parse(await readFile(join(gtDir, f), "utf8")))));

  const runDir = join("data", "runs", RUN_ID);
  const PROFILS = await panel();
  // Un run de démonstration se régénère en entier : pas de réponses orphelines
  // d'un ancien panel à côté des nouvelles.
  await rm(runDir, { recursive: true, force: true });

  for (const profil of PROFILS) {
    const dir = join(runDir, "raw", profil.alias.replace(/\//g, "_"));
    await mkdir(dir, { recursive: true });

    for (const gt of truths) {
      const rand = rng(`echec:${profil.alias}:${gt.docId}`);
      const enEchec = rand() < profil.echec;

      const result: ModelResult = enEchec
        ? {
            runId: RUN_ID, model: profil.alias, modelVersion: profil.version, docId: gt.docId,
            raw: null, latencyMs: 60000, costUsd: 0, error: "timeout après 60 s (démonstration)",
          }
        : {
            runId: RUN_ID, model: profil.alias, modelVersion: profil.version, docId: gt.docId,
            raw: repondre(gt, profil),
            latencyMs: Math.round(profil.latence * (0.6 + rand() * 0.9)),
            costUsd: Math.round(profil.prixParAppel * (0.8 + rand() * 0.4) * 1e6) / 1e6,
            inputTokens: 1500, outputTokens: 320,
          };

      await writeFile(join(dir, `${gt.docId}.json`),
        `${JSON.stringify(ModelResultSchema.parse(result), null, 2)}\n`);
    }
  }

  await writeFile(join(runDir, "run.json"), `${JSON.stringify({
    runId: RUN_ID, taskId: TASK_ID, startedAt: `${DERNIER_RUN}T12:00:00.000Z`,
    models: PROFILS.map((p) => ({ alias: p.alias, version: p.version })),
    promptHash: "000000000000", docCount: truths.length,
  }, null, 2)}\n`);

  console.log(`Run de DÉMONSTRATION écrit : ${runDir}`);
  console.log(`${PROFILS.length} modèles du panel × ${truths.length} documents, réponses fabriquées.`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
