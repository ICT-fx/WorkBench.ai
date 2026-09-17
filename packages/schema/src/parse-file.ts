import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { z } from "zod";

function describe(error: unknown, path: string): Error {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as z.ZodError).issues
      .map((i) => `  · ${i.path.join(".") || "(racine)"} : ${i.message}`)
      .join("\n");
    return new Error(`Fichier invalide : ${path}\n${issues}`);
  }
  return new Error(`Fichier illisible : ${path}\n  · ${String(error)}`);
}

/** Lit un JSON et le valide. Échoue en nommant le fichier et le champ fautif. */
export async function parseFile<T>(schema: z.ZodType<T>, path: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    throw describe(e, path);
  }
  try {
    return schema.parse(JSON.parse(raw));
  } catch (e) {
    throw describe(e, path);
  }
}

/** Variante synchrone, pour le build du site. */
export function parseFileSync<T>(schema: z.ZodType<T>, path: string): T {
  try {
    return schema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (e) {
    throw describe(e, path);
  }
}
