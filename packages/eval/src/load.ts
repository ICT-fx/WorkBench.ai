import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  TaskSchema, GroundTruthSchema, ModelResultSchema, RunCalendarSchema, TestProtocolSchema, parseFile, parseCsv,
} from "@hub/schema";
import type { GroundTruth, ModelResult, RunCalendar, Task, TestProtocol } from "@hub/schema";

export const DATA_ROOT = "data";
export const taskDir = (taskId: string): string => join(DATA_ROOT, "tasks", taskId);
export const runsRoot = (): string => join(DATA_ROOT, "runs");
export const publishedDir = (): string => join(DATA_ROOT, "published");
/** Le test figé de chaque benchmark publié, un fichier par tâche. */
export const protocolesDir = (): string => join(publishedDir(), "protocoles");

export const loadTask = (taskId: string): Promise<Task> =>
  parseFile(TaskSchema, join(taskDir(taskId), "task.json"));

export const loadPrompt = (taskId: string): Promise<string> =>
  readFile(join(taskDir(taskId), "prompt.md"), "utf8");

export type LoadedDocument = {
  docId: string;
  images: Buffer[];
  /** Le prompt propre à ce document, quand la tâche pose une question par document. */
  promptText?: string;
};

/**
 * Compose le prompt d'une question : le gabarit de la tâche, la question, et la
 * seule consigne de format qui la concerne.
 *
 * Le gabarit porte `{{question}}` puis un bloc par forme de réponse, ouvert par
 * `<!-- forme: nom -->`. Garder les trois consignes dans un même fichier permet
 * au run de figer, d'un seul tenant, tout ce qui a pu être envoyé.
 */
export function composerPrompt(gabarit: string, question: string, forme: string): string {
  const [entete, ...blocs] = gabarit.split(/<!--\s*forme:\s*([\w-]+)\s*-->/);
  if (!entete!.includes("{{question}}")) {
    throw new Error("Le gabarit du prompt ne porte pas {{question}} : la question ne serait pas posée.");
  }
  const consignes = new Map<string, string>();
  for (let i = 0; i < blocs.length; i += 2) consignes.set(blocs[i]!, blocs[i + 1] ?? "");
  const consigne = consignes.get(forme);
  if (consigne === undefined) {
    throw new Error(`Le gabarit du prompt n'a pas de consigne pour la forme « ${forme} ».`);
  }
  // Une fonction de remplacement : une question contenant « $& » ne doit pas être réinterprétée.
  return `${entete!.replace("{{question}}", () => question).trimEnd()}\n\n${consigne.trim()}\n`;
}

/**
 * Les documents écartés d'une tâche après coup, avec leur motif.
 *
 * Un document peut être écarté après le run, quand on découvre en dépouillant
 * les réponses que sa question mesure autre chose que ce qu'on croyait. Ses
 * réponses restent enregistrées et consultables, mais il n'entre plus ni dans
 * le périmètre d'un rejeu, ni dans la notation. Table vide si la tâche n'en a pas.
 */
export async function loadExclusions(taskId: string): Promise<Map<string, string>> {
  let texte: string;
  try {
    texte = await readFile(join(taskDir(taskId), "exclusions.json"), "utf8");
  } catch {
    return new Map();
  }
  const liste = z.array(z.object({
    docId: z.string().min(1), motif: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).parse(JSON.parse(texte));
  return new Map(liste.map((e) => [e.docId, e.motif]));
}

/**
 * Les échecs que l'on impute au modèle, avec leur motif, clés `modèle/document`.
 *
 * Chacun a été lu : le texte de la réponse rejetée, ou son absence, montre que le
 * modèle n'a rien rendu d'exploitable. Table vide si la tâche n'en a pas.
 */
export async function loadEchecsImputes(taskId: string): Promise<Map<string, string>> {
  let texte: string;
  try {
    texte = await readFile(join(taskDir(taskId), "echecs-imputes.json"), "utf8");
  } catch {
    return new Map();
  }
  const liste = z.array(z.object({
    model: z.string().min(1), docId: z.string().min(1), motif: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).parse(JSON.parse(texte));
  return new Map(liste.map((e) => [`${e.model}/${e.docId}`, e.motif]));
}

/** Le périmètre sans les documents écartés. L'ordre des autres ne change pas. */
export const sansExclusions = <T extends { docId: string }>(
  documents: T[], exclusions: ReadonlyMap<string, string>,
): T[] => documents.filter((d) => !exclusions.has(d.docId));

export type Question = {
  question: string;
  forme: string;
  /** Les pages attendues en image. Vide : le document est du texte seul, tout est dans la question. */
  pages: string;
};

/**
 * Les questions d'une tâche qui en pose une par document, lues dans son manifeste.
 *
 * Rend une table vide pour une tâche sans colonne `question` : les factures
 * reçoivent toutes le même prompt, et leur manifeste n'en porte pas.
 */
export async function loadQuestions(taskId: string): Promise<Map<string, Question>> {
  let texte: string;
  try {
    texte = await readFile(join(taskDir(taskId), "manifest.csv"), "utf8");
  } catch {
    return new Map();
  }
  const questions = new Map<string, Question>();
  for (const l of parseCsv(texte)) {
    if (l.file_id === undefined || l.question === undefined) continue;
    if (l.question === "" || l.forme === undefined || l.forme === "") {
      throw new Error(`Manifeste de ${taskId} : la ligne ${l.file_id} n'a pas de question ou pas de forme.`);
    }
    questions.set(l.file_id, { question: l.question, forme: l.forme, pages: l.pages ?? "" });
  }
  return questions;
}

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

/** Le test figé d'un benchmark publié, ou rien s'il n'a jamais été publié. */
export async function loadProtocole(taskId: string): Promise<TestProtocol | null> {
  try {
    return await parseFile(TestProtocolSchema, join(protocolesDir(), `${taskId}.json`));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Les dates d'appel relevées pour un run antérieur à `calledAt`, s'il y en a. */
export async function loadCalendrier(runDir: string): Promise<RunCalendar | null> {
  try {
    return await parseFile(RunCalendarSchema, join(runDir, "calendrier.json"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
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

/**
 * Les documents d'une tâche, prêts à être envoyés : le run et la notation partent de
 * la même liste, sans quoi leurs périmètres divergeraient.
 *
 * Une tâche qui pose une question par document compose un prompt par document. Un
 * document en image sans question arrête tout, comme une question qui attend des pages
 * qu'on n'a pas rendues : envoyer l'un sans l'autre serait payer pour une réponse à
 * rien. Une question sans pages attendues est un document en texte seul.
 */
export async function loadTaskDocuments(taskId: string): Promise<LoadedDocument[]> {
  const [gabarit, questions] = await Promise.all([loadPrompt(taskId), loadQuestions(taskId)]);
  // Une tâche en texte seul n'a pas de dossier d'images.
  const images = await loadDocuments(taskId).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [] as LoadedDocument[];
    throw e;
  });
  if (questions.size === 0) return images;

  const enImages = new Map(images.map((d) => [d.docId, d]));
  for (const d of images) {
    if (!questions.has(d.docId)) throw new Error(`Le document ${d.docId} n'a pas de question dans le manifeste de ${taskId}.`);
  }
  return [...questions].sort(([a], [b]) => a.localeCompare(b)).map(([docId, q]) => {
    const pages = enImages.get(docId)?.images ?? [];
    if (pages.length === 0 && q.pages !== "") {
      throw new Error(`La question ${docId} attend les pages ${q.pages}, qui n'ont pas été rendues.`);
    }
    return { docId, images: pages, promptText: composerPrompt(gabarit, q.question, q.forme) };
  });
}
