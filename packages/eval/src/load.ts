import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskSchema, GroundTruthSchema, ModelResultSchema, parseFile } from "@hub/schema";
import type { GroundTruth, ModelResult, Task } from "@hub/schema";

export const DATA_ROOT = "data";
export const taskDir = (taskId: string): string => join(DATA_ROOT, "tasks", taskId);
export const runsRoot = (): string => join(DATA_ROOT, "runs");
export const publishedDir = (): string => join(DATA_ROOT, "published");

export const loadTask = (taskId: string): Promise<Task> =>
  parseFile(TaskSchema, join(taskDir(taskId), "task.json"));

export const loadPrompt = (taskId: string): Promise<string> =>
  readFile(join(taskDir(taskId), "prompt.md"), "utf8");

export type LoadedDocument = { docId: string; images: Buffer[] };

/**
 * Dimensions d'une image JPEG, lues dans son en-tête.
 *
 * Sert à écarter les documents trop lourds : un fournisseur plafonne le total
 * de pixels d'une requête, et surtout, une page huit fois plus grande que les
 * autres coûte huit fois plus cher à tous les modèles. Une comparaison
 * honnête suppose des documents de poids comparable.
 */
export function dimensionsJpeg(data: Buffer): { largeur: number; hauteur: number } | null {
  let i = 2;
  while (i < data.length - 9) {
    if (data[i] !== 0xff) { i++; continue; }
    const marqueur = data[i + 1]!;
    if (marqueur === 0xc0 || marqueur === 0xc1 || marqueur === 0xc2) {
      return { hauteur: data.readUInt16BE(i + 5), largeur: data.readUInt16BE(i + 7) };
    }
    i += 2 + data.readUInt16BE(i + 2);
  }
  return null;
}

export const pixelsTotaux = (images: Buffer[]): number =>
  images.reduce((total, img) => {
    const d = dimensionsJpeg(img);
    return total + (d === null ? 0 : d.largeur * d.hauteur);
  }, 0);

/**
 * Charge les documents d'une tâche.
 *
 * Une facture sur deux pages est stockée en `f-025-p1.png` et `f-025-p2.png` :
 * les deux images appartiennent au même document et partent dans le même appel.
 */
export async function loadDocuments(taskId: string, maxPages?: number): Promise<LoadedDocument[]> {
  const dir = join(taskDir(taskId), "documents");
  const numeroPage = (f: string): number => Number(/-p(\d+)\.\w+$/.exec(f)?.[1] ?? 1);
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".jpg") || f.endsWith(".png"))
    // Tri numérique : un tri alphabétique placerait la page 10 avant la page 2.
    .sort((a, b) => a.localeCompare(b) || 0)
    .sort((a, b) => (a.replace(/-p\d+\.\w+$/, "") === b.replace(/-p\d+\.\w+$/, "")
      ? numeroPage(a) - numeroPage(b) : 0));

  const byDoc = new Map<string, string[]>();
  for (const file of files) {
    const base = file.replace(/\.(png|jpg)$/, "");
    const docId = /-p\d+$/.test(base) ? base.replace(/-p\d+$/, "") : base;
    byDoc.set(docId, [...(byDoc.get(docId) ?? []), file]);
  }

  // Un fournisseur refuse au-delà de huit images par requête. Plutôt que de
  // juger certains modèles sur un sous-ensemble plus facile, on écarte les
  // documents trop longs pour tout le monde, et on l'inscrit dans les limites.
  const retenus = maxPages === undefined
    ? [...byDoc.entries()]
    : [...byDoc.entries()].filter(([, names]) => names.length <= maxPages);

  return Promise.all(
    retenus.map(async ([docId, names]) => ({
      docId,
      images: await Promise.all(names.map((n) => readFile(join(dir, n)))),
    })),
  );
}

export async function loadGroundTruths(taskId: string): Promise<Map<string, GroundTruth>> {
  const dir = join(taskDir(taskId), "ground-truth");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const map = new Map<string, GroundTruth>();
  for (const file of files) {
    const gt = await parseFile(GroundTruthSchema, join(dir, file));
    map.set(gt.docId, gt);
  }
  return map;
}

export async function loadRunResults(runDir: string): Promise<ModelResult[]> {
  const rawDir = join(runDir, "raw");
  const models = await readdir(rawDir);
  const results: ModelResult[] = [];
  for (const model of models) {
    const files = (await readdir(join(rawDir, model))).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      results.push(await parseFile(ModelResultSchema, join(rawDir, model, file)));
    }
  }
  return results;
}
