/**
 * Prépare la tâche « analyse de rapports financiers » à partir de FinanceBench.
 *
 * FinanceBench (Patronus AI, CC BY-NC 4.0) réunit des questions d'analyste sur des
 * rapports de sociétés cotées américaines. Chaque réponse a été écrite par un
 * humain, avec la page du rapport qui la prouve.
 *
 * Ici, une question est un document : la ou les pages de preuve en image, et le
 * texte de la question. Le périmètre vient de `tri.csv`, où les 150 questions
 * ouvertes sont triées une à une ; cette préparation ne choisit rien, elle
 * vérifie et elle rend.
 *
 * Elle s'arrête à la première anomalie. Une page qui ne correspond pas, une
 * unité introuvable, une valeur illisible : chacune fausserait la mesure sans
 * lever d'erreur plus tard, et aucune ne se rattrape une fois le run payé.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import * as mupdf from "mupdf";
import sharp from "sharp";
import { GroundTruthSchema, parseCsv, type GroundTruth, type Value } from "@hub/schema";

const TASK_DIR = join("data", "tasks", "analyse-financiere");
const CACHE = join(".cache", "financebench");
const DEPOT = "https://raw.githubusercontent.com/patronus-ai/financebench/main";
const pagePdf = (rapport: string): string =>
  `https://github.com/patronus-ai/financebench/blob/main/pdfs/${rapport}.pdf`;

/** Ce que le tirage retient dans chaque catégorie de réponse. */
export const QUOTAS: Record<string, number> = {
  releve: 8, calcul: 18, oui: 5, non: 6, sans_objet: 1, libelle: 9, aucun: 3,
};

const GRAINE = "workbench-finance-v1:";

export type Eligible = { id: string; categorie: string; societe: string };

/**
 * Tire les questions retenues parmi les éligibles, sans que personne ne choisisse.
 *
 * Dans chaque catégorie, les questions sont rangées selon l'empreinte de leur
 * identifiant et prises dans cet ordre, deux par société au plus. L'ordre ne
 * dépend ni de la question, ni de sa difficulté, ni de l'ordre du fichier : on
 * ne peut pas retenir une question parce qu'elle arrange.
 */
export function tirageParForme(
  eligibles: Eligible[], quotas: Record<string, number>, maxParSociete = 2,
): string[] {
  const empreinte = (id: string): string =>
    createHash("sha256").update(GRAINE + id).digest("hex");

  return Object.entries(quotas).flatMap(([categorie, quota]) => {
    const parSociete = new Map<string, number>();
    const retenues: string[] = [];
    const candidates = eligibles
      .filter((e) => e.categorie === categorie)
      .sort((a, b) => empreinte(a.id).localeCompare(empreinte(b.id)));
    for (const c of candidates) {
      if (retenues.length === quota) break;
      const deja = parSociete.get(c.societe) ?? 0;
      if (deja >= maxParSociete) continue;
      parSociete.set(c.societe, deja + 1);
      retenues.push(c.id);
    }
    if (retenues.length < quota) {
      throw new Error(`Tirage impossible : ${retenues.length} question(s) « ${categorie} » pour un quota de ${quota}.`);
    }
    return retenues;
  });
}

/**
 * La référence d'un nombre, telle que l'analyste l'a écrite, sans son unité.
 *
 * Elle reste une chaîne : « 1616.00 » et « 1.9 » ne s'arrondissent pas à la même
 * décimale, et c'est cette écriture qui fixe la tolérance. Tout ce qui n'est pas
 * un nombre nu arrête la préparation.
 */
export function referenceNombre(reponse: string): string {
  const nu = reponse.trim().replace(/^\$/, "").replace(/%$/, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(nu)) {
    throw new Error(`Référence illisible comme nombre : « ${reponse} ».`);
  }
  return nu;
}

const nombres = (texte: string): Set<string> => new Set(texte.match(/\d[\d,]*\.?\d*/g) ?? []);

/** Part des nombres de la page du jeu qu'on retrouve dans la page du PDF. */
export function recoupement(pageDuJeu: string, pageDuPdf: string): number {
  const attendus = nombres(pageDuJeu);
  if (attendus.size === 0) return 1;
  const trouves = nombres(pageDuPdf);
  return [...attendus].filter((n) => trouves.has(n)).length / attendus.size;
}

const UNITE = new RegExp(
  "(?:in|\\$|dollars|amounts)\\s*(?:in\\s*)?\\(?(millions|thousands|billions)" +
  "|\\((millions|thousands|billions)" +
  "|(millions|thousands|billions) of (?:u\\.?s\\.? )?dollars" +
  "|(millions|thousands|billions),? except", "i");

