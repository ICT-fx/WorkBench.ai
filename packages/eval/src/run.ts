import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { ModelResult, RunMeta, Task } from "@hub/schema";
import { ModelResultSchema } from "@hub/schema";

export type GenerateArgs = {
  model: string;
  docId: string;
  promptText: string;
  images: Buffer[];
  task: Task;
};

export type GenerateResult = {
  object: unknown;
  /** Version réellement servie par le fournisseur, jamais l'alias demandé. */
  modelVersion: string;
  /** L'hébergeur qui a servi l'appel : deux hébergeurs du même modèle peuvent
   *  le servir plus ou moins compressé. Sans lui, un run n'est pas rejouable. */
  provider?: string;
  latencyMs: number;
  costUsd: number;
  inputTokens?: number;
  outputTokens?: number;
};

export type GenerateFn = (args: GenerateArgs) => Promise<GenerateResult>;

export type RunTaskOptions = {
  task: Task;
  promptText: string;
  documents: { docId: string; images: Buffer[] }[];
  models: string[];
  runId: string;
  /** Racine des runs. Fonction pour faciliter les tests. */
  outRoot: () => string;
  generate: GenerateFn;
  resume?: boolean;
  concurrency?: number;
};

export type RunSummary = { calls: number; errors: number; reused: number; runDir: string };

/** Un alias de modèle contient une barre oblique, un nom de dossier non. */
const slug = (model: string): string => model.replace(/\//g, "_");

const exists = async (p: string): Promise<boolean> =>
  access(p).then(() => true, () => false);

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i]!);
    }
  });
  await Promise.all(runners);
}

/**
 * Exécute un run complet : chaque document soumis à chaque modèle.
 *
 * N'interprète rien : la réponse est écrite telle quelle. Le scoring est une
 * étape séparée, ce qui permet de changer le barème plus tard sans repayer un
 * seul appel.
 */
export async function runTask(opts: RunTaskOptions): Promise<RunSummary> {
  const runDir = join(opts.outRoot(), opts.runId);

  if (!opts.resume && (await exists(runDir))) {
    throw new Error(
      `Le run « ${opts.runId} » existe déjà. Un run est immuable : choisir un autre ` +
      `identifiant, ou relancer avec resume pour compléter celui-ci.`,
    );
  }

  const jobs = opts.models.flatMap((model) =>
    opts.documents.map((doc) => ({ model, doc })));

  let errors = 0;
  let reused = 0;
  const versions = new Map<string, string>();

  await pool(jobs, opts.concurrency ?? 4, async ({ model, doc }) => {
    const dir = join(runDir, "raw", slug(model));
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${doc.docId}.json`);

    if (opts.resume && (await exists(file))) {
      const previous = JSON.parse(await readFile(file, "utf8")) as ModelResult;
      // Un échec se rejoue ; une réponse valide déjà payée se conserve.
      if (previous.error === undefined) {
        reused++;
        versions.set(model, previous.modelVersion);
        return;
      }
    }

    const started = Date.now();
    let result: ModelResult;
    try {
      const r = await opts.generate({
        model, docId: doc.docId, promptText: opts.promptText, images: doc.images, task: opts.task,
      });
      versions.set(model, r.modelVersion);
      result = {
        runId: opts.runId, model, modelVersion: r.modelVersion, docId: doc.docId,
        raw: r.object, latencyMs: r.latencyMs, costUsd: r.costUsd,
        ...(r.provider === undefined ? {} : { provider: r.provider }),
        ...(r.inputTokens === undefined ? {} : { inputTokens: r.inputTokens }),
        ...(r.outputTokens === undefined ? {} : { outputTokens: r.outputTokens }),
      };
    } catch (e) {
      errors++;
      result = {
        runId: opts.runId, model, modelVersion: versions.get(model) ?? model, docId: doc.docId,
        raw: null, latencyMs: Date.now() - started, costUsd: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    await writeFile(file, `${JSON.stringify(ModelResultSchema.parse(result), null, 2)}\n`);
  });

  const meta: RunMeta = {
    runId: opts.runId,
    taskId: opts.task.id,
    startedAt: new Date().toISOString(),
    models: opts.models.map((alias) => ({ alias, version: versions.get(alias) ?? alias })),
    promptHash: createHash("sha256").update(opts.promptText).digest("hex").slice(0, 12),
    docCount: opts.documents.length,
  };
  await writeFile(join(runDir, "run.json"), `${JSON.stringify(meta, null, 2)}\n`);

  return { calls: jobs.length, errors, reused, runDir };
}
