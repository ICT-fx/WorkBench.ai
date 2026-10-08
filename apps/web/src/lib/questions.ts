import type { DocScore } from "@hub/schema";

/**
 * Les questions d'une tâche qui en pose une par document.
 *
 * Module pur, sans accès disque : le tableau affiché par le site et le calcul des
 * comptes ne peuvent pas diverger, et les comptes viennent des notations du run,
 * jamais d'un recalcul.
 */

export type QuestionPosee = {
  docId: string;
  societe: string;
  rapport: string;
  /** Les pages du rapport montrées au modèle, numérotées comme dans un lecteur de PDF. */
  pages: string;
  question: string;
  /** Le critère que cette question pose, et lui seul. */
  sousTache: string;
  /** L'adresse du rapport d'origine, chez celui qui le publie. */
  url: string;
};

/**
 * Lit les lignes d'un manifeste. Une tâche dont le manifeste n'a pas de colonne
 * `question` — les factures, qui reçoivent toutes le même prompt — n'en a aucune.
 */
export function lireQuestions(lignes: Record<string, string>[]): QuestionPosee[] {
  return lignes.flatMap((l) => {
    const { file_id, question, sous_tache } = l;
    if (file_id === undefined || question === undefined || question === "" || sous_tache === undefined) return [];
    return [{
      docId: file_id, question, sousTache: sous_tache,
      societe: l.societe ?? "", rapport: l.rapport ?? "", pages: l.pages ?? "", url: l.url ?? "",
    }];
  });
}

/**
 * - `classee` : les 27 modèles sont notés, la question compte dans le classement. Un
 *   modèle qui n'a rien rendu d'exploitable y est noté « manquant », et seulement lui.
 * - `hors-classement` : un modèle au moins n'est pas noté, sans que l'échec lui soit
 *   imputé. Un classement compare des modèles sur les mêmes questions, donc la question
 *   sort pour tout le monde.
 * - `ecartee` : écartée après le run, avec son motif ; ses réponses restent consultables.
 */
export type StatutQuestion = "classee" | "hors-classement" | "ecartee";

export type LigneQuestion = QuestionPosee & {
  statut: StatutQuestion;
  /** Modèles notés sur cette question. */
  models: number;
  /** Modèles qui l'ont réussie. */
  corrects: number;
  /** Modèles qui ont inventé une réponse là où il n'y en avait aucune. */
  hallucinations: number;
  motif?: string;
  /** Les modèles qui n'ont rien rendu d'exploitable, et pourquoi : comptés « manquant » pour eux seuls. */
  imputes: { model: string; motif: string }[];
};

const RANG: Record<StatutQuestion, number> = { classee: 0, "hors-classement": 1, ecartee: 2 };

/**
 * Chaque question avec ce que le panel en a fait : les classées d'abord, de la plus
 * disputée à la plus consensuelle, puis celles qui sont sorties du classement.
 */
export function lignesQuestions(
  questions: QuestionPosee[], scores: DocScore[], panel: number, exclusions: ReadonlyMap<string, string>,
  imputes: { model: string; docId: string; motif: string }[] = [],
): LigneQuestion[] {
  const parQuestion = new Map<string, DocScore[]>();
  for (const s of scores) parQuestion.set(s.docId, [...(parQuestion.get(s.docId) ?? []), s]);

  return questions.map((q): LigneQuestion => {
    const notes = (parQuestion.get(q.docId) ?? []).map((s) => s.byCriterion[q.sousTache]?.verdict);
    const motif = exclusions.get(q.docId);
    const statut: StatutQuestion = motif !== undefined ? "ecartee" : notes.length < panel ? "hors-classement" : "classee";
    return {
      ...q, statut, models: notes.length,
      corrects: notes.filter((v) => v === "correct").length,
      hallucinations: notes.filter((v) => v === "hallucine").length,
      imputes: imputes.filter((e) => e.docId === q.docId).map((e) => ({ model: e.model, motif: e.motif })),
      ...(motif === undefined ? {} : { motif }),
    };
  }).sort((a, b) =>
    RANG[a.statut] - RANG[b.statut]
    || (b.models - b.corrects) - (a.models - a.corrects)
    // L'identifiant tranche : l'ordre doit être le même d'un build à l'autre.
    || a.docId.localeCompare(b.docId));
}
