import type { Lab, Modality, Model } from "@hub/schema";
import type { Dictionary, Locale } from "@/i18n";
import { price, tokens } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/Icon";

const ICONE_MODALITE: Record<Modality, IconName> = {
  text: "text", image: "image", pdf: "document", video: "video", audio: "audio",
};

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-filet py-3.5 last:border-b sm:nth-last-2:border-b">
      <dt className="etiquette">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

/**
 * Ce que le catalogue sait du modèle. Un champ absent s'affiche « Non
 * communiqué » : mieux vaut un blanc assumé qu'un chiffre cité de mémoire.
 */
export function SpecGrid({ model, lab, lang, dict }: { model: Model; lab: Lab; lang: Locale; dict: Dictionary }) {
  const t = dict.models.specs;
  const { labels, metrics } = dict.common;
  const pays = (dict.common.countries as Record<string, string>)[lab.country] ?? lab.country;
  const inconnu = <span className="text-encre-pale">{labels.unknown}</span>;
  const enTokens = (n: number | null) => (n === null ? inconnu : (
    <>{tokens(n, lang)} <span className="text-sm text-encre-pale">{t.tokens}</span></>
  ));

  return (
    <section aria-labelledby="caracteristiques" className="mt-10">
      <h2 id="caracteristiques" className="sr-only">{t.title}</h2>
      <dl className="grid gap-x-10 sm:grid-cols-2">
        <Spec label={labels.lab}>
          {lab.name} <span className="text-encre-pale">({pays})</span>
        </Spec>
        <Spec label={labels.weights}>
          {model.weights === null ? inconnu : (
            <span className="inline-flex items-center gap-2">
              <Icon name={model.weights === "ouverts" ? "lock-open" : "lock"} size={17} className="text-encre-pale" />
              {model.weights === "ouverts" ? labels.openWeights : labels.closedWeights}
            </span>
          )}
        </Spec>
        <Spec label={t.contextWindow}>{enTokens(model.contextWindow)}</Spec>
        <Spec label={t.maxOutput}>{enTokens(model.maxOutput)}</Spec>
        <Spec label={metrics.tokenPrice}>
          {model.priceIn === null && model.priceOut === null ? inconnu : (
            <>
              <span className="whitespace-nowrap">
                {model.priceIn === null ? labels.unknown : price(model.priceIn, lang)}
                {" / "}
                {model.priceOut === null ? labels.unknown : price(model.priceOut, lang)}
              </span>{" "}
              <span className="text-sm text-encre-pale">{metrics.perMillion}</span>
            </>
          )}
        </Spec>
        <Spec label={t.modalities}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {model.modalities.map((m) => (
              <li key={m} className="inline-flex items-center gap-1.5">
                <Icon name={ICONE_MODALITE[m]} size={17} className="text-encre-pale" />
                {t.modality[m]}
              </li>
            ))}
          </ul>
        </Spec>
        <Spec label={t.reasoning}>{model.reasoning ? t.yes : t.no}</Spec>
        <Spec label={t.gatewayId}>
          <span className="select-all break-all">{model.id}</span>
        </Spec>
      </dl>
    </section>
  );
}
