import type { Dictionary } from "@/i18n";
import { fill } from "@/i18n";
import type { LigneQuestion } from "@/lib/questions";

type Detail = Dictionary["benchmarks"]["detail"];

export type LigneAffichee = LigneQuestion & {
  /** La réponse de l'analyste : une valeur, une liste de formes acceptées, ou rien. */
  attendu: unknown;
  /** Le libellé de la sous-tâche que cette question pose. */
  tache: string;
  /** Les modèles qui n'ont pas rendu de réponse exploitable, pour une question hors classement. */
  manquants: string[];
  /** Ceux dont l'échec est imputé au modèle, avec son motif : la question reste classée. */
  imputesNoms: { nom: string; motif: string }[];
};

function Attendu({ valeur, t }: { valeur: unknown; t: Detail }) {
  if (valeur === null || valeur === undefined) return <span className="text-encre-pale">{t.questionsExpectedNone}</span>;
  if (Array.isArray(valeur)) {
    // Plusieurs écritures acceptées pour un même poste : la première s'affiche, toutes
    // restent lisibles au survol, parce que c'est ce que le comparateur reconnaît.
    return <span title={valeur.join(" ; ")}>{String(valeur[0])}</span>;
  }
  return <span>{String(valeur)}</span>;
}

/**
 * Le tableau des questions d'une tâche qui en pose une par document.
 *
 * Un classement n'est vérifiable que si son jeu de test l'est. Chaque ligne dit de
 * quelle société, de quel rapport et de quelle page la question vient, ce que
 * l'analyste a répondu, combien de modèles l'ont retrouvé, et renvoie au rapport
 * chez celui qui le publie. Les questions sorties du classement n'en sont pas
 * retirées : elles figurent en bas avec leur raison, parce que les cacher
 * reviendrait à retoucher le jeu de test sans le dire.
 */
export function QuestionsPosees({ lignes, t }: { lignes: LigneAffichee[]; t: Detail }) {
  return (
    <section className="mt-16">
      <h2 className="etendu text-2xl">{t.questions}</h2>
      <p className="mt-2 max-w-[68ch] text-encre-pale">{fill(t.questionsLead, { n: lignes.length })}</p>

      <div className="panneau mt-6 overflow-x-auto">
        <table className="tableau">
          <caption className="sr-only">{t.questions}</caption>
          <thead>
            <tr>
              <th scope="col"><span className="etiquette">{t.questionsQuestion}</span></th>
              <th scope="col"><span className="etiquette">{t.questionsExpected}</span></th>
              <th scope="col" className="droite"><span className="etiquette">{t.corpusCorrect}</span></th>
              <th scope="col" className="droite"><span className="etiquette">{t.corpusInvented}</span></th>
              <th scope="col" className="droite"><span className="etiquette">{t.corpusSource}</span></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.docId}>
                <th scope="row" className="min-w-[20rem] max-w-[36rem] whitespace-normal align-top font-normal">
                  <p className="chiffres flex flex-wrap items-center gap-x-2 text-xs text-encre-pale">
                    <span>{fill(t.questionsMeta, { company: l.societe, report: l.rapport, pages: l.pages, task: l.tache })}</span>
                    {l.statut === "hors-classement" && <span className="pastille">{t.questionsOutBadge}</span>}
                    {l.statut === "ecartee" && <span className="pastille">{t.questionsDroppedBadge}</span>}
                  </p>
                  {/* Les questions sont posées en anglais, sur les deux versions du site. */}
                  <p lang="en" className="mt-1">{l.question}</p>
                  {l.statut === "hors-classement" && (
                    <p className="mt-2 text-xs text-encre-pale">
                      {fill(t.questionsOut, { models: l.manquants.join(", ") })}
                    </p>
                  )}
                  {l.statut === "classee" && l.imputesNoms.map((e) => (
                    <p key={e.nom} className="mt-2 text-xs text-encre-pale">
                      {fill(t.questionsImpute, { model: e.nom, motif: e.motif })}
                    </p>
                  ))}
                  {l.statut === "ecartee" && l.motif !== undefined && (
                    <p className="mt-2 text-xs text-encre-pale">{fill(t.questionsDropped, { motif: l.motif })}</p>
                  )}
                </th>
                <td className="chiffres align-top"><Attendu valeur={l.attendu} t={t} /></td>
                <td className="chiffres droite align-top">
                  {l.statut === "classee" ? `${l.corrects} / ${l.models}` : "—"}
                </td>
                <td className="chiffres droite align-top">
                  {l.statut !== "classee" || l.hallucinations === 0
                    ? "—"
                    : <span className="text-rouge">{l.hallucinations}</span>}
                </td>
                <td className="droite align-top">
                  {l.url === "" ? "—" : (
                    <a href={l.url} className="text-vert underline" rel="noreferrer">{t.corpusOpen}</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
