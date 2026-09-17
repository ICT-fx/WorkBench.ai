import type { DocScore, FieldScore, ReviewItem, Value } from "@hub/schema";

export type ReviewReason = "hallucination" | "format" | "echantillon";

export type ReviewCandidate = {
  model: string;
  docId: string;
  criterionId: string;
  autoVerdict: FieldScore["verdict"];
  expected: Value | null;
  got: Value | null;
  reason: ReviewReason;
};

export type SelectOptions = {
  seed: number;
  /** Part des champs corrects et identiques soumis au contrôle. */
  sampleRate?: number;
  alreadyDecided?: ReviewItem[];
};

function rng(seed: number): () => number {
  let h = seed >>> 0;
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deux valeurs disent-elles la même chose mais pas de la même façon ? */
const differentWriting = (field: FieldScore): boolean =>
  field.verdict === "correct" &&
  field.expected !== null &&
  field.got !== null &&
  JSON.stringify(field.expected) !== JSON.stringify(field.got);

const key = (x: { model: string; docId: string; criterionId: string }): string =>
  [x.model, x.docId, x.criterionId].join(" :: ");

/**
 * Choisit ce qui mérite un œil humain.
 *
 * Trois motifs, et seulement trois. Les hallucinations, parce qu'elles décident
 * de la métrique la plus lourde du classement. Les écarts d'écriture jugés
 * corrects, parce que c'est là que le comparateur peut être trop indulgent. Et
 * un échantillon de champs jugés corrects à l'identique, qui sert de contrôle :
 * si l'humain y trouve des erreurs, c'est le scoring qu'il faut corriger.
 *
 * Les champs jugés faux ne sont pas présentés : ils ne créent pas de doute.
 */
export function selectForReview(scores: DocScore[], opts: SelectOptions): ReviewCandidate[] {
  const rand = rng(opts.seed);
  const sampleRate = opts.sampleRate ?? 0.1;
  const decided = new Set((opts.alreadyDecided ?? []).map(key));

  const hallucinations: ReviewCandidate[] = [];
  const formats: ReviewCandidate[] = [];
  const echantillon: ReviewCandidate[] = [];

  for (const score of scores) {
    for (const [criterionId, field] of Object.entries(score.byCriterion)) {
      const base = {
        model: score.model, docId: score.docId, criterionId,
        autoVerdict: field.verdict, expected: field.expected, got: field.got,
      };
      if (decided.has(key(base))) continue;

      if (field.verdict === "hallucine") {
        hallucinations.push({ ...base, reason: "hallucination" });
      } else if (differentWriting(field)) {
        formats.push({ ...base, reason: "format" });
      } else if (field.verdict === "correct" && rand() < sampleRate) {
        echantillon.push({ ...base, reason: "echantillon" });
      }
    }
  }

  return [...hallucinations, ...formats, ...echantillon];
}
