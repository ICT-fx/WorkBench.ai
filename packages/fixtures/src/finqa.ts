/**
 * Prépare l'épreuve de départage sur FinQA (Chen et al., 2021, licence MIT).
 *
 * FinQA pose des questions de calcul sur un extrait de rapport annuel — du texte et
 * un tableau — avec la réponse et le programme de calcul écrits par des annotateurs.
 * On n'en garde que les calculs à trois étapes ou plus, et seulement ceux dont la
 * référence ne laisse aucun doute d'échelle : les deux rendements des actifs et le
 * taux de rétention de FinanceBench ont montré qu'un ratio écrit sans son signe « % »
 * mesure l'échelle devinée, pas le calcul.
 *
 * Le document est du texte, pas une image : le modèle reçoit l'extrait tel que le jeu
 * le donne.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { GroundTruthSchema } from "@hub/schema";
import { ligneCsv } from "./financebench";

const TASK_DIR = join("data", "tasks", "departage-finqa");
const CACHE = join(".cache", "finqa", "test.json");
const SOURCE = "https://raw.githubusercontent.com/czyssrs/FinQA/main/dataset/test.json";
const GRAINE = "workbench-finqa-v1:";
/** Le nombre de questions posées : fixé par le budget, pas par les résultats. */
export const NOMBRE = 40;

export type QuestionFinqa = {
  id: string; pre_text: string[]; post_text: string[]; table: string[][];
  qa: { question: string; answer: string; program: string; exe_ans: number | string };
};

export const etapes = (q: QuestionFinqa): number => q.qa.program.split("),").length;
const derniere = (q: QuestionFinqa): string => q.qa.program.split("),").at(-1)!.trim().split("(")[0]!;
const NOMBRE_NU = /^-?\$?\s?-?[\d,]*\.?\d+\s?%?$/;

/** La référence écrite par l'annotateur, sans son unité : « 113.63% » → « 113.63 ». */
export const reference = (reponse: string): string => reponse.trim().replace(/[\s$,%]/g, "");

/**
 * Pourquoi une question est écartée, ou `null` si elle est gardée.
 *
 * La dernière règle recoupe la réponse écrite avec le programme exécuté : quand les
 * deux ne disent pas la même chose, l'un des deux est faux, et on ne sait pas lequel.
 */
export function motifExclusion(q: QuestionFinqa): string | null {
  if (etapes(q) < 3) return "calcul en moins de trois étapes";
  const a = q.qa.answer.trim();
  if (a === "") return "réponse vide";
  if (!NOMBRE_NU.test(a)) return "réponse non numérique";
  if (derniere(q) === "divide" && !a.includes("%")) return "ratio sans signe % : échelle ambiguë";
  const v = Number(reference(a)), e = Number(q.qa.exe_ans);
  if (!Number.isFinite(v) || !Number.isFinite(e)) return "réponse illisible";
  const proche = (x: number, y: number): boolean => Math.abs(x - y) <= Math.max(0.006 * Math.abs(y), 0.06);
  if (!proche(v, e) && !proche(v, e * 100)) return "réponse écrite différente du programme exécuté";
  return null;
}

/** L'ordre de tirage : l'empreinte de l'identifiant, pour que personne ne choisisse. */
export const ordre = (ids: string[]): string[] =>
  [...ids].sort((a, b) => createHash("sha256").update(GRAINE + a).digest("hex")
    .localeCompare(createHash("sha256").update(GRAINE + b).digest("hex")));

/** L'extrait tel que le modèle le lit : texte, tableau ligne à ligne, texte. */
export const extrait = (q: QuestionFinqa): string => [
  q.pre_text.join("\n"), "", ...q.table.map((l) => l.join(" | ")), "", q.post_text.join("\n"),
].join("\n").trim();

const existe = (p: string): Promise<boolean> => access(p).then(() => true, () => false);

async function main(): Promise<void> {
  if (!(await existe(CACHE))) {
    const r = await fetch(SOURCE);
    if (!r.ok) throw new Error(`FinQA inaccessible : ${r.status}`);
    await mkdir(join(CACHE, ".."), { recursive: true });
    await writeFile(CACHE, Buffer.from(await r.arrayBuffer()));
  }
  const jeu = JSON.parse(await readFile(CACHE, "utf8")) as QuestionFinqa[];
  const parId = new Map(jeu.map((q) => [q.id, q]));
  const longues = jeu.filter((q) => etapes(q) >= 3);
  const eligibles = longues.filter((q) => motifExclusion(q) === null);
  const tirees = ordre(eligibles.map((q) => q.id)).slice(0, NOMBRE);

  await mkdir(join(TASK_DIR, "ground-truth"), { recursive: true });
  const tri = [ligneCsv(["finqa_id", "statut", "motif", "etapes", "reponse"])];
  for (const q of longues) {
    const motif = motifExclusion(q);
    const statut = motif !== null ? "écartée" : tirees.includes(q.id) ? "retenue" : "éligible, non tirée";
    tri.push(ligneCsv([q.id, statut, motif ?? "", String(etapes(q)), q.qa.answer.trim()]));
  }
  await writeFile(join(TASK_DIR, "tri.csv"), `${tri.join("\n")}\n`);

  const manifeste = [ligneCsv(["file_id", "finqa_id", "sous_tache", "forme", "etapes", "question", "attendu", "programme", "url"])];
  for (const [i, id] of tirees.entries()) {
    const q = parId.get(id)!;
    const docId = `fq-${String(i + 1).padStart(2, "0")}`;
    const gt = GroundTruthSchema.parse({ docId, fields: { calcul: reference(q.qa.answer) }, notes: `FinQA ${id}` });
    await writeFile(join(TASK_DIR, "ground-truth", `${docId}.json`), `${JSON.stringify(gt, null, 2)}\n`);
    manifeste.push(ligneCsv([
      docId, id, "calcul", "nombre", String(etapes(q)),
      `${extrait(q)}\n\nQuestion: ${q.qa.question.trim()}`, q.qa.answer.trim(), q.qa.program,
      "https://github.com/czyssrs/FinQA/blob/main/dataset/test.json",
    ]));
  }
  await writeFile(join(TASK_DIR, "manifest.csv"), `${manifeste.join("\n")}\n`);
  console.log(`${longues.length} calculs à trois étapes ou plus, ${eligibles.length} éligibles, ${tirees.length} retenus.`);
}

if (process.argv[1]?.includes("finqa")) {
  main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
