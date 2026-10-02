import type { Benchmark, Leaderboard, LeaderboardRow } from "@hub/schema";
import { fill, tr, type Dictionary, type Locale } from "@/i18n";
import { bestValue, indistinguishable } from "./hub";
import { num, pct, usd } from "./format";

/**
 * Les phrases « À retenir » d'un benchmark, écrites à partir du classement. Rien
 * n'y est rédigé à la main : une phrase qui ne découle pas des chiffres n'a pas
 * sa place sous un tableau de chiffres.
 */
export function takeaways(opts: {
  benchmark: Benchmark;
  leaderboard: Leaderboard;
  names: Map<string, string>;
  /** Modèles du catalogue écartés parce qu'ils ne lisent pas les documents. */
  excluded: number;
  locale: Locale;
  dict: Dictionary;
}): string[] {
  const { benchmark, leaderboard, names, excluded, locale, dict } = opts;
  const t = dict.benchmarks.detail.takeaway;
  const rows = [...leaderboard.rows].sort((a, b) => b.exactitude - a.exactitude);
  const [first, second, third] = rows;
  if (first === undefined || second === undefined) return [];

  const nom = (r: LeaderboardRow): string => names.get(r.model) ?? r.model;
  const unit = tr(benchmark.unit, locale);
  const out: string[] = [];

  out.push(third === undefined
    ? fill(t.leaderTwo, { first: nom(first), score: pct(first.exactitude, locale), second: nom(second), score2: pct(second.exactitude, locale) })
    : fill(t.leader, {
        first: nom(first), score: pct(first.exactitude, locale),
        second: nom(second), score2: pct(second.exactitude, locale),
        third: nom(third), score3: pct(third.exactitude, locale),
      }));

  if (indistinguishable(first, second)) out.push(fill(t.tie, { first: nom(first), second: nom(second) }));

  const affaire = bestValue(rows);
  if (affaire !== null && first.costPerDoc > 0) {
    out.push(affaire.model === first.model
      ? t.valueSame
      : fill(t.value, {
          model: nom(affaire), gap: num(first.exactitude - affaire.exactitude, locale), cost: usd(affaire.costPerDoc, locale), unit,
          ratio: num(first.costPerDoc / affaire.costPerDoc, locale, first.costPerDoc / affaire.costPerDoc >= 10 ? 0 : 1),
        }));
  }

  const sages = rows.filter((r) => r.hallucinations === 0).length;
  if (sages > 0) out.push(fill(t.hallucinationsNone, { n: sages, total: rows.length }));
  const pire = rows.reduce((a, b) => (b.hallucinations > a.hallucinations ? b : a));
  if (pire.hallucinations >= 5) out.push(fill(t.hallucinationsWorst, { model: nom(pire), rate: pct(pire.hallucinations, locale) }));

  // La sous-tâche la plus dure se lit sur l'ensemble des modèles, pas sur le
  // meilleur : quand plusieurs modèles sont parfaits, le maximum vaut 100 % sur
  // chaque sous-tâche et ne désigne plus rien. La moyenne, elle, départage.
  const moyennes = benchmark.subtasks
    .map((s) => {
      const scores = rows.flatMap((r) => (r.bySubtask?.[s.id] === undefined ? [] : [r.bySubtask[s.id]!]));
      return { s, moyenne: scores.length === 0 ? -1 : scores.reduce((a, b) => a + b, 0) / scores.length };
    })
    .filter((x) => x.moyenne >= 0)
    .sort((a, b) => a.moyenne - b.moyenne);
  const plusDure = moyennes[0];
  // Une sous-tâche que tout le monde réussit n'est la plus dure de rien.
  if (plusDure !== undefined && plusDure.moyenne < 100) {
    out.push(fill(t.hardest, { subtask: tr(plusDure.s.label, locale), score: pct(Math.round(plusDure.moyenne * 10) / 10, locale) }));
  }

  if (excluded > 0) out.push(fill(t.excluded, { n: excluded }));
  return out;
}
