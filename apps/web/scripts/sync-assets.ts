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
import { LeaderboardSchema, DocScoreSchema } from "@hub/schema";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { documentsClivants } from "../src/lib/exemples";

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
  const fichiers = leaderboard.runId.split("+")
    .map((run) => join(repo, "data", "runs", run, "scores.json"))
    .filter((f) => existsSync(f));
  if (!existsSync(documents) || fichiers.length === 0) continue;

  const clivants = documentsClivants(
    fichiers.flatMap((f) => z.array(DocScoreSchema).parse(JSON.parse(readFileSync(f, "utf8")))),
  );
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
