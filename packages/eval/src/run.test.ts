import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskSchema, type Task } from "@hub/schema";
import { runTask, type GenerateFn } from "./run";

/**
 * Un barème de test, écrit ici plutôt que lu dans `data/` : ces tests portent sur
 * le pipeline, pas sur un jeu de données, et ne doivent pas tomber le jour où une
 * tâche est retirée du dépôt.
 */
const task: Task = TaskSchema.parse({
  id: "tache-test",
  label: "Tâche de test",
  question: "Le pipeline se comporte-t-il comme annoncé ?",
  criteria: [
    { id: "total_ttc", label: "Total TTC", kind: "number", weight: 3, critical: true, tolerance: 0 },
    { id: "echeance", label: "Échéance", kind: "date", weight: 1, critical: false },
  ],
});

const documents = [
  { docId: "f-001", images: [Buffer.from("img1")] },
  { docId: "f-002", images: [Buffer.from("img2")] },
];

let out: string;
beforeEach(async () => {
  out = await mkdtemp(join(tmpdir(), "hub-run-"));
});

const fakeGenerate = (behaviour?: (model: string, docId: string) => void): GenerateFn =>
  async ({ model, docId }) => {
    behaviour?.(model, docId);
    return {
      object: { numero_facture: `${docId}-num` },
      modelVersion: `${model}-2026-08-01`,
      latencyMs: 120,
      costUsd: 0.003,
    };
  };

const base = { task, promptText: "prompt", documents, outRoot: () => out };

describe("runTask", () => {
  it("écrit un fichier brut par modèle et par document", async () => {
    await runTask({ ...base, runId: "r1", models: ["a/x", "b/y"], generate: fakeGenerate() });
    const dirs = await readdir(join(out, "r1", "raw"));
    expect(dirs.sort()).toEqual(["a_x", "b_y"]);
    expect((await readdir(join(out, "r1", "raw", "a_x"))).sort())
      .toEqual(["f-001.json", "f-002.json"]);
  });

  it("capture la version réelle du modèle, pas l'alias demandé", async () => {
    await runTask({ ...base, runId: "r2", models: ["a/x"], generate: fakeGenerate() });
    const raw = JSON.parse(await readFile(join(out, "r2", "raw", "a_x", "f-001.json"), "utf8"));
    expect(raw.model).toBe("a/x");
    expect(raw.modelVersion).toBe("a/x-2026-08-01");
  });

  it("enregistre l'erreur et poursuit les autres documents quand un appel échoue", async () => {
    const generate: GenerateFn = async ({ docId, model }) => {
      if (docId === "f-001") throw new Error("timeout après 60 s");
      return { object: {}, modelVersion: `${model}-v`, latencyMs: 10, costUsd: 0.001 };
    };
    const summary = await runTask({ ...base, runId: "r3", models: ["a/x"], generate });
    const ko = JSON.parse(await readFile(join(out, "r3", "raw", "a_x", "f-001.json"), "utf8"));
    const ok = JSON.parse(await readFile(join(out, "r3", "raw", "a_x", "f-002.json"), "utf8"));
    expect(ko.error).toMatch(/timeout/);
    expect(ok.error).toBeUndefined();
    expect(summary.errors).toBe(1);
    expect(summary.calls).toBe(2);
  });

  it("n'écrase jamais un run existant", async () => {
    await runTask({ ...base, runId: "r4", models: ["a/x"], generate: fakeGenerate() });
    await expect(runTask({ ...base, runId: "r4", models: ["a/x"], generate: fakeGenerate() }))
      .rejects.toThrow(/existe déjà/);
  });

  it("réutilise les réponses déjà présentes quand on relance avec resume", async () => {
    await mkdir(join(out, "r5", "raw", "a_x"), { recursive: true });
    await writeFile(join(out, "r5", "raw", "a_x", "f-001.json"), JSON.stringify({
      runId: "r5", model: "a/x", modelVersion: "a/x-ancienne", docId: "f-001",
      raw: { numero_facture: "déjà là" }, latencyMs: 1, costUsd: 0.5,
    }));

    const appels: string[] = [];
    const summary = await runTask({
      ...base, runId: "r5", models: ["a/x"], resume: true,
      generate: fakeGenerate((_m, docId) => { appels.push(docId); }),
    });

    // Un appel déjà payé ne doit jamais être repayé lors d'une reprise.
    expect(appels).toEqual(["f-002"]);
    expect(summary.reused).toBe(1);
    const conserve = JSON.parse(await readFile(join(out, "r5", "raw", "a_x", "f-001.json"), "utf8"));
    expect(conserve.modelVersion).toBe("a/x-ancienne");
  });

  it("rejoue un appel précédemment en échec lors d'une reprise", async () => {
    await mkdir(join(out, "r6", "raw", "a_x"), { recursive: true });
    await writeFile(join(out, "r6", "raw", "a_x", "f-001.json"), JSON.stringify({
      runId: "r6", model: "a/x", modelVersion: "a/x-v", docId: "f-001",
      raw: null, latencyMs: 0, costUsd: 0, error: "timeout",
    }));
    const appels: string[] = [];
    await runTask({
      ...base, runId: "r6", models: ["a/x"], resume: true,
      generate: fakeGenerate((_m, docId) => { appels.push(docId); }),
    });
    expect(appels.sort()).toEqual(["f-001", "f-002"]);
  });

  it("écrit un run.json décrivant ce qui a été exécuté", async () => {
    await runTask({ ...base, runId: "r7", models: ["a/x", "b/y"], generate: fakeGenerate() });
    const meta = JSON.parse(await readFile(join(out, "r7", "run.json"), "utf8"));
    expect(meta.taskId).toBe("tache-test");
    expect(meta.docCount).toBe(2);
    expect(meta.models.map((m: { alias: string }) => m.alias).sort()).toEqual(["a/x", "b/y"]);
    expect(meta.models[0].version).toMatch(/2026-08-01/);
    expect(meta.promptHash).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("ordre de parcours", () => {
  it("épuise un document chez tous les modèles avant de passer au suivant", async () => {
    // Ce qui compte quand le crédit s'épuise : des documents complets plutôt
    // que des modèles complets. Un classement compare des modèles sur les mêmes
    // documents ; des modèles complets sur un échantillon partiel ne valent rien.
    const ordre: string[] = [];
    await runTask({
      task, promptText: "p", documents, models: ["m-a", "m-b", "m-c"],
      runId: "ordre", outRoot: () => out, concurrency: 1,
      generate: async ({ model, docId }) => {
        ordre.push(`${docId}/${model}`);
        return { object: {}, modelVersion: model, latencyMs: 1, costUsd: 0 };
      },
    });
    expect(ordre).toEqual([
      "f-001/m-a", "f-001/m-b", "f-001/m-c",
      "f-002/m-a", "f-002/m-b", "f-002/m-c",
    ]);
  });
});
