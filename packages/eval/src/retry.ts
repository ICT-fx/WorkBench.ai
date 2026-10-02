/**
 * Reprise des appels qui échouent pour une raison passagère.
 *
 * Un premier run a échoué à 81 % sans qu'aucune de ces erreurs ne vienne du
 * code : crédit momentanément réservé par les appels en cours, quota par
 * minute des comptes récents, hébergeur indisponible. Toutes se règlent en
 * réessayant un peu plus tard.
 */

/** Codes HTTP qui valent la peine d'être réessayés. */
const PASSAGERS = new Set([402, 408, 409, 425, 429, 500, 502, 503, 504]);

export function estPassager(erreur: unknown): boolean {
  if (erreur instanceof HttpError) {
    // Un 402 recouvre deux situations opposées. « Les appels en cours
    // réservent tout le crédit » se règle en attendant qu'ils se terminent.
    // « Le coût maximal de cette requête dépasse le crédit disponible » ne se
    // règlera pas tout seul : il faut recharger. Réessayer huit fois a fait
    // tourner un run une heure à vide.
    if (erreur.status === 402) return !/weight_exceeds_budget|maximum cost exceeds/i.test(erreur.message);
    return PASSAGERS.has(erreur.status);
  }
  // `AbortSignal.timeout` rejette avec un DOMException nommé TimeoutError, dont
  // le message varie selon la version de Node : on reconnaît le nom d'abord.
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "TimeoutError" || nom === "AbortError") return true;
  const m = erreur instanceof Error ? erreur.message : String(erreur);
  // Erreurs réseau et délais dépassés : la requête n'a jamais abouti.
  return /timeout|timed out|aborted|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(m);
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfterMs?: number) {
    super(message);
    this.name = "HttpError";
  }
}

/** Attente croissante, avec une part d'aléatoire pour ne pas resynchroniser les appels. */
export function delai(tentative: number, baseMs = 2000, plafondMs = 60000): number {
  const croissance = Math.min(baseMs * 2 ** tentative, plafondMs);
  return Math.round(croissance * (0.75 + Math.random() * 0.5));
}

export type ReessayerOptions = {
  tentatives?: number;
  baseMs?: number;
  /** Injectable pour les tests : par défaut une vraie attente. */
  dormir?: (ms: number) => Promise<void>;
  /** Appelé avant chaque nouvelle tentative, pour informer. */
  surReprise?: (tentative: number, attenteMs: number, erreur: unknown) => void;
};

/** Rejoue `action` tant que l'erreur est passagère, puis abandonne. */
export async function reessayer<T>(action: () => Promise<T>, opts: ReessayerOptions = {}): Promise<T> {
  const tentatives = opts.tentatives ?? 8;
  const dormir = opts.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  let derniere: unknown;
  for (let i = 0; i < tentatives; i++) {
    try {
      return await action();
    } catch (e) {
      derniere = e;
      if (!estPassager(e) || i === tentatives - 1) throw e;
      // Un « Retry-After » du serveur prime sur notre propre calcul.
      const attente = e instanceof HttpError && e.retryAfterMs !== undefined
        ? e.retryAfterMs
        : delai(i, opts.baseMs);
      opts.surReprise?.(i + 1, attente, e);
      await dormir(attente);
    }
  }
  throw derniere;
}
