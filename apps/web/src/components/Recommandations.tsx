import type { LeaderboardRow } from "@hub/schema";
import { recommandations, SEUIL_HALLUCINATION } from "@/lib/recommandations";
import { pourcent, euros } from "./Chiffre";

const CARTES = [
  { cle: "precision" as const, titre: "Si la précision prime",
    detail: (r: LeaderboardRow) => `${pourcent(r.exactitude)} d'exactitude` },
  { cle: "rapport" as const, titre: "Si le volume compte",
    detail: (r: LeaderboardRow) => `${euros(r.costPerDoc)} par facture` },
  { cle: "risque" as const, titre: "Si l'erreur coûte cher",
    detail: (r: LeaderboardRow) => `${pourcent(r.hallucinations)} de champs inventés` },
];

export function Recommandations({ rows }: { rows: LeaderboardRow[] }) {
  const reco = recommandations(rows);

  if (reco === null) {
    return (
      <p className="max-w-[60ch]" style={{ color: "var(--rouge)" }}>
        Aucun modèle n&apos;est recommandable sur cette tâche : tous dépassent{" "}
        {SEUIL_HALLUCINATION} % de champs inventés, ou échouent trop souvent. Ne rien
        conseiller est ici la réponse honnête.
      </p>
    );
  }

  // Quand un seul modèle remporte les trois critères, le dire une fois vaut
  // mieux que répéter son nom trois fois, ce qui ferait douter de la mesure.
  const unique = new Set([reco.precision.model, reco.rapport.model, reco.risque.model]).size === 1;
  if (unique) {
    const r = reco.precision;
    return (
      <div className="border-y py-6" style={{ borderColor: "var(--filet)" }}>
        <p className="text-sm" style={{ color: "var(--encre-pale)" }}>
          Un seul modèle l&apos;emporte sur les trois critères
        </p>
        <p className="etendu mt-2 text-2xl font-semibold">{r.model}</p>
        <p className="chiffres mt-2 max-w-[60ch]" style={{ color: "var(--encre-pale)" }}>
          {pourcent(r.exactitude)} d&apos;exactitude, {euros(r.costPerDoc)} par facture,
          {" "}{pourcent(r.hallucinations)} de champs inventés. Aucun autre modèle testé
          n&apos;est à la fois assez précis et assez prudent pour être conseillé.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--filet)" }}>
      {CARTES.map(({ cle, titre, detail }) => {
        const r = reco[cle];
        return (
          <div key={cle} className="p-5" style={{ background: "var(--papier)" }}>
            <p className="text-sm" style={{ color: "var(--encre-pale)" }}>{titre}</p>
            <p className="etendu mt-2 text-xl font-semibold">{r.model}</p>
            <p className="chiffres mt-1 text-sm" style={{ color: "var(--encre-pale)" }}>
              {detail(r)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