/** L'unité des montants, quand la page l'imprime : sans elle, un chiffre lu ne se convertit pas. */
export function uniteImprimee(texte: string): string | null {
  const m = UNITE.exec(texte);
  return m === null ? null : (m[1] ?? m[2] ?? m[3] ?? m[4])!.toLowerCase();
}

export const formesAcceptees = (attendu: string): string[] =>
  attendu.split("|").map((f) => f.trim()).filter((f) => f !== "");

const aplati = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Vrai si l'une des formes acceptées est imprimée sur la page. */
export const figureSurLaPage = (texte: string, formes: string[]): boolean =>
  formes.some((f) => ` ${aplati(texte)} `.includes(` ${aplati(f)} `));

/** Une ligne de CSV, guillemets doublés : les questions portent virgules et guillemets. */
export const ligneCsv = (valeurs: string[]): string =>
  valeurs.map((v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",");

const existe = (p: string): Promise<boolean> => access(p).then(() => true, () => false);

async function enCache(chemin: string, url: string): Promise<Buffer> {
  const fichier = join(CACHE, chemin);
  if (!(await existe(fichier))) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Téléchargement impossible (${r.status}) : ${url}`);
    await mkdir(join(fichier, ".."), { recursive: true });
    await writeFile(fichier, Buffer.from(await r.arrayBuffer()));
  }
  return readFile(fichier);
}

type Preuve = { doc_name: string; evidence_page_num: number; evidence_text_full_page: string };
type QuestionDuJeu = {
  financebench_id: string; company: string; doc_name: string; question: string;
  answer: string; justification: string | null; evidence: Preuve[];
};

const jsonl = <T>(b: Buffer): T[] =>
  b.toString("utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as T);

/** Deux millions de pixels au plus : une page plus lourde coûterait plus cher à tout le panel. */
const PIXELS_MAX = 2_000_000;

async function rendrePage(doc: mupdf.Document, index: number): Promise<Buffer> {
  const page = doc.loadPage(index);
  const [x0, y0, x1, y1] = page.getBounds() as unknown as [number, number, number, number];
  const echelle = Math.min(1.7, Math.sqrt(PIXELS_MAX / ((x1 - x0) * (y1 - y0))));
  const pix = page.toPixmap(mupdf.Matrix.scale(echelle, echelle), mupdf.ColorSpace.DeviceRGB, false, true);
  return sharp(Buffer.from(pix.asPNG())).grayscale().jpeg({ quality: 82 }).toBuffer();
}

async function main(): Promise<void> {
  const tri = parseCsv(await readFile(join(TASK_DIR, "tri.csv"), "utf8"));
  // Les questions écartées après le run restent préparées : leurs pages et leur
  // vérité terrain servent à montrer pourquoi elles l'ont été.
  const tirage = tri.filter((l) => l.statut === "retenue" || l.statut === "écartée après le run");
  // L'extension ajoute, après le premier run, les calculs éligibles que le tirage n'avait
  // pas retenus : le haut du classement ne se départageait pas, et ce sont eux qui font
  // se tromper les meilleurs modèles. Le tirage, lui, reste celui qu'on a annoncé.
  const extension = tri.filter((l) => l.statut === "extension" || l.statut === "extension écartée après le run");
  const retenues = [...tirage, ...extension];

  // Le périmètre versionné doit être celui que la règle de tirage produit. S'ils
  // divergent, quelqu'un a retouché une ligne à la main, et le jeu n'est plus
  // celui qu'on annonce.
  const tirees = new Set(tirageParForme(
    tri.filter((l) => l.categorie !== "").map((l) => ({
      id: l.financebench_id!, categorie: l.categorie!, societe: l.societe!,
    })), QUOTAS));
  const ecart = tirage.filter((l) => !tirees.has(l.financebench_id!));
  if (ecart.length > 0 || tirage.length !== tirees.size) {
    throw new Error(`tri.csv ne correspond pas au tirage : ${ecart.map((l) => l.financebench_id).join(", ")}`);
  }

  const jeu = new Map(jsonl<QuestionDuJeu>(
    await enCache("financebench_open_source.jsonl", `${DEPOT}/data/financebench_open_source.jsonl`),
  ).map((q) => [q.financebench_id, q]));
  const origines = new Map(jsonl<{ doc_name: string; doc_link: string }>(
    await enCache("financebench_document_information.jsonl", `${DEPOT}/data/financebench_document_information.jsonl`),
  ).map((d) => [d.doc_name, d.doc_link]));

  const docsDir = join(TASK_DIR, "documents");
  const gtDir = join(TASK_DIR, "ground-truth");
  await mkdir(docsDir, { recursive: true });
  await mkdir(gtDir, { recursive: true });

  const pdfs = new Map<string, mupdf.Document>();
  const ouvrir = async (rapport: string): Promise<mupdf.Document> => {
    const deja = pdfs.get(rapport);
    if (deja !== undefined) return deja;
    const doc = mupdf.Document.openDocument(
      await enCache(join("pdfs", `${rapport}.pdf`), `${DEPOT}/pdfs/${rapport}.pdf`), "application/pdf");
    pdfs.set(rapport, doc);
    return doc;
  };

  const entetes = ["file_id", "financebench_id", "sous_tache", "forme", "societe", "rapport",
    "pages", "question", "attendu", "formule", "url", "source_origine"];
  const manifeste = [ligneCsv(entetes)];
  let images = 0, octets = 0;

  for (const l of retenues) {
    const id = l.financebench_id!;
    const q = jeu.get(id);
    if (q === undefined) throw new Error(`${id} : absente du jeu de données.`);
    const docId = `fb-${id.slice(-5)}`;
    const arret = (motif: string): never => { throw new Error(`${docId} (${q.doc_name}) : ${motif}`); };

    if (q.evidence.some((e) => e.doc_name !== q.doc_name)) arret("une preuve vient d'un autre rapport.");
    const pages = [...new Set(q.evidence.map((e) => e.evidence_page_num))].sort((a, b) => a - b);
    const doc = await ouvrir(q.doc_name);

    // 1. La page du PDF est bien celle que l'annotateur a lue.
    const textes: string[] = [];
    for (const p of pages) {
      const texte = doc.loadPage(p).toStructuredText("preserve-whitespace").asText();
      const duJeu = q.evidence.find((e) => e.evidence_page_num === p)!.evidence_text_full_page;
      const part = recoupement(duJeu, texte);
      if (part < 0.8) arret(`la page ${p + 1} ne recoupe le jeu qu'à ${Math.round(part * 100)} %.`);
      textes.push(texte);
    }
    const lu = textes.join("\n");

    // 2. Ce qu'il faut pour répondre est imprimé sur la page.
    const formes = formesAcceptees(l.attendu ?? "");
    if (l.forme === "nombre" && /USD\s+(millions|billions|thousands)/i.test(q.question) && uniteImprimee(lu) === null) {
      arret("la question demande un montant et la page n'imprime pas son unité.");
    }
    if (l.categorie === "libelle" && !figureSurLaPage(lu, formes)) {
      arret(`aucune forme attendue (${formes.join(" | ")}) ne figure sur la page.`);
    }

    // 3. La vérité terrain : un seul critère, celui que la question pose.
    let attendu: Value | null;
    if (l.forme === "nombre") attendu = referenceNombre(q.answer);
    else if (l.forme === "verdict") {
      if (!["yes", "no", "not_applicable"].includes(l.attendu ?? "")) arret(`verdict inconnu « ${l.attendu} ».`);
      attendu = l.attendu!;
    } else if (l.categorie === "aucun") attendu = null;
    else {
      if (formes.length === 0) arret("libellé sans forme attendue.");
      attendu = formes;
    }
    const gt: GroundTruth = GroundTruthSchema.parse({
      docId, fields: { [l.sous_tache!]: attendu }, notes: `FinanceBench ${id}`,
    });
    await writeFile(join(gtDir, `${docId}.json`), `${JSON.stringify(gt, null, 2)}\n`);

    // 4. Les pages, telles que le modèle les verra.
    for (const [k, p] of pages.entries()) {
      const image = await rendrePage(doc, p);
      await writeFile(join(docsDir, `${docId}-p${k + 1}.jpg`), image);
      images++;
      octets += image.length;
    }

    manifeste.push(ligneCsv([
      docId, id, l.sous_tache!, l.forme!, q.company, q.doc_name,
      pages.map((p) => p + 1).join(" ; "),
      q.question.replace(/\s+/g, " ").trim(),
      l.forme === "nombre" ? q.answer.trim() : (l.attendu ?? ""),
      (q.justification ?? "").replace(/\s+/g, " ").trim(),
      pagePdf(q.doc_name), origines.get(q.doc_name) ?? "",
    ]));
  }

  await writeFile(join(TASK_DIR, "manifest.csv"), `${manifeste.join("\n")}\n`);
  console.log(`${retenues.length} questions préparées, ${pdfs.size} rapports, ` +
    `${images} pages rendues (${(octets / 1e6).toFixed(1)} Mo).`);
}

if (process.argv[1]?.includes("financebench")) {
  main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
