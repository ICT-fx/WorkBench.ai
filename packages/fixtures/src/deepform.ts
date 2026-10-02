/**
 * Prépare le benchmark « lecture de factures » à partir de DeepForm.
 *
 * Les documents sont de vraies factures d'achat d'espace publicitaire
 * télévisé, déposées auprès du régulateur américain en 2020 et étiquetées à la
 * main par des journalistes. On les convertit en images page par page : c'est
 * le seul traitement identique pour tous les modèles, et c'est le cas réel
 * d'une facture reçue en scan.
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import * as mupdf from "mupdf";
import sharp from "sharp";
import { GroundTruthSchema, parseCsv, type GroundTruth } from "@hub/schema";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/project-deepform/deepform/master/data/fcc-data-2020-labeled-manifest.csv";
export const TASK_ID = "facture-fcc";
const TASK_DIR = join("data", "tasks", TASK_ID);

export type LigneManifeste = {
  file_id: string; title: string; contract_num: string; advertiser: string;
  gross_amount: string; flight_from: string; flight_to: string; issues: string; url: string;
};


/**
 * Une cellule remplie mais que nous ne savons pas lire.
 *
 * On ne la convertit jamais en `null` : ce `null` signifierait « absent du
 * document » et deviendrait un piège à hallucination imaginaire, où un modèle
 * lisant correctement la valeur serait accusé de l'avoir inventée.
 */
export class ValeurIllisible extends Error {
  constructor(champ: string, brut: string) {
    super(`Valeur illisible dans le manifeste (${champ}) : ${JSON.stringify(brut)}`);
    this.name = "ValeurIllisible";
  }
}

/** « $1,880.00 » et « 14,625.00 » valent tous deux 1880 et 14625. */
export function montant(brut: string): number | null {
  if (brut.trim() === "") return null;
  const s = brut.replace(/[$\s]/g, "").replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new ValeurIllisible("montant", brut);
  return n;
}

const MOIS_EN = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"];

/** Les dates du manifeste sont américaines : 02/03/20 est le 3 février. */
export function dateUS(brut: string): string | null {
  const t = brut.trim();
  if (t === "") return null;

  const rendre = (an: number, mois: number, jour: number): string | null => {
    if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
    const annee = an < 100 ? 2000 + an : an;
    if (annee < 2000 || annee > 2100) return null;
    return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  };

  const chiffres = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(t);
  if (chiffres !== null) {
    const d = rendre(Number(chiffres[3]), Number(chiffres[1]), Number(chiffres[2]));
    if (d !== null) return d;
  }

  // « February 12, 2020 », « May12/20 », « Feb 3 2020 »
  const ecrite = /^([a-zA-Z]+)\.?\s*(\d{1,2})(?:st|nd|rd|th)?[,\s/-]+(\d{2}|\d{4})$/.exec(t);
  if (ecrite !== null) {
    const nom = ecrite[1]!.toLowerCase().slice(0, 3);
    const mois = MOIS_EN.findIndex((m) => m.startsWith(nom)) + 1;
    if (mois > 0) {
      const d = rendre(Number(ecrite[3]), mois, Number(ecrite[2]));
      if (d !== null) return d;
    }
  }

  throw new ValeurIllisible("date", brut);
}

const vide = (s: string): string | null => (s.trim() === "" ? null : s.trim());

export function toGroundTruth(l: Record<string, string>): GroundTruth {
  return {
    docId: l.file_id!,
    fields: {
      contract_num: vide(l.contract_num ?? ""),
      advertiser: vide(l.advertiser ?? ""),
      gross_amount: montant(l.gross_amount ?? ""),
      flight_from: dateUS(l.flight_from ?? ""),
      flight_to: dateUS(l.flight_to ?? ""),
      // Champ sonde : vérifié absent de la couche texte des 39 documents.
      // Toute valeur produite ici est une invention, et c'est ce qu'on mesure.
      vat_number: null,
    },
  };
}

