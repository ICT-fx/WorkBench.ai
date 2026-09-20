import type { LeaderboardRow } from "@hub/schema";
import { fill, href, tr, type Dictionary, type Locale } from "@/i18n";
import { duration, num, pct, usd } from "@/lib/format";
import type { ModelScore } from "@/lib/hub";
import { readsDocuments, standing } from "@/lib/models";
import type { Site } from "@/lib/site";
import { hasIcon } from "@/components/ui/Icon";
import type { BenchmarkGroup, BenchmarkLine, MetricCell, MetricId } from "./BenchmarkResults";

/** Espace insécable : un rang « 4 / 39 » ne se coupe pas en fin de ligne. */
const ESPACE = "\u00a0";

/**
 * Les résultats d'un modèle, benchmark par benchmark, regroupés par métier et
 * prêts à afficher : le composant client ne reçoit que des textes et des
 * longueurs de barre, jamais un classement entier.
 */
export function benchmarkGroups(
  score: ModelScore,
  { domains, benchmarks, leaderboards }: Pick<Site, "domains" | "benchmarks" | "leaderboards">,
  lang: Locale,
  dict: Dictionary,
): BenchmarkGroup[] {
  const aveugle = !readsDocuments(score.model.modalities);

  const rang = (r: { rank: number; of: number }): MetricCell["rank"] => ({
    text: `${r.rank}${ESPACE}/${ESPACE}${r.of}`,
    spoken: fill(dict.models.results.rankSr, r),
  });

  const cellules = (row: LeaderboardRow, rows: LeaderboardRow[], benchmarkId: string): Record<MetricId, MetricCell> => {
    // Un coût ou un temps nul veut dire « inconnu », pas « gratuit » : il ne se classe pas.
    const couts = rows.map((r) => r.costPerDoc).filter((c) => c > 0);
    const temps = rows.map((r) => r.latencyP50).filter((l) => l > 0);
    const exactitude = score.ranks[benchmarkId];
    return {
      exactitude: {
        value: pct(row.exactitude, lang),
        detail: row.ci === undefined ? undefined : `±${ESPACE}${num(row.ci, lang)}`,
        ratio: row.exactitude / 100,
        rank: exactitude === undefined ? null : rang(exactitude),
      },
      // Coût et latence n'ont pas d'échelle naturelle : la barre se lit par
      // rapport au modèle le plus cher, ou le plus lent, du même benchmark.
      cost: row.costPerDoc > 0
        ? { value: usd(row.costPerDoc, lang), ratio: row.costPerDoc / Math.max(...couts), rank: rang(standing(couts, row.costPerDoc, "croissant")) }
        : { value: usd(null, lang), ratio: 0, rank: null },
      latency: row.latencyP50 > 0
        ? { value: duration(row.latencyP50, lang), ratio: row.latencyP50 / Math.max(...temps), rank: rang(standing(temps, row.latencyP50, "croissant")) }
        : { value: duration(null, lang), ratio: 0, rank: null },
      hallucinations: {
        value: pct(row.hallucinations, lang),
        ratio: row.hallucinations / 100,
        rank: rang(standing(rows.map((r) => r.hallucinations), row.hallucinations, "croissant")),
      },
    };
  };

  return domains.flatMap((domain): BenchmarkGroup[] => {
    const lines = benchmarks.filter((b) => b.domain === domain.id).flatMap((b): BenchmarkLine[] => {
      const classement = leaderboards.get(b.id);
      // Un benchmark sans classement publié n'a rien à montrer, pour aucun modèle.
      if (classement === undefined) return [];
      const base = { id: b.id, label: tr(b.label, lang), href: href(lang, `/benchmarks/${b.id}`) };
      const row = score.byBenchmark[b.id];
      if (row === undefined) {
        return [{ ...base, cells: null, reason: b.input === "document" && aveugle ? dict.common.labels.textOnly : undefined }];
      }
      return [{ ...base, cells: cellules(row, classement.rows, b.id) }];
    });
    if (lines.length === 0) return [];
    return [{ id: domain.id, label: tr(domain.label, lang), icon: hasIcon(domain.icon) ? domain.icon : "indice", lines }];
  });
}
