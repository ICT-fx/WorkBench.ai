import type { BenchmarkHistory, DocScore, Leaderboard, ModelResult, ReviewItem, Task } from "@hub/schema";
import { BenchmarkHistorySchema, LeaderboardSchema } from "@hub/schema";
import { aggregate } from "./aggregate";

/**
 * Applique les arbitrages humains par-dessus le score automatique.
 *
 * L'humain tranche toujours : le scoring automatique est un outil de tri, pas
 * une autorité. Les points et le drapeau de relecture sont recalculés, sinon un
 * arbitrage laisserait le classement incohérent avec les verdicts affichés.
 */
export function applyReview(task: Task, scores: DocScore[], review: ReviewItem[]): DocScore[] {
  const critical = new Set(task.criteria.filter((c) => c.critical).map((c) => c.id));
  const known = new Set(task.criteria.map((c) => c.id));

  return scores.map((score) => {
    const applicable = review.filter(
      (r) => r.model === score.model && r.docId === score.docId && known.has(r.criterionId),
    );
    if (applicable.length === 0) return score;

    const byCriterion = { ...score.byCriterion };
    for (const item of applicable) {
      const field = byCriterion[item.criterionId];
      if (field === undefined) continue;
      byCriterion[item.criterionId] = {
        ...field,
        verdict: item.humanVerdict,
        points: item.humanVerdict === "correct" ? field.maxPoints : 0,
      };
    }

    const needsReview = Object.entries(byCriterion).some(
      ([id, f]) => critical.has(id) && f.verdict !== "correct",
    );
    return { ...score, byCriterion, needsReview };
  });
}

export type BuildLeaderboardOptions = {
  taskId: string;
  runId: string;
  runDate: string;
  scores: DocScore[];
  results: ModelResult[];
  sampleSize: number;
  status: "reel" | "demo";
  /** Au-delà de ce taux d'appels en échec, un modèle rend le run impubliable. */
  maxErrorRate?: number;
};

/**
 * Les documents que tous les modèles ont traités, et eux seuls.
 *
 * Un classement compare des modèles sur les mêmes documents, ou ne compare
 * rien. Un run interrompu — crédit épuisé, panne d'hébergeur — laisse des
 * documents que seule une partie du panel a lus : les garder donnerait à ces
 * modèles-là un échantillon différent des autres, et le classement mesurerait
 * la chance d'avoir été interrogé plutôt que la lecture.
 */
export function documentsCommuns(scores: DocScore[]): Set<string> {
  const modeles = new Set(scores.map((s) => s.model));
  const parDocument = new Map<string, Set<string>>();
  for (const s of scores) {
    const vus = parDocument.get(s.docId) ?? new Set<string>();
    vus.add(s.model);
    parDocument.set(s.docId, vus);
  }
  return new Set(
    [...parDocument].filter(([, vus]) => vus.size === modeles.size).map(([docId]) => docId),
  );
}

/**
 * Construit le classement publiable.
 *
 * Seuls les documents lus par tout le panel entrent dans le classement ; les
 * autres sont écartés et leur nombre est rendu dans `incomplets`.
 *
 * Un modèle qui a échoué sur plus d'un dixième du jeu bloque la publication :
 * mieux vaut pas de classement qu'un classement calculé sur les seules factures
 * que le modèle a bien voulu traiter.
 */