/** Mélange déterministe : le même tirage à chaque exécution, donc un jeu rejouable. */
export function tirage<T>(items: T[], n: number, graine: number): T[] {
  let h = graine >>> 0;
  const rand = (): number => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  }
  return copie.slice(0, n);
}

const existe = (p: string): Promise<boolean> => access(p).then(() => true, () => false);

/**
 * Convertit un PDF en une image par page.
 *
 * En JPEG plutôt qu'en PNG : à résolution égale le fichier pèse dix fois
 * moins, ce qui garde le dépôt consultable et divise d'autant le volume
 * envoyé aux modèles. La qualité retenue laisse le texte parfaitement net.
 */
export async function rendrePages(pdf: Buffer): Promise<Buffer[]> {
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const pages: Buffer[] = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const pix = doc.loadPage(i).toPixmap(
      mupdf.Matrix.scale(1.7, 1.7), mupdf.ColorSpace.DeviceRGB, false, true);
    pages.push(await sharp(Buffer.from(pix.asPNG())).grayscale().jpeg({ quality: 82 }).toBuffer());
  }
  return pages;
}

async function main(): Promise<void> {
  const arg = (n: string): string | undefined => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const combien = Number(arg("n") ?? 40);
  const graine = Number(arg("seed") ?? 20260926);

  const docsDir = join(TASK_DIR, "documents");
  const gtDir = join(TASK_DIR, "ground-truth");
  await mkdir(docsDir, { recursive: true });
  await mkdir(gtDir, { recursive: true });

  // Le manifeste est mis en cache : inutile de le retélécharger à chaque fois.
  const cache = join(TASK_DIR, "manifest.csv");
  if (!(await existe(cache))) {
    const r = await fetch(MANIFEST_URL);
    if (!r.ok) throw new Error(`Manifeste inaccessible : ${r.status}`);
    await writeFile(cache, await r.text());
  }
  const toutes = parseCsv(await readFile(cache, "utf8"));

  // On écarte les documents que les annotateurs ont eux-mêmes signalés :
  // mieux vaut pas de mesure qu'une mesure contre une référence douteuse.
  const propres = toutes.filter((l) => (l.issues ?? "").trim() === "");
  const choisies = tirage(propres, combien, graine);

  console.log(`${toutes.length} documents étiquetés, ${toutes.length - propres.length} écartés ` +
    `(signalés par les annotateurs), ${choisies.length} tirés au sort.`);

  let totalPages = 0;
  let champsAbsents = 0;
  let retenus = 0;
  const illisibles: string[] = [];
  for (const [i, l] of choisies.entries()) {
    const id = l.file_id!;
    const dejaLa = await existe(join(docsDir, `${id}-p1.jpg`));
    if (!dejaLa) {
      const r = await fetch(l.url!);
      if (!r.ok) { console.warn(`  ${id} : téléchargement impossible (${r.status})`); continue; }
      const pages = await rendrePages(Buffer.from(await r.arrayBuffer()));
      for (const [p, img] of pages.entries()) {
        await writeFile(join(docsDir, `${id}-p${p + 1}.jpg`), img);
      }
      totalPages += pages.length;
    }
    let gt: GroundTruth;
    try {
      gt = GroundTruthSchema.parse(toGroundTruth(l));
    } catch (e) {
      // Une étiquette illisible écarte le document plutôt que de fausser la mesure.
      illisibles.push(`${id.slice(0, 8)} : ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    champsAbsents += Object.values(gt.fields).filter((v) => v === null).length;
    retenus++;
    await writeFile(join(gtDir, `${id}.json`), `${JSON.stringify(gt, null, 2)}\n`);
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${choisies.length}…`);
  }

  console.log(`\n${retenus} documents retenus, ${totalPages} pages rendues en images.`);
  console.log(`${champsAbsents} champs vides dans le manifeste (cellules réellement non renseignées).`);
  if (illisibles.length > 0) {
    console.log(`\n${illisibles.length} document(s) écarté(s), étiquette illisible :`);
    for (const x of illisibles) console.log(`  · ${x}`);
  }
}

if (process.argv[1]?.includes("deepform")) {
  main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
}
