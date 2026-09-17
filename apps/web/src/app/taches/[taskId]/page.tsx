import { notFound } from "next/navigation";
import Link from "next/link";
import {
  loadLeaderboard, publishedTaskIds, loadTask, loadCases,
  loadReponses, loadGroundTruth, documentImages,
} from "@/lib/data";
import { Classement } from "@/components/Classement";
import { Recommandations } from "@/components/Recommandations";
import { BandeauDemo } from "@/components/BandeauDemo";
import { ValeurBrute } from "@/components/Chiffre";

export function generateStaticParams() {
  return publishedTaskIds().map((taskId) => ({ taskId }));
}

/**
 * L'ordre dans lequel les pièges se racontent le mieux : d'abord celui qui met
 * une hallucination sous les yeux, puis ceux où un modèle peut lire le bon
 * chiffre au mauvais endroit, puis les difficultés de lecture pure.
 */
const PIEGES_MONTRES = [
  "franchise_293b", "acompte", "avoir", "multi_tva",
  "remise_pied", "scan_degrade", "autoliquidation", "devise_etrangere", "deux_pages",
];

/** Le champ dont la réponse est la plus parlante pour chaque piège. */
const CHAMP_MONTRE: Record<string, string> = {
  franchise_293b: "total_tva",
  autoliquidation: "total_tva",
  acompte: "total_ttc",
  multi_tva: "total_tva",
  remise_pied: "total_ht",
  avoir: "total_ttc",
  devise_etrangere: "total_ht",
  scan_degrade: "siret_emetteur",
  deux_pages: "total_ttc",
};

export default async function PageTache({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  if (!publishedTaskIds().includes(taskId)) notFound();

  const classement = loadLeaderboard(taskId);
  const task = loadTask(taskId);
  // Un document par piège, jamais deux fois le même : trois exemples du même
  // cas donneraient l'impression d'un jeu de test pauvre.
  const parPiege = new Map<string, ReturnType<typeof loadCases>[number]>();
  for (const cas of loadCases(taskId)) {
    const piege = cas.traps[0]?.id;
    if (piege !== undefined && !parPiege.has(piege)) parPiege.set(piege, cas);
  }
  const cases = PIEGES_MONTRES
    .map((id) => parPiege.get(id))
    .filter((c) => c !== undefined)
    .slice(0, 4);
  const labels = Object.fromEntries(task.criteria.map((c) => [c.id, c.label]));
  const filet = { borderColor: "var(--filet)" };

  const dateLisible = new Date(classement.runDate).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      {classement.status === "demo" && <BandeauDemo />}

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-8">
        <h1 className="etendu max-w-[20ch] text-3xl font-semibold sm:text-4xl">{task.label}</h1>
        <p className="mt-4 max-w-[62ch] text-lg" style={{ color: "var(--encre-pale)" }}>
          {task.question}
        </p>
        <p className="chiffres mt-3 text-sm" style={{ color: "var(--encre-pale)" }}>
          Testé le {dateLisible} sur {classement.sampleSize} documents,{" "}
          {classement.rows.length} modèles. Run {classement.runId}.
        </p>

        <section className="mt-12">
          <h2 className="sr-only">Quel modèle choisir</h2>
          <Recommandations rows={classement.rows} />
        </section>

        <section className="mt-16">
          <h2 className="etendu text-2xl font-semibold">Le classement</h2>
          <p className="mt-3 max-w-[64ch]" style={{ color: "var(--encre-pale)" }}>
            Quatre mesures, jamais fondues en une note unique. Cliquez un en-tête
            pour reclasser.
          </p>
          <div className="mt-8">
            <Classement rows={classement.rows} />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="etendu text-2xl font-semibold">Les cas qui font la différence</h2>
          <p className="mt-3 max-w-[64ch]" style={{ color: "var(--encre-pale)" }}>
            Sur une facture ordinaire, tous les modèles s&apos;en sortent. L&apos;écart se
            creuse sur ces documents-là. Voici les réponses brutes, telles qu&apos;elles
            ont été produites.
          </p>

          <div className="mt-10 space-y-14">
            {cases.map((cas) => {
              const piege = cas.traps[0]!;
              const champ = CHAMP_MONTRE[piege.id] ?? "total_ttc";
              const attendu = loadGroundTruth(taskId, cas.docId).fields[champ] ?? null;
              const reponses = loadReponses(classement.runId, cas.docId, champ);
              const image = documentImages(taskId, cas.docId)[0];

              return (
                <article key={cas.docId} className="border-t pt-8" style={filet}>
                  <h3 className="max-w-[54ch] text-lg font-medium">{piege.label}</h3>
                  <p className="chiffres mt-1 text-sm" style={{ color: "var(--encre-pale)" }}>
                    document {cas.docId} · champ demandé : {labels[champ] ?? champ}
                  </p>

                  <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:items-start">
                    {image !== undefined && (
                      <figure className="border" style={filet}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={`Facture de test ${cas.docId}`} className="w-full" />
                      </figure>
                    )}

                    <dl>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 pb-2" style={filet}>
                        <dt className="font-semibold">Bonne réponse</dt>
                        <dd className="chiffres" style={{ color: "var(--valide)" }}>
                          {attendu === null ? "rien à trouver" : <ValeurBrute valeur={attendu} />}
                        </dd>
                      </div>
                      {reponses.map((r) => {
                        const invente = attendu === null && !r.enEchec && r.valeur !== null;
                        return (
                          <div
                            key={r.model}
                            className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2"
                            style={filet}
                          >
                            <dt>{r.model}</dt>
                            <dd style={{ color: invente ? "var(--rouge)" : undefined }}>
                              {r.enEchec ? "appel en échec" : <ValeurBrute valeur={r.valeur} />}
                              {invente && " — inventé"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <p className="mt-16 max-w-[62ch]">
          <Link href="/methodologie">Comment ces chiffres sont produits</Link> — le prompt
          exact, le barème et ses poids, et ce que ce test ne mesure pas.
        </p>
      </main>
    </>
  );
}
