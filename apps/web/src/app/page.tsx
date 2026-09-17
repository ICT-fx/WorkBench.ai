import Link from "next/link";
import { loadLeaderboard, loadReponses, documentImages } from "@/lib/data";
import { BandeauDemo } from "@/components/BandeauDemo";
import { ValeurBrute, pourcent } from "@/components/Chiffre";

// La facture f-019 est en franchise en base de TVA : il n'y a pas de TVA à
// trouver. C'est le test le plus révélateur du jeu, donc l'ouverture du site.
const DOC_VEDETTE = "f-019";

export default function Accueil() {
  const classement = loadLeaderboard("facture-fr");
  const reponses = loadReponses(classement.runId, DOC_VEDETTE, "total_tva");
  const image = documentImages("facture-fr", DOC_VEDETTE)[0];
  const meilleur = [...classement.rows].sort((a, b) => b.sansRelecture - a.sansRelecture)[0];

  return (
    <>
      {classement.status === "demo" && <BandeauDemo />}

      <main className="mx-auto max-w-5xl px-4 sm:px-8">
        <section className="border-b py-14" style={{ borderColor: "var(--filet)" }}>
          <h1 className="etendu max-w-[16ch] text-4xl font-semibold leading-[1.05] sm:text-5xl">
            Cette facture ne porte aucune TVA.
          </h1>
          <p className="mt-5 max-w-[58ch] text-lg" style={{ color: "var(--encre-pale)" }}>
            Son émetteur est en franchise en base, article 293 B du CGI. À la question
            « quel est le montant de TVA ? », la bonne réponse est : il n&apos;y en a pas.
            Voici ce qu&apos;ont répondu les modèles.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
            {image !== undefined && (
              <figure className="border" style={{ borderColor: "var(--filet)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`Facture de test ${DOC_VEDETTE}`} className="w-full" />
              </figure>
            )}

            <dl className="divide-y" style={{ borderColor: "var(--filet)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                <dt className="font-semibold">Ce qu&apos;il fallait répondre</dt>
                <dd style={{ color: "var(--valide)" }}>aucune TVA</dd>
              </div>
              {reponses.map((r) => {
                const invente = !r.enEchec && r.valeur !== null;
                return (
                  <div
                    key={r.model}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-t py-3"
                    style={{ borderColor: "var(--filet)" }}
                  >
                    <dt>{r.model}</dt>
                    <dd style={{ color: invente ? "var(--rouge)" : undefined }}>
                      {r.enEchec ? "appel en échec" : <ValeurBrute valeur={r.valeur} />}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <p className="mt-8 max-w-[62ch]">
            Un modèle qui invente un montant de TVA est plus dangereux qu&apos;un modèle
            qui dit ne pas savoir : le chiffre inventé passe la relecture. C&apos;est ce
            genre d&apos;écart que les classements publics ne mesurent pas, parce
            qu&apos;ils évaluent des examens plutôt que des documents d&apos;entreprise.
          </p>
        </section>

        <section className="py-14">
          <h2 className="etendu text-2xl font-semibold">Les tâches testées</h2>

          <ul className="mt-8 divide-y" style={{ borderColor: "var(--filet)" }}>
            <li className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <Link href="/taches/facture-fr" className="text-lg font-medium">
                  Lire une facture française
                </Link>
                <span className="chiffres text-sm" style={{ color: "var(--encre-pale)" }}>
                  testé le {new Date(classement.runDate).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })} · {classement.sampleSize} documents
                </span>
              </div>
              <p className="mt-2 max-w-[62ch]" style={{ color: "var(--encre-pale)" }}>
                Extraire les montants, le SIRET, les dates et les lignes.{" "}
                {meilleur !== undefined && (
                  <>
                    Le meilleur modèle traite {pourcent(meilleur.sansRelecture)} des
                    factures sans aucune correction.
                  </>
                )}
              </p>
            </li>

            {[
              { titre: "Répondre à un client en SAV", quand: "à venir" },
              { titre: "Résumer un contrat", quand: "à venir" },
            ].map((t) => (
              <li
                key={t.titre}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t py-5"
                style={{ borderColor: "var(--filet)", color: "var(--encre-pale)" }}
              >
                <span className="text-lg">{t.titre}</span>
                <span className="text-sm">{t.quand}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
