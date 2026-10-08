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

  it("date chaque appel, réussi ou non", async () => {
    const instants = ["2026-10-08T10:00:00.000Z", "2026-10-08T10:00:07.000Z"];
    let i = 0;
    await runTask({
      ...base, runId: "r-date", models: ["a/x"], concurrency: 1,
      maintenant: () => new Date(instants[i++]!),
      generate: fakeGenerate((_, docId) => { if (docId === "f-002") throw new Error("panne"); }),
    });
    const lu = async (doc: string) => JSON.parse(await readFile(join(out, "r-date", "raw", "a_x", `${doc}.json`), "utf8"));
    expect((await lu("f-001")).calledAt).toBe("2026-10-08T10:00:00.000Z");
    expect(await lu("f-002")).toMatchObject({ calledAt: "2026-10-08T10:00:07.000Z", error: "panne" });
  });

  it("consigne la version datée de chaque alias, et la garde quand le run est repris sans lui", async () => {
    const canoniques = new Map([["a/x", "a/x-20260921"], ["b/y", "b/y-20260902"]]);
    await runTask({ ...base, runId: "r-version", models: ["a/x", "b/y"], generate: fakeGenerate(), canoniques });
    await runTask({
      ...base, runId: "r-version", models: ["b/y"], generate: fakeGenerate(), resume: true,
      canoniques: new Map([["b/y", "b/y-20261001"]]),
    });
    const meta = JSON.parse(await readFile(join(out, "r-version", "run.json"), "utf8"));
    expect(meta.models).toEqual([
      { alias: "a/x", version: "a/x-2026-08-01", canonical: "a/x-20260921" },
      // Relancé : il prend la version datée du jour de la reprise.
      { alias: "b/y", version: "b/y-2026-08-01", canonical: "b/y-20261001" },
    ]);
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

  it("garde tous les modèles du run quand on le reprend avec quelques-uns seulement", async () => {
    // Rejouer les échecs de deux modèles ne doit pas effacer la trace des vingt-cinq autres.
    await runTask({ ...base, runId: "r8", models: ["a/x", "b/y", "c/z"], generate: fakeGenerate() });
    await runTask({ ...base, runId: "r8", models: ["b/y"], resume: true, generate: fakeGenerate() });
    const meta = JSON.parse(await readFile(join(out, "r8", "run.json"), "utf8"));
    expect(meta.models.map((m: { alias: string }) => m.alias).sort()).toEqual(["a/x", "b/y", "c/z"]);
    expect(meta.docCount).toBe(2);
  });

  it("garde le nombre de documents du run quand la reprise n'en rejoue qu'une partie", async () => {
    await runTask({ ...base, runId: "r9", models: ["a/x"], generate: fakeGenerate() });
    await runTask({ ...base, runId: "r9", models: ["a/x"], documents: documents.slice(0, 1), resume: true, generate: fakeGenerate() });
    expect(JSON.parse(await readFile(join(out, "r9", "run.json"), "utf8")).docCount).toBe(2);
  });

  it("met à jour la version d'un modèle relancé", async () => {
    await runTask({ ...base, runId: "r10", models: ["a/x"], generate: fakeGenerate() });
    const rejoue: GenerateFn = async ({ model }) => ({ object: {}, modelVersion: `${model}-2026-09-01`, latencyMs: 1, costUsd: 0 });
    // Un échec qu'on rejoue : la nouvelle version servie remplace l'ancienne.
    await writeFile(join(out, "r10", "raw", "a_x", "f-001.json"), JSON.stringify({
      runId: "r10", model: "a/x", modelVersion: "a/x", docId: "f-001", raw: null, latencyMs: 1, costUsd: 0, error: "429",
    }));
    await runTask({ ...base, runId: "r10", models: ["a/x"], resume: true, generate: rejoue });
    const meta = JSON.parse(await readFile(join(out, "r10", "run.json"), "utf8"));
    expect(meta.models).toEqual([{ alias: "a/x", version: "a/x-2026-09-01" }]);
  });
});

describe("une question par document", () => {
  it("envoie à chaque document son propre prompt, et fige le gabarit avec le run", async () => {
    const recus: string[] = [];
    const generate: GenerateFn = async ({ model, docId, promptText }) => {
      recus.push(`${docId}:${promptText}`);
      return { object: {}, modelVersion: `${model}-v`, latencyMs: 10, costUsd: 0.001 };
    };
    await runTask({
      ...base, runId: "r-questions", models: ["a/x"], concurrency: 1, generate,
      promptText: "gabarit {{question}}",
      documents: [
        { docId: "q-1", images: [Buffer.from("p1")], promptText: "gabarit capex ?" },
        { docId: "q-2", images: [Buffer.from("p2")], promptText: "gabarit dette ?" },
      ],
    });
    expect(recus).toEqual(["q-1:gabarit capex ?", "q-2:gabarit dette ?"]);
    expect(await readFile(join(out, "r-questions", "prompt.md"), "utf8")).toBe("gabarit {{question}}");
  });

  it("garde le prompt de la tâche pour un document qui n'en porte pas", async () => {
    const recus: string[] = [];
    const generate: GenerateFn = async ({ model, promptText }) => {
      recus.push(promptText);
      return { object: {}, modelVersion: `${model}-v`, latencyMs: 10, costUsd: 0.001 };
    };
    await runTask({ ...base, runId: "r-commun", models: ["a/x"], generate });
    expect(recus).toEqual(["prompt", "prompt"]);
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
