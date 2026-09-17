import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { GroundTruthSchema } from "@hub/schema";
import { buildInvoice, toGroundTruth } from "./invoice-model";
import { renderInvoice } from "./render";
import { degrade } from "./degrade";
import { SCENARIOS, TRAP_LABELS } from "./scenarios";

const TASK_DIR = "data/tasks/facture-fr";

async function main(): Promise<void> {
  const docsDir = join(TASK_DIR, "documents");
  const gtDir = join(TASK_DIR, "ground-truth");

  // Régénération complète : le générateur est déterministe, donc un jeu
  // régénéré à l'identique ne produit aucun diff git.
  await rm(docsDir, { recursive: true, force: true });
  await rm(gtDir, { recursive: true, force: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(gtDir, { recursive: true });

  let pages = 0;
  for (const [i, scenario] of SCENARIOS.entries()) {
    const invoice = buildInvoice(scenario.input);
    const traps = scenario.traps ?? [];

    let images = renderInvoice(invoice, scenario.template, traps.includes("deux_pages"));
    if (traps.includes("scan_degrade")) {
      images = await Promise.all(images.map((img) => degrade(img, i * 7 + 3)));
    }

    for (const [p, img] of images.entries()) {
      const name = images.length > 1 ? `${scenario.id}-p${p + 1}.png` : `${scenario.id}.png`;
      await writeFile(join(docsDir, name), img);
      pages++;
    }

    const gt = GroundTruthSchema.parse(toGroundTruth(invoice));
    await writeFile(join(gtDir, `${scenario.id}.json`), `${JSON.stringify(gt, null, 2)}\n`);
  }

  // Les pièges appartiennent aux données : le site doit pouvoir les lire sans
  // importer le générateur, qui dépend du rendu graphique.
  await writeFile(
    join(TASK_DIR, "cases.json"),
    `${JSON.stringify(
      SCENARIOS.map((s) => ({
        docId: s.id,
        template: s.template,
        traps: (s.traps ?? []).map((t) => ({ id: t, label: TRAP_LABELS[t] })),
      })),
      null,
      2,
    )}\n`,
  );

  const nulls = SCENARIOS.flatMap((s) =>
    Object.values(toGroundTruth(buildInvoice(s.input)).fields).filter((v) => v === null));

  console.log(`${SCENARIOS.length} factures générées, ${pages} images.`);
  console.log(`${nulls.length} champs légitimement absents (les pièges à hallucination).`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
