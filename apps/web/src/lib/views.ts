import type { Lab, Leaderboard } from "@hub/schema";
import { href, type Locale } from "@/i18n";
import { modelSlug } from "./hub";
import type { Site } from "./site";

/**
 * Les objets que les pages serveur passent aux composants client : minimaux et
 * sérialisables. Un composant client ne lit jamais le disque.
 */

export type LabView = { id: string; name: string; slot?: number; monogram: string };

export const labView = (lab: Lab): LabView =>
  ({ id: lab.id, name: lab.name, slot: lab.slot, monogram: lab.monogram });

export const modelHref = (locale: Locale, modelId: string): string =>
  href(locale, `/models/${modelSlug(modelId)}`);

export type ScatterView = {
  id: string; name: string; href: string; lab: LabView; cost: number; accuracy: number; ci?: number;
};

/** Les points du nuage exactitude × coût d'un classement. `latest` borne aux sorties les plus récentes. */
export function scatterPoints(site: Site, leaderboard: Leaderboard, locale: Locale, latest?: number): ScatterView[] {
  const scoreById = new Map(site.hub.scores.map((s) => [s.model.id, s]));
  const points = leaderboard.rows.flatMap((row): (ScatterView & { released: string })[] => {
    const s = scoreById.get(row.model);
    if (s === undefined) return [];
    return [{
      id: row.model, name: s.model.name, href: modelHref(locale, row.model), lab: labView(s.lab),
      cost: row.costPerDoc, accuracy: row.exactitude, ci: row.ci, released: s.model.released,
    }];
  });
  const retenus = latest === undefined
    ? points
    : [...points].sort((a, b) => b.released.localeCompare(a.released)).slice(0, latest);
  return retenus.map(({ released: _, ...p }) => p);
}