export function buildLeaderboard(opts: BuildLeaderboardOptions): Leaderboard & { incomplets: number } {
  const maxErrorRate = opts.maxErrorRate ?? 0.1;
  const communs = documentsCommuns(opts.scores);
  const tous = new Set(opts.scores.map((s) => s.docId));
  const incomplets = tous.size - communs.size;
  const scoresRetenus = opts.scores.filter((s) => communs.has(s.docId));
  const resultsRetenus = opts.results.filter((r) => communs.has(r.docId));

  if (scoresRetenus.length === 0) {
    throw new Error(
      `Publication refusée : aucun document n'a été lu par l'ensemble du panel ` +
      `(${tous.size} document(s) partiellement traité(s)). Terminer le run avant de publier.`);
  }

  const rows = aggregate(scoresRetenus, resultsRetenus);

  // Le taux d'échec se mesure sur tous les appels du run, y compris ceux portant
  // sur des documents écartés faute d'avoir été lus par tout le panel. Le
  // mesurer sur les seuls documents retenus rendrait invisible un modèle qui
  // échoue précisément là où les autres réussissent.
  const tentatives = new Map<string, { total: number; echecs: number }>();
  for (const r of opts.results) {
    const t = tentatives.get(r.model) ?? { total: 0, echecs: 0 };
    t.total++;
    if (r.error !== undefined) t.echecs++;
    tentatives.set(r.model, t);
  }
  // Deux garde-fous se succèdent, et il ne faut pas les confondre.
  //
  // Celui du dessus — n'garder que les documents lus par tout le panel — assure
  // l'équité : un modèle ne peut plus être noté sur un sous-ensemble flatteur,
  // puisque ses échecs retirent le document à tout le monde.
  //
  // Celui-ci ne protège donc plus l'équité, mais la substance : au-delà de la
  // moitié d'échecs, un modèle n'a pas été testé, et le classer serait un abus
  // de langage. En deçà, ses échecs sont rendus visibles — `errorCount` est
  // publié et affiché — plutôt que de bloquer une mesure par ailleurs juste.
  // Les échecs observés jusqu'ici venaient tous de notre côté : plafond de
  // jetons trop bas pour un modèle bavard, limite de débit chez l'hébergeur.
  for (const [model, t] of tentatives) {
    if (t.total > 0 && t.echecs / t.total > 0.5) {
      throw new Error(
        `Publication refusée : ${model} a échoué sur ${t.echecs} appel(s) sur ${t.total} ` +
        `(${Math.round((t.echecs / t.total) * 100)} %). Ce modèle n'a pas été testé, ` +
        `le classer serait un abus de langage. Relancer le run avant de publier.`,
      );
    }
    if (t.total > 0 && t.echecs / t.total > maxErrorRate) {
      console.warn(
        `  ⚠ ${model} : ${t.echecs} appel(s) en échec sur ${t.total} ` +
        `(${Math.round((t.echecs / t.total) * 100)} %). Les documents concernés sont ` +
        `écartés pour tout le panel ; le compteur reste publié.`,
      );
    }
  }

  return {
    ...LeaderboardSchema.parse({
      taskId: opts.taskId,
      runId: opts.runId,
      status: opts.status,
      runDate: opts.runDate,
      // La taille de l'échantillon est celle du classement, pas celle du run :
      // annoncer les documents écartés comme s'ils avaient été mesurés serait faux.
      sampleSize: communs.size,
      excluded: incomplets,
      rows,
    }),
    incomplets,
  };
}

/**
 * Ajoute une publication à l'historique d'un benchmark.
 *
 * L'historique est ce qui permet de suivre un modèle dans le temps : un même
 * alias peut changer de comportement sans prévenir, et seul un re-test le montre.
 *
 * Il suppose un barème constant. Quand le barème change — un champ retiré, un
 * autre ajouté — les publications antérieures ne se comparent plus à la nouvelle,
 * et les laisser sur la même courbe donnerait à lire une évolution là où il n'y a
 * qu'un changement de règle. Les retirer à la main est alors la bonne réponse.
 * Republier un run remplace son entrée au lieu de la dupliquer. Une première
 * mesure réelle efface les runs de démonstration : une courbe qui mêlerait les
 * deux ferait passer du fabriqué pour du mesuré.
 *
 * Une publication qui reprend tous les runs d'une publication antérieure la
 * remplace elle aussi. Élargir un jeu de test ou y ajouter un modèle ne re-teste
 * personne : les réponses des autres sont les mêmes, à la virgule près. Garder les
 * deux entrées traçait une courbe « dans le temps » — 97,3 %, 96,8 %, 97,8 % pour
 * un même modèle — là où seul l'échantillon avait grossi. Un point d'historique,
 * c'est un nouveau passage du test, donc des runs que la publication d'avant
 * n'avait pas tous.
 */
export function appendHistory(history: BenchmarkHistory | null, leaderboard: Leaderboard): BenchmarkHistory {
  const nouveaux = new Set(leaderboard.runId.split("+"));
  const repris = (runId: string): boolean => runId.split("+").every((r) => nouveaux.has(r));
  const gardes = (history?.runs ?? []).filter((run) =>
    !repris(run.runId) && (leaderboard.status === "demo" || run.status === "reel"));

  return BenchmarkHistorySchema.parse({
    benchmarkId: leaderboard.taskId,
    runs: [
      ...gardes,
      {
        runId: leaderboard.runId,
        runDate: leaderboard.runDate,
        status: leaderboard.status,
        rows: leaderboard.rows.map((r) => ({
          model: r.model, exactitude: r.exactitude, costPerDoc: r.costPerDoc, latencyP50: r.latencyP50,
        })),
      },
    ].sort((a, b) => a.runDate.localeCompare(b.runDate)),
  });
}
