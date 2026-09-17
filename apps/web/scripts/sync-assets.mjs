// Copie les documents de test dans public/ pour que le site puisse les afficher.
// Une copie plutôt qu'un lien symbolique : le tracing de fichiers de Next suit
// mal les liens, et un déploiement à moitié dépourvu d'images est un bug sournois.
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const web = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = join(web, "..", "..");
const from = join(repo, "data", "tasks", "facture-fr", "documents");
const to = join(web, "public", "documents", "facture-fr");

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`documents synchronisés → ${to}`);
