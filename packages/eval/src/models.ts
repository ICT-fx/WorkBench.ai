/**
 * Les six modèles de la V1.
 *
 * La sélection couvre les questions que pose réellement une PME :
 * les trois grandes familles propriétaires, un modèle français pour la question
 * de la souveraineté, un modèle ouvert de taille auto-hébergeable pour « et si
 * je ne veux pas que mes factures sortent de chez moi », et un modèle à bas coût
 * pour que la recommandation « meilleur rapport coût/précision » ait un sens.
 *
 * Les alias sont résolus contre le catalogue de l'AI Gateway au lancement : si
 * l'un d'eux disparaît, le run s'arrête au lieu de publier un classement amputé.
 */
export const V1_MODELS = [
  "openai/gpt-6-astra",
  "anthropic/claude-opus-5",
  "google/gemini-3.8-flash",
  "mistral/mistral-large-3",
  "alibaba/qwen3.8-27b",
  "openai/gpt-5.6-luna",
] as const;

export type CatalogueEntry = {
  id: string;
  name: string;
  /** Prix au token, en dollars. */
  inputPrice: number;
  outputPrice: number;
  acceptsImages: boolean;
};

export type Catalogue = Map<string, CatalogueEntry>;

const CATALOGUE_URL = "https://ai-gateway.vercel.sh/v1/models";

type RawModel = {
  id: string;
  name?: string;
  type?: string;
  modalities?: { input?: string[] };
  pricing?: { input?: string; output?: string };
};

export function parseCatalogue(payload: unknown): Catalogue {
  const data = (payload as { data?: RawModel[] }).data ?? [];
  const catalogue: Catalogue = new Map();
  for (const m of data) {
    if (m.type !== "language") continue;
    catalogue.set(m.id, {
      id: m.id,
      name: m.name ?? m.id,
      inputPrice: Number(m.pricing?.input ?? 0),
      outputPrice: Number(m.pricing?.output ?? 0),
      acceptsImages: (m.modalities?.input ?? []).includes("image"),
    });
  }
  return catalogue;
}

export async function fetchCatalogue(url: string = CATALOGUE_URL): Promise<Catalogue> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalogue AI Gateway inaccessible : ${response.status} ${response.statusText}`);
  }
  return parseCatalogue(await response.json());
}

/**
 * Vérifie que chaque modèle demandé existe et sait lire une image.
 * Échouer ici coûte une seconde ; s'en apercevoir après 150 appels coûte de l'argent.
 */
export function assertUsable(catalogue: Catalogue, models: readonly string[]): void {
  const problems: string[] = [];
  for (const alias of models) {
    const entry = catalogue.get(alias);
    if (entry === undefined) problems.push(`${alias} : absent du catalogue`);
    else if (!entry.acceptsImages) problems.push(`${alias} : n'accepte pas les images en entrée`);
  }
  if (problems.length > 0) {
    throw new Error(`Modèles inutilisables :\n  · ${problems.join("\n  · ")}`);
  }
}

/** Coût d'un appel, calculé depuis les tarifs publiés du catalogue. */
export function computeCost(
  entry: CatalogueEntry | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number {
  if (entry === undefined) return 0;
  return (inputTokens ?? 0) * entry.inputPrice + (outputTokens ?? 0) * entry.outputPrice;
}
