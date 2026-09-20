/**
 * Fabrique les classements de DÉMONSTRATION de tout le hub.
 *
 * Les modèles du catalogue sont réels ; leurs scores ne le sont pas. Chaque
 * fichier écrit porte `status: "demo"`, et le site marque comme tel chaque page,
 * chaque tableau et chaque graphique, pour qu'aucune capture d'écran ne puisse
 * passer pour une mesure. Dès qu'un benchmark est publié par le vrai pipeline
 * (`npm run eval:publish`), son fichier remplace celui-ci et la marque disparaît.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  BenchmarkSchema, BenchmarkHistorySchema, LeaderboardSchema, ModelCatalogueSchema,
  type BenchmarkHistory, type Leaderboard,
} from "@hub/schema";
import { DERNIER_RUN, RUN_DATES, enLice, ligne, ligneHistorique, runIdDemo } from "./demo-model";

const CATALOGUE = join("data", "catalogue");
const PUBLISHED = join("data", "published");

const json = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

/** Une ligne par objet : les diffs de données restent lisibles en revue. */
const compact = (history: BenchmarkHistory): string => {
  const runs = history.runs.map((run) => {
    const rows = run.rows.map((r) => `      ${JSON.stringify(r)}`).join(",\n");
    const { rows: _, ...entete } = run;
    return `    ${JSON.stringify(entete).slice(0, -1)},"rows":[\n${rows}\n    ]}`;
  }).join(",\n");
  return `{"benchmarkId":${JSON.stringify(history.benchmarkId)},"runs":[\n${runs}\n]}\n`;
};

async function main(): Promise<void> {
  const { models } = ModelCatalogueSchema.parse(await json(join(CATALOGUE, "models.json")));
  const benchmarks = z.array(BenchmarkSchema).parse(await json(join(CATALOGUE, "benchmarks.json")));

  await mkdir(join(PUBLISHED, "history"), { recursive: true });

  for (const b of benchmarks) {
    const leaderboard: Leaderboard = LeaderboardSchema.parse({
      taskId: b.id,
      runId: runIdDemo(DERNIER_RUN, b.id),
      status: "demo",
      runDate: DERNIER_RUN,
      sampleSize: b.sampleSize,
      rows: enLice(models, b, DERNIER_RUN)
        .map((m) => ligne(m, b, DERNIER_RUN))
        .sort((x, y) => y.exactitude - x.exactitude),
    });
    await writeFile(join(PUBLISHED, `${b.id}.json`), `${JSON.stringify(leaderboard, null, 2)}\n`);

    const history = BenchmarkHistorySchema.parse({
      benchmarkId: b.id,
      runs: RUN_DATES.map((runDate) => ({
        runId: runIdDemo(runDate, b.id),
        runDate,
        status: "demo",
        rows: enLice(models, b, runDate)
          .map((m) => ligneHistorique(m, b, runDate, runDate === DERNIER_RUN))
          .sort((x, y) => y.exactitude - x.exactitude),
      })),
    });
    await writeFile(join(PUBLISHED, "history", `${b.id}.json`), compact(history));
  }

  console.log(`Classements de DÉMONSTRATION écrits : ${benchmarks.length} benchmarks × ${models.length} modèles.`);
  console.log(`→ ${PUBLISHED}`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
