/**
 * Vérifie que la clé OpenRouter fonctionne et que les modèles du hub sont
 * tous accessibles. À lancer juste après avoir créé la clé : mieux vaut
 * découvrir un problème ici qu'au milieu d'un run payant.
 */
import { existsSync } from "node:fs";

const V1_MODELS = [
  // Ce que l'IA sait faire de mieux
  "anthropic/claude-fable-5.1", "openai/gpt-6-astra", "qwen/qwen3.8-max-prime",
  "moonshotai/kimi-k3", "anthropic/claude-opus-5.5", "x-ai/grok-4.7",
  // Ceux qu'on déploie vraiment
  "openai/gpt-6-sol", "anthropic/claude-sonnet-5", "qwen/qwen3.8-max-0902",
  "meta/muse-spark-1.3", "moonshotai/kimi-k2.6", "amazon/nova-pro-v1",
  "google/gemini-3.8-flash", "cohere/command-a-plus",
  // Souveraineté et auto-hébergement
  "mistralai/mistral-medium-3-5", "mistralai/mistral-large-2512", "qwen/qwen3.8-27b",
  "meta-llama/llama-4-maverick", "mistralai/mistral-small-2603",
  "mistralai/ministral-8b-2512", "google/gemma-4-31b-it",
  // Volume au coût le plus bas
  "deepseek/deepseek-v4.1-flash", "google/gemini-3.5-flash-lite", "openai/gpt-6-luna",
  "amazon/nova-lite-v1", "z-ai/glm-5.3-flash", "qwen/qwen3.7-flash",
] as const;

const BASE = "https://openrouter.ai/api/v1";

/** Charge .env.local sans dépendance : Node sait le faire depuis la 20.6. */
function chargerEnv(): void {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) {
      try { process.loadEnvFile(f); } catch { /* fichier illisible : on continue */ }
    }
  }
}

async function main(): Promise<void> {
  chargerEnv();
  const cle = process.env.OPENROUTER_API_KEY;

  if (cle === undefined || cle.trim() === "" || cle.includes("...")) {
    console.error(
      "Aucune clé OpenRouter trouvée.\n\n" +
      "  1. Créer la clé sur https://openrouter.ai/settings/keys\n" +
      "  2. Créer un fichier .env.local à la racine du projet, contenant :\n" +
      "       OPENROUTER_API_KEY=sk-or-v1-...\n" +
      "  3. Relancer : npm run key:check\n\n" +
      "Le fichier .env.local est déjà exclu de git : la clé ne sera jamais publiée.",
    );
    process.exitCode = 1;
    return;
  }

  // 1. La clé est-elle valide, et que reste-t-il de crédit ?
  const rep = await fetch(`${BASE}/key`, { headers: { Authorization: `Bearer ${cle}` } });
  if (rep.status === 401) {
    console.error("Clé refusée par OpenRouter (401). Vérifier qu'elle a été copiée en entier.");
    process.exitCode = 1;
    return;
  }
  if (!rep.ok) {
    console.error(`OpenRouter a répondu ${rep.status} ${rep.statusText}.`);
    process.exitCode = 1;
    return;
  }

  const info = (await rep.json()) as { data?: Record<string, unknown> };
  const d = info.data ?? {};
  const usage = typeof d.usage === "number" ? d.usage : null;
  const limite = typeof d.limit === "number" ? d.limit : null;

  console.log("Clé valide.");
  if (usage !== null) console.log(`  déjà dépensé : ${usage.toFixed(2)} $`);
  if (limite !== null) console.log(`  plafond : ${limite.toFixed(2)} $`);
  else console.log("  plafond : aucun (le crédit du compte fait foi)");

  // 2. Les 27 modèles du hub sont-ils tous au catalogue ?
  const cat = await fetch(`${BASE}/models`);
  const ids = new Set(
    ((await cat.json()) as { data: { id: string }[] }).data.map((m) => m.id),
  );
  const manquants = V1_MODELS.filter((m) => !ids.has(m));

  console.log(`\n${V1_MODELS.length - manquants.length}/${V1_MODELS.length} modèles du hub disponibles.`);
  if (manquants.length > 0) {
    console.log("Absents du catalogue (à remplacer dans la sélection) :");
    for (const m of manquants) console.log(`  · ${m}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
