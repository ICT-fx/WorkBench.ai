import { tr, type Dictionary, type Locale } from "@/i18n";
import { pct } from "@/lib/format";
import type { ModelScore } from "@/lib/hub";
import { getHub } from "@/lib/site";
import { DemoTag } from "@/components/ui/DemoTag";
import { Icon, hasIcon } from "@/components/ui/Icon";
import { serie } from "@/components/ui/LabMark";
import { Bar } from "./Bar";

/** Le score du modèle dans chacun des métiers : ce sont eux que l'indice moyenne. */
export function DomainScores({ score, lang, dict }: { score: ModelScore; lang: Locale; dict: Dictionary }) {
  const { hub, domains } = getHub();
  const t = dict.models.domains;

  return (
    <section aria-labelledby="metiers" className="mt-16">
      <h2 id="metiers" className="etendu text-2xl">{t.title}</h2>
      <p className="mt-2 max-w-[68ch] text-sm text-encre-pale">{t.intro}</p>

      <div className="panneau @container mt-5">
        <div className="barre">
          <span className="etiquette">{dict.common.metrics.accuracy}</span>
          <DemoTag dict={dict} show={hub.demo} />
        </div>
        <ul>
          {domains.map((domain) => {
            const valeur = score.byDomain[domain.id] ?? null;
            return (
              <li
                key={domain.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-filet px-4 py-3 last:border-b-0 sm:px-5 @min-[32rem]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4.5rem]"
              >
                <p className="col-start-1 row-start-1 flex items-center gap-2.5 text-[0.95rem] @min-[32rem]:col-start-auto @min-[32rem]:row-start-auto">
                  <Icon name={hasIcon(domain.icon) ? domain.icon : "indice"} className="text-encre-pale" />
                  {tr(domain.label, lang)}
                </p>
                {valeur === null ? (
                  <p className="col-start-2 row-start-1 text-sm text-encre-pale @min-[32rem]:col-span-2 @min-[32rem]:col-start-auto @min-[32rem]:row-start-auto @min-[32rem]:text-right">
                    {dict.common.labels.notTested}
                  </p>
                ) : (
                  <>
                    <div className="col-span-full row-start-2 @min-[32rem]:col-span-1 @min-[32rem]:row-start-auto">
                      <Bar ratio={valeur / 100} color={serie(score.lab)} />
                    </div>
                    <p className="chiffres col-start-2 row-start-1 text-right font-medium @min-[32rem]:col-start-auto @min-[32rem]:row-start-auto">
                      {pct(valeur, lang)}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
