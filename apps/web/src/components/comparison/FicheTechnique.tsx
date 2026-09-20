"use client";

import type { Modality } from "@hub/schema";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { date, pct, tokens } from "@/lib/format";
import { bestOfRow } from "@/lib/comparison";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LabMark } from "@/components/ui/LabMark";
import { EnTeteLigne, TableauModeles } from "./TableauModeles";
import type { ModeleCompare } from "./types";

/** Au-delà, un modèle invente trop souvent pour qu'on le lise sans alerte. */
const SEUIL_HALLUCINATIONS = 5;

const ICONES: Record<Modality, IconName> = { text: "text", image: "image", pdf: "document", video: "video", audio: "audio" };

/**
 * Les faits du catalogue, côte à côte. Seule la dernière ligne est un score :
 * c'est elle, et elle seule, qui porte la marque de démonstration.
 */
export function FicheTechnique({ modeles, demo }: { modeles: ModeleCompare[]; demo: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.comparison.specs;
  const { labels } = dict.common;
  const pays = dict.common.countries as Record<string, string>;
  const inconnu = <span className="text-encre-muette">{labels.unknown}</span>;

  const hallucinations = modeles.map((m) => m.hallucinations);
  const plusSobres = bestOfRow(hallucinations, { lowerIsBetter: true });

  const lignes: { label: string; rendu: (m: ModeleCompare) => React.ReactNode }[] = [
    {
      label: labels.lab,
      rendu: (m) => (
        <span className="flex items-center gap-2">
          <LabMark lab={m.lab} size={18} />
          {m.lab.name}
        </span>
      ),
    },
    // Le pays en toutes lettres : un drapeau n'est pas une icône, et tous les lecteurs ne les reconnaissent pas.
    { label: labels.country, rendu: (m) => pays[m.lab.country] ?? m.lab.country },
    { label: t.released, rendu: (m) => date(m.released, locale, "long") },
    {
      label: labels.weights,
      rendu: (m) => (m.weights === null ? inconnu : (
        <span className="flex items-center gap-1.5">
          <Icon name={m.weights === "ouverts" ? "lock-open" : "lock"} size={15} className="text-encre-pale" />
          {m.weights === "ouverts" ? labels.openWeights : labels.closedWeights}
        </span>
      )),
    },
    { label: t.context, rendu: (m) => (m.contextWindow === null ? inconnu : fill(t.tokens, { n: tokens(m.contextWindow) })) },
    { label: t.maxOutput, rendu: (m) => (m.maxOutput === null ? inconnu : fill(t.tokens, { n: tokens(m.maxOutput) })) },
    {
      label: t.modalities,
      rendu: (m) => (
        <ul className="flex flex-wrap gap-1">
          {m.modalities.map((modalite) => (
            <li key={modalite} className="pastille">
              <Icon name={ICONES[modalite]} size={12} />
              {t.modality[modalite]}
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: t.reasoning,
      rendu: (m) => (m.reasoning ? (
        <span className="flex items-center gap-1.5">
          <Icon name="check" size={15} className="text-vert" />
          {t.yes}
        </span>
      ) : <span className="text-encre-pale">{t.no}</span>),
    },
  ];

  return (
    <div className="panneau">
      <TableauModeles
        caption={t.caption}
        coin={t.column}
        modeles={modeles}
        entete={(m) => <span className="block text-sm font-semibold leading-tight">{m.name}</span>}
      >
        {lignes.map((ligne) => (
          <tr key={ligne.label} className="group">
            <EnTeteLigne label={ligne.label} />
            {modeles.map((m) => <td key={m.slug} className="align-top">{ligne.rendu(m)}</td>)}
          </tr>
        ))}
        <tr className="group">
          <EnTeteLigne
            label={t.hallucinations}
            sub={fill(t.hallucinationsHelp, { seuil: pct(SEUIL_HALLUCINATIONS, locale, 0) })}
          >
            {demo && <span className="ml-2 inline-flex align-middle"><DemoTag dict={dict} /></span>}
          </EnTeteLigne>
          {modeles.map((m, i) => {
            const v = hallucinations[i] ?? null;
            const alerte = v !== null && v > SEUIL_HALLUCINATIONS;
            return (
              <td
                key={m.slug}
                className={`chiffres align-top ${alerte ? "font-semibold text-rouge" : plusSobres.includes(i) ? "bg-vert-pale font-semibold" : ""}`}
              >
                {v === null ? <span className="text-encre-muette">{labels.notTested}</span> : pct(v, locale)}
              </td>
            );
          })}
        </tr>
      </TableauModeles>
    </div>
  );
}
