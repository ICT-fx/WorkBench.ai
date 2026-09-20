/**
 * Synchronise le catalogue des modèles avec l'AI Gateway.
 *
 * La sélection des modèles est éditoriale (`data/catalogue/models.seed.json` :
 * nom, labo, date de sortie, statut des poids). Tout ce qui se périme — prix,
 * fenêtre de contexte, modalités — vient du catalogue public de l'AI Gateway,
 * sans clé d'API. Un modèle absent du catalogue garde des champs `null` : le
 * site affiche « non communiqué » plutôt qu'un chiffre recopié de mémoire.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ModelCatalogueSchema, ModalitySchema, type Model, type Modality } from "@hub/schema";
import { DATA_ROOT } from "./load";

const CATALOGUE_URL = "https://ai-gateway.vercel.sh/v1/models";

const SeedSchema = z.array(z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lab: z.string().min(1),
  released: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weights: z.enum(["ouverts", "fermes"]).nullable(),
}));

type GatewayModel = {
  id: string;
  context_window?: number;
  max_tokens?: number;
  tags?: string[];
  modalities?: { input?: string[] };
  pricing?: { input?: string; output?: string };
};

const perMillion = (perToken: string | undefined): number | null => {
  const n = Number(perToken);
  // Arrondi à 4 décimales : les tarifs publics n'en portent jamais plus, et la
  // multiplication flottante produirait sinon des 0.30000000000000004.
  return perToken === undefined || Number.isNaN(n) ? null : Math.round(n * 1e6 * 1e4) / 1e4;
};

export function mergeSeed(
  seed: z.infer<typeof SeedSchema>,
  gateway: GatewayModel[],
): { models: Model[]; absents: string[] } {
  const byId = new Map(gateway.map((m) => [m.id, m]));
  const absents: string[] = [];

  const models = seed.map((s): Model => {
    const g = byId.get(s.id);
    if (g === undefined) absents.push(s.id);

    const modalities = (g?.modalities?.input ?? ["text"])
      .filter((m): m is Modality => ModalitySchema.safeParse(m).success);

    return {
      ...s,
      contextWindow: g?.context_window ?? null,
      maxOutput: g?.max_tokens ?? null,
      priceIn: perMillion(g?.pricing?.input),
      priceOut: perMillion(g?.pricing?.output),
      modalities: modalities.length > 0 ? modalities : ["text"],
      reasoning: (g?.tags ?? []).includes("reasoning"),
    };
  });

  return { models, absents };
}

async function main(): Promise<void> {
  const from = process.argv.indexOf("--from");
  const payload: unknown = from >= 0
    ? JSON.parse(await readFile(process.argv[from + 1]!, "utf8"))
    : await fetch(CATALOGUE_URL).then((r) => {
        if (!r.ok) throw new Error(`Catalogue AI Gateway inaccessible : ${r.status} ${r.statusText}`);
        return r.json();
      });

  const dir = join(DATA_ROOT, "catalogue");
  const seed = SeedSchema.parse(JSON.parse(await readFile(join(dir, "models.seed.json"), "utf8")));
  const { models, absents } = mergeSeed(seed, (payload as { data?: GatewayModel[] }).data ?? []);

  const catalogue = ModelCatalogueSchema.parse({
    syncedAt: new Date().toISOString().slice(0, 10),
    source: CATALOGUE_URL,
    models,
  });
  await writeFile(join(dir, "models.json"), `${JSON.stringify(catalogue, null, 2)}\n`);

  console.log(`${models.length} modèles synchronisés → ${join(dir, "models.json")}`);
  if (absents.length > 0) {
    console.log(`Absents du catalogue (prix et contexte non communiqués) :\n  · ${absents.join("\n  · ")}`);
  }
}

// Exécuté seulement en ligne de commande : les tests importent `mergeSeed` sans effet de bord.
if (process.argv[1]?.endsWith("catalogue-sync.ts")) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
