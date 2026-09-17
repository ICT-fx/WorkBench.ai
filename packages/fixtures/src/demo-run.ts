/**
 * Fabrique un run de DÉMONSTRATION.
 *
 * Aucune de ces réponses ne vient d'un modèle : elles sont inventées pour
 * développer et tester le site avant d'avoir une clé d'API. Le classement issu
 * de ce run est publié avec `status: "demo"`, et le site l'affiche comme tel.
 * Les modèles portent des noms fictifs pour qu'aucune capture d'écran ne puisse
 * être prise pour une mesure réelle.
 */
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ModelResultSchema, GroundTruthSchema, type GroundTruth, type ModelResult } from "@hub/schema";

const RUN_ID = "2026-09-17_demo-facture-fr";
const TASK_ID = "facture-fr";

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

const PROFILS: Profil[] = [
  { alias: "demo/modele-a", version: "demo-a-2026-09", erreur: 0.04, hallucination: 0.0, echec: 0, latence: 4200, prixParAppel: 0.019 },
  { alias: "demo/modele-b", version: "demo-b-2026-09", erreur: 0.09, hallucination: 0.35, echec: 0, latence: 1800, prixParAppel: 0.004 },
  { alias: "demo/modele-c", version: "demo-c-2026-09", erreur: 0.22, hallucination: 0.08, echec: 0.04, latence: 900, prixParAppel: 0.001 },
];

function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    runId: RUN_ID, taskId: TASK_ID, startedAt: "2026-09-17T12:00:00.000Z",
    models: PROFILS.map((p) => ({ alias: p.alias, version: p.version })),
    promptHash: "000000000000", docCount: truths.length,
  }, null, 2)}\n`);

  console.log(`Run de DÉMONSTRATION écrit : ${runDir}`);
  console.log(`${PROFILS.length} modèles fictifs × ${truths.length} documents.`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
