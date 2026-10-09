// Copie dans public/ les pages des documents que le site affiche réellement.
//
// Une copie plutôt qu'un lien symbolique : le tracing de fichiers de Next suit
// mal les liens, et un déploiement à moitié dépourvu d'images est un bug sournois.
//
// Seuls les documents montrés sont copiés, pas le jeu de test entier : les
// factures réelles pèsent 58 Mo pour 191 pages, dont le site n'affiche que
// quelques-unes. La sélection vient du même module que la page, pour qu'une
// image affichée ne puisse pas manquer du déploiement.
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { LeaderboardSchema, DocScoreSchema, ReviewItemSchema } from "@hub/schema";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { documentsClivants } from "../src/lib/exemples";
import { appliquerArbitrages } from "../src/lib/arbitrage";

const web = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = join(web, "..", "..");
const publie = join(repo, "data", "published");
const racine = join(web, "public", "documents");

await rm(racine, { recursive: true, force: true });

let copiees = 0;
for (const fichier of await readdir(publie)) {
  if (!fichier.endsWith(".json")) continue;
  const leaderboard = LeaderboardSchema.parse(JSON.parse(readFileSync(join(publie, fichier), "utf8")));
  const documents = join(repo, "data", "tasks", leaderboard.taskId, "documents");
  // Un classement peut porter plusieurs runs, séparés par « + ».
  const runs = leaderboard.runId.split("+")
    .map((run) => join(repo, "data", "runs", run))
    .filter((dir) => existsSync(join(dir, "scores.json")));
  if (!existsSync(documents) || runs.length === 0) continue;

  // Les notes arbitrées, comme la page : un verdict humain peut changer quels
  // documents départagent, et l'image d'un document affiché ne doit pas manquer.
  const lire = <T,>(schema: z.ZodType<T>, f: string): T[] =>
    (existsSync(f) ? z.array(schema).parse(JSON.parse(readFileSync(f, "utf8"))) : []);
  const clivants = documentsClivants(runs.flatMap((dir) =>
    appliquerArbitrages(lire(DocScoreSchema, join(dir, "scores.json")), lire(ReviewItemSchema, join(dir, "review.json")))));
  const attendus = new Set(clivants.map((c) => c.docId));
  const vers = join(racine, leaderboard.taskId);
  await mkdir(vers, { recursive: true });

  for (const page of await readdir(documents)) {
    const docId = page.replace(/(-p\d+)?\.(png|jpe?g)$/i, "");
    if (!attendus.has(docId)) continue;
    await cp(join(documents, page), join(vers, page));
    copiees++;
  }
}

console.log(`${copiees} page(s) de documents synchronisée(s) → ${racine}`);
