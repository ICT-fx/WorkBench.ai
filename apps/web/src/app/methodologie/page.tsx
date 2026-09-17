import { loadTask, loadPrompt, loadLeaderboard } from "@/lib/data";

export const metadata = { title: "Méthodologie — Hub d'évaluations métier" };

const LIMITES = [
  "Un seul prompt par modèle. Un prompt travaillé pour un modèle donné améliorerait ses résultats ; nous mesurons ce que donne une intégration standard.",
  "Aucun ajustement fin, aucun OCR spécialisé en amont. Une chaîne de traitement dédiée ferait mieux.",
  "Des factures fabriquées, pas des factures réelles anonymisées. Le dépôt est public : maquiller de vrais documents client laisserait des traces.",
  "Des images, pas des PDF avec couche texte. Un PDF natif est plus facile à lire pour un modèle : les scores publiés sont un plancher, pas un plafond.",
  "Vingt-cinq documents, pas dix mille. Assez pour classer, pas pour mesurer un écart de deux points.",
];

const COMPARAISONS: Record<string, string> = {
  exact: "identité, ponctuation ignorée",
  number: "au centime",
  date: "date normalisée",
  lines: "appariement des lignes",
  text: "termes porteurs de sens",
};

export default function Methodologie() {
  const task = loadTask("facture-fr");
  const prompt = loadPrompt("facture-fr");
  const classement = loadLeaderboard("facture-fr");
  const filet = { borderColor: "var(--filet)" };

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-8">
      <h1 className="etendu text-3xl font-semibold sm:text-4xl">Méthodologie</h1>
      <p className="mt-5 max-w-[62ch] text-lg" style={{ color: "var(--encre-pale)" }}>
        Tout ce qui suit est vérifiable dans le dépôt : le prompt envoyé, le barème
        appliqué, les documents soumis et les réponses brutes de chaque modèle.
      </p>

      <section className="mt-14">
        <h2 className="etendu text-2xl font-semibold">Ce que ce test ne mesure pas</h2>
        <ul className="mt-6 max-w-[68ch] space-y-4">
          {LIMITES.map((l) => (
            <li key={l} className="border-l-2 pl-4" style={{ borderColor: "var(--rouge)" }}>
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="etendu text-2xl font-semibold">Le barème</h2>
        <p className="mt-3 max-w-[62ch]" style={{ color: "var(--encre-pale)" }}>
          Les champs sont pesés par ce qu&apos;une erreur coûte en comptabilité, pas par
          leur difficulté technique. Un champ critique faux fait basculer toute la facture
          en « à relire ».
        </p>
        <table className="chiffres mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 text-left" style={filet}>
              <th className="pb-2 pr-4 font-semibold">Champ</th>
              <th className="pb-2 pr-4 font-normal" style={{ color: "var(--encre-pale)" }}>Comparaison</th>
              <th className="pb-2 pr-4 text-right font-normal" style={{ color: "var(--encre-pale)" }}>Poids</th>
              <th className="pb-2 text-right font-normal" style={{ color: "var(--encre-pale)" }}>Critique</th>
            </tr>
          </thead>
          <tbody>
            {task.criteria.map((c) => (
              <tr key={c.id} className="border-b" style={filet}>
                <td className="py-2 pr-4">{c.label}</td>
                <td className="py-2 pr-4" style={{ color: "var(--encre-pale)" }}>
                  {COMPARAISONS[c.kind]}
                </td>
                <td className="py-2 pr-4 text-right">{c.weight}</td>
                <td className="py-2 text-right" style={{ color: c.critical ? "var(--rouge)" : "var(--encre-pale)" }}>
                  {c.critical ? "oui" : "non"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-14">
        <h2 className="etendu text-2xl font-semibold">Les trois verdicts</h2>
        <p className="mt-3 max-w-[64ch]">
          Un champ absent du document fait partie du test. Répondre « rien » quand il
          n&apos;y a rien est compté comme une bonne réponse ; produire une valeur
          l&apos;est comme une hallucination, comptée à part du reste et jamais fondue
          dans une note globale.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="etendu text-2xl font-semibold">Le prompt, intégralement</h2>
        <p className="mt-3 max-w-[62ch]" style={{ color: "var(--encre-pale)" }}>
          Envoyé tel quel à chaque modèle, avec l&apos;image de la facture.
        </p>
        <pre
          className="mt-6 overflow-x-auto border p-5 text-sm leading-relaxed"
          style={{ ...filet, background: "var(--papier-creux)", whiteSpace: "pre-wrap" }}
        >
          {prompt}
        </pre>
      </section>

      <section className="mt-14">
        <h2 className="etendu text-2xl font-semibold">Ce test</h2>
        <dl className="chiffres mt-6 max-w-md" style={filet}>
          {[
            ["Run", classement.runId],
            ["Date", classement.runDate],
            ["Documents", String(classement.sampleSize)],
            ["Modèles", String(classement.rows.length)],
            ["Statut", classement.status === "demo" ? "démonstration" : "mesure réelle"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 border-t py-2" style={filet}>
              <dt style={{ color: "var(--encre-pale)" }}>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
