/**
 * Les 27 modèles du hub, identifiants OpenRouter. Liste unique : c'est elle que
 * le run appelle, que `key:check` vérifie, et qu'il faut tenir à jour avec
 * `data/catalogue/models.seed.json`.
 *
 * Quatre groupes : ce que l'IA sait faire de mieux prix mis de côté, le bon
 * rapport qualité-prix, la souveraineté et l'auto-hébergement, et le volume au
 * coût le plus bas. Voir docs/2026-09-24-modeles-benchmarks-roadmap.md.
 *
 * Les alias sont résolus contre le catalogue d'OpenRouter au lancement : si l'un
 * d'eux disparaît, le run s'arrête au lieu de publier un classement amputé.
 */
export const HUB_MODELS = [
  "anthropic/claude-fable-5.1", "openai/gpt-6-astra", "qwen/qwen3.8-max-prime",
  "moonshotai/kimi-k3", "anthropic/claude-opus-5.5", "x-ai/grok-4.7",
  "openai/gpt-6-sol", "anthropic/claude-sonnet-5", "qwen/qwen3.8-max-0902",
  "meta/muse-spark-1.3", "moonshotai/kimi-k2.6", "amazon/nova-pro-v1",
  "google/gemini-3.8-flash", "cohere/command-a-plus",
  "mistralai/mistral-medium-3-5", "mistralai/mistral-large-2512", "qwen/qwen3.8-27b",
  "meta-llama/llama-4-maverick", "mistralai/mistral-small-2603",
  "mistralai/ministral-8b-2512", "google/gemma-4-31b-it",
  "deepseek/deepseek-v4.1-flash", "google/gemini-3.5-flash-lite", "openai/gpt-6-luna",
  "amazon/nova-lite-v1", "z-ai/glm-5.3-flash", "qwen/qwen3.7-flash",
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

const CATALOGUE_URL = "https://openrouter.ai/api/v1/models";

type RawModel = {
  id: string;
  name?: string;
  type?: string;
  /** Forme de la passerelle Vercel. */
  modalities?: { input?: string[] };
  /** Forme d'OpenRouter. */
  architecture?: { input_modalities?: string[] };
  pricing?: { input?: string; output?: string; prompt?: string; completion?: string };
};

export function parseCatalogue(payload: unknown): Catalogue {
  const data = (payload as { data?: RawModel[] }).data ?? [];
  const catalogue: Catalogue = new Map();
  for (const m of data) {
    // Le champ `type` n'existe que chez Vercel ; chez OpenRouter tout est un
    // modèle de langage. On accepte les deux formes de catalogue.
    if (m.type !== undefined && m.type !== "language") continue;
    const entrees = m.architecture?.input_modalities ?? m.modalities?.input ?? [];
    catalogue.set(m.id, {
      id: m.id,
      name: m.name ?? m.id,
      inputPrice: Number(m.pricing?.prompt ?? m.pricing?.input ?? 0),
      outputPrice: Number(m.pricing?.completion ?? m.pricing?.output ?? 0),
      acceptsImages: entrees.includes("image"),
    });
  }
  return catalogue;
}

export async function fetchCatalogue(url: string = CATALOGUE_URL): Promise<Catalogue> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalogue des modèles inaccessible : ${response.status} ${response.statusText}`);
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
