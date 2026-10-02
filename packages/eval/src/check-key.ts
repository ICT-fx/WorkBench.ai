/**
 * Vérifie que la clé OpenRouter fonctionne et que les modèles du hub sont
 * tous accessibles. À lancer juste après avoir créé la clé : mieux vaut
 * découvrir un problème ici qu'au milieu d'un run payant.
 */
import { existsSync } from "node:fs";
import { HUB_MODELS } from "./models";


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

  // Le plafond de la clé n'est pas le solde du compte. Confondre les deux a
  // fait dimensionner un run sur 29 $ de marge alors qu'il en restait 0,09 :
  // le run s'est arrêté à mi-chemin, et seuls trois modèles sur vingt-sept
  // avaient fini. C'est le solde qui décide de ce qu'on peut lancer.
  const soldeRep = await fetch(`${BASE}/credits`, { headers: { Authorization: `Bearer ${cle}` } });
  const credits = soldeRep.ok
    ? ((await soldeRep.json()) as { data?: { total_credits?: number; total_usage?: number } }).data
    : undefined;
  const solde = credits?.total_credits !== undefined && credits.total_usage !== undefined
    ? credits.total_credits - credits.total_usage
    : null;

  console.log("Clé valide.");
  if (solde !== null) {
    console.log(`  CRÉDIT DISPONIBLE : ${solde.toFixed(2)} $   ` +
      `(${credits!.total_credits!.toFixed(2)} $ rechargés, ${credits!.total_usage!.toFixed(2)} $ consommés)`);
  } else {
    console.log("  crédit disponible : non communiqué par OpenRouter");
  }
  if (usage !== null) console.log(`  dépensé par cette clé : ${usage.toFixed(2)} $`);
  console.log(limite !== null
    ? `  plafond de la clé : ${limite.toFixed(2)} $ — c'est une limite sur la clé, pas de l'argent disponible`
    : "  plafond de la clé : aucun");

  if (solde !== null && solde < 1) {
    console.log("\n⚠ Crédit épuisé : un run refusera les appels dont le coût maximal dépasse le solde.");
  }

  // 2. Les 27 modèles du hub sont-ils tous au catalogue ?
  const cat = await fetch(`${BASE}/models`);
  const ids = new Set(
    ((await cat.json()) as { data: { id: string }[] }).data.map((m) => m.id),
  );
  const manquants = HUB_MODELS.filter((m) => !ids.has(m));

  console.log(`\n${HUB_MODELS.length - manquants.length}/${HUB_MODELS.length} modèles du hub disponibles.`);
  if (manquants.length > 0) {
    console.log("Absents du catalogue (à remplacer dans la sélection) :");
    for (const m of manquants) console.log(`  · ${m}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
