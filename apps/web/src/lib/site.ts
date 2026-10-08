import { cache } from "react";
import type { Benchmark, Domain, Lab, Leaderboard, Model } from "@hub/schema";
import {
  loadBenchmarks, loadDomains, loadLabs, loadLeaderboard, loadModelCatalogue, publishedTaskIds,
} from "./data";
import { buildHub, modelSlug, type Hub } from "./hub";

export type Site = {
  hub: Hub;
  labs: Lab[];
  models: Model[];
  domains: Domain[];
  benchmarks: Benchmark[];
  leaderboards: Map<string, Leaderboard>;
  /** Date de synchronisation des tarifs avec le catalogue public. */
  pricesSyncedAt: string;
  /** Date à laquelle la version datée de chaque modèle a été relevée, si elle l'a été. */
  versionsSyncedAt: string | null;
};

/**
 * Tout le hub, lu et calculé une fois par rendu. Les pages sont statiques : ce
 * travail a lieu au build, pas à chaque visite.
 */
export const getHub = cache((): Site => {
  const catalogue = loadModelCatalogue();
  const labs = loadLabs();
  const domains = loadDomains();
  const benchmarks = loadBenchmarks();
  const known = new Set(benchmarks.map((b) => b.id));
  const leaderboards = publishedTaskIds().filter((id) => known.has(id)).map(loadLeaderboard);

  const slugs = new Set(catalogue.models.map((m) => modelSlug(m.id)));
  if (slugs.size !== catalogue.models.length) {
    throw new Error("Deux modèles du catalogue produisent la même adresse de fiche.");
  }

  return {
    hub: buildHub({ labs, models: catalogue.models, domains, benchmarks, leaderboards }),
    labs, models: catalogue.models, domains, benchmarks,
    leaderboards: new Map(leaderboards.map((lb) => [lb.taskId, lb])),
    pricesSyncedAt: catalogue.syncedAt,
    versionsSyncedAt: catalogue.versionsSyncedAt ?? null,
  };
});
