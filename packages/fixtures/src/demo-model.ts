/**
 * Le modèle qui fabrique les scores de DÉMONSTRATION du hub.
 *
 * Aucun chiffre produit ici n'est une mesure. Pour ne pas glisser d'opinion sur
 * tel ou tel labo dans des données factices, le niveau d'un modèle est déduit de
 * deux faits publics — son prix et sa date de sortie — puis brouillé par un aléa
 * déterministe. Le classement qui en sort ressemble à un vrai classement, ce qui
 * suffit pour construire le site, et ne prétend rien de plus.
 */
import type { Benchmark, HistoryRun, LeaderboardRow, Model } from "@hub/schema";

/** Générateur pseudo-aléatoire à graine textuelle : même graine, mêmes données. */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aléa centré, à peu près gaussien, d'écart-type `sigma`. */
const gauss = (seed: string, sigma: number): number => {
  const r = rng(seed);
  return ((r() + r() + r() + r()) / 4 - 0.5) * 2 * Math.sqrt(3) * sigma;
};

const uniform = (seed: string, min: number, max: number): number => min + rng(seed)() * (max - min);

const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
const round1 = (x: number): number => Math.round(x * 10) / 10;

const monthsBetween = (from: string, to: string): number =>
  (Date.parse(to) - Date.parse(from)) / (30.44 * 24 * 3600 * 1000);

/** Prix d'entrée ramené sur [0, 1], en échelle logarithmique. */
const prixNormalise = (m: Model): number => {
  const p = Math.log10(clamp(m.priceIn ?? 0.8, 0.03, 12));
  return (p - Math.log10(0.03)) / (Math.log10(12) - Math.log10(0.03));
};

/** Niveau latent d'un modèle : plus cher et plus récent, donc meilleur — en moyenne. */
export function niveau(m: Model): number {
  const recence = clamp(monthsBetween("2025-04-01", m.released) / 17, 0, 1);
  return 46 + 22 * prixNormalise(m) + 16 * recence + gauss(`niveau:${m.id}`, 4);
}

/** Un benchmark « document » exige de savoir lire une image ou un PDF. */
export const peutPasser = (m: Model, b: Benchmark): boolean =>
  b.input === "texte" || m.modalities.includes("image") || m.modalities.includes("pdf");

function exactitude(m: Model, b: Benchmark, runDate: string, dernier: boolean): number {
  const difficulte = uniform(`difficulte:${b.id}`, -12, 8);
  const affinite = gauss(`affinite:${m.lab}:${b.domain}`, 3.5);
  const propre = gauss(`propre:${m.id}:${b.id}`, 2.5);
  // Les runs passés fluctuent légèrement autour du même niveau : c'est ce que
  // produit un vrai re-test, et ce que le graphique d'évolution doit supporter.
  const bruitRun = dernier ? 0 : gauss(`run:${m.id}:${b.id}:${runDate}`, 1.2);
  return round1(clamp(niveau(m) + difficulte + affinite + propre + bruitRun, 8, 99.2));
}

function cout(m: Model, b: Benchmark): number {
  if (m.priceIn === null || m.priceOut === null) return 0;
  const entree = uniform(`tokens-in:${b.id}`, b.input === "document" ? 2500 : 800, b.input === "document" ? 9000 : 6000);
  const sortie = uniform(`tokens-out:${b.id}`, 300, 2500);
  const verbosite = m.reasoning ? uniform(`verbosite:${m.id}`, 2, 6) : uniform(`verbosite:${m.id}`, 1, 1.5);
  return Math.round(((entree * m.priceIn + sortie * verbosite * m.priceOut) / 1e6) * 1e6) / 1e6;
}

function latence(m: Model, b: Benchmark): number {
  const base = 900 + 2600 * prixNormalise(m);
  const raisonnement = m.reasoning ? uniform(`lenteur:${m.id}`, 1.5, 4) : 1;
  const longueur = uniform(`longueur:${b.id}`, 0.7, 2.2);
  return Math.round(base * raisonnement * longueur * uniform(`latence:${m.id}:${b.id}`, 0.85, 1.15));
}

/** Une ligne de classement complète, pour le dernier run publié. */
export function ligne(m: Model, b: Benchmark, runDate: string): LeaderboardRow {
  const ex = exactitude(m, b, runDate, true);
  // Certains modèles n'inventent presque jamais, d'autres beaucoup : le trait
  // est propre au modèle, pas à son niveau.
  const tendance = rng(`invente:${m.id}`)() < 0.25 ? 0 : uniform(`invente-k:${m.id}`, 0.02, 0.3);
  const hallucinations = round1(clamp((100 - ex) * tendance + gauss(`hallu:${m.id}:${b.id}`, 0.6), 0, 60));
  const sansRelecture = round1(clamp(ex - (100 - ex) * 0.9 - hallucinations * 0.5 + gauss(`relecture:${m.id}:${b.id}`, 2), 0, 100));

  const errorCount = rng(`echec:${m.id}:${b.id}`)() < 0.08 ? 1 + Math.floor(rng(`echec-n:${m.id}:${b.id}`)() * 2) : 0;
  const p = ex / 100;
  // Chaque cas de test porte plusieurs éléments notés : l'échantillon effectif
  // est plus grand que le nombre de documents.
  const notes = b.sampleSize * 4;

  return {
    model: m.id,
    modelVersion: `${m.id.split("/")[1]}@demo`,
    sansRelecture,
    exactitude: ex,
    hallucinations,
    costPerDoc: cout(m, b),
    latencyP50: latence(m, b),
    errorCount,
    docCount: b.sampleSize - errorCount,
    ci: round1(1.96 * Math.sqrt((p * (1 - p)) / notes) * 100),
    bySubtask: Object.fromEntries(b.subtasks.map((s) => [
      s.id,
      round1(clamp(ex + uniform(`sous-tache:${b.id}:${s.id}`, -14, 8) + gauss(`st:${m.id}:${b.id}:${s.id}`, 3), 2, 99.5)),
    ])),
  };
}

/** Une ligne réduite, pour l'historique des runs passés. */
export function ligneHistorique(m: Model, b: Benchmark, runDate: string, dernier: boolean): HistoryRun["rows"][number] {
  return {
    model: m.id,
    exactitude: exactitude(m, b, runDate, dernier),
    costPerDoc: cout(m, b),
    latencyP50: latence(m, b),
  };
}

/** Un run bimestriel depuis l'automne 2025 : six points suffisent à tracer une évolution. */
export const RUN_DATES = ["2025-11-15", "2026-01-15", "2026-03-15", "2026-05-15", "2026-07-15", "2026-09-15"] as const;
export const DERNIER_RUN = RUN_DATES[RUN_DATES.length - 1]!;
export const runIdDemo = (runDate: string, benchmarkId: string): string => `${runDate}_demo-${benchmarkId}`;

/** Les modèles en lice à une date donnée : sortis, et capables de lire ce que le test leur soumet. */
export const enLice = (models: Model[], b: Benchmark, runDate: string): Model[] =>
  models.filter((m) => m.released <= runDate && peutPasser(m, b));
