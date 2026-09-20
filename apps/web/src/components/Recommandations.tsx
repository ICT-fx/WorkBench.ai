import type { LeaderboardRow } from "@hub/schema";
import { fill, type Dictionary, type Locale } from "@/i18n";
import { recommandations, SEUIL_HALLUCINATION } from "@/lib/recommandations";
import { pct, usd } from "@/lib/format";

/**
 * Trois recommandations plutôt qu'un vainqueur. `names` traduit l'identifiant
 * d'un modèle en son nom d'affichage.
 */
export function Recommandations({ rows, names, unit, locale, dict }: {
  rows: LeaderboardRow[];
  names: Map<string, string>;
  unit: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.benchmarks.reco;
  const reco = recommandations(rows);
  const nom = (r: LeaderboardRow): string => names.get(r.model) ?? r.model;

  if (reco === null) {
    return <p className="max-w-[60ch] text-rouge">{fill(t.none, { threshold: SEUIL_HALLUCINATION })}</p>;
  }

  // Quand un seul modèle remporte les trois critères, le dire une fois vaut
  // mieux que répéter son nom trois fois, ce qui ferait douter de la mesure.
  const unique = new Set([reco.precision.model, reco.rapport.model, reco.risque.model]).size === 1;
  if (unique) {
    const r = reco.precision;
    return (
      <div className="panneau px-6 py-6">
        <p className="text-sm text-encre-pale">{t.single}</p>
        <p className="etendu mt-2 text-2xl">{nom(r)}</p>
        <p className="mt-2 max-w-[60ch] text-encre-pale">
          {fill(t.singleDetail, {
            accuracy: pct(r.exactitude, locale), cost: usd(r.costPerDoc, locale), unit,
            hallucinations: pct(r.hallucinations, locale),
          })}
        </p>
      </div>
    );
  }

  const cartes = [
    { titre: t.precision, r: reco.precision, detail: fill(t.precisionDetail, { value: pct(reco.precision.exactitude, locale) }) },
    { titre: t.volume, r: reco.rapport, detail: fill(t.volumeDetail, { value: usd(reco.rapport.costPerDoc, locale), unit }) },
    { titre: t.risk, r: reco.risque, detail: fill(t.riskDetail, { value: pct(reco.risque.hallucinations, locale) }) },
  ];

  return (
    <div className="panneau grid sm:grid-cols-3">
      {cartes.map(({ titre, r, detail }) => (
        <div key={titre} className="border-b border-filet px-6 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
          <p className="text-sm text-encre-pale">{titre}</p>
          <p className="etendu mt-2 text-xl">{nom(r)}</p>
          <p className="chiffres mt-1 text-sm text-encre-pale">{detail}</p>
        </div>
      ))}
    </div>
  );
}
