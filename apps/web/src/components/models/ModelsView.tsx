import type { Dictionary, Locale } from "@/i18n";
import { date } from "@/lib/format";
import { modelSlug, type ModelScore } from "@/lib/hub";
import type { ModelListItem } from "@/lib/models";
import { getHub } from "@/lib/site";
import { ModelList } from "./ModelList";
import { ModelSheet } from "./ModelSheet";

/**
 * La page « Modèles » : la liste de tous les modèles à gauche, la fiche de l'un
 * d'eux à droite. `/models` et `/models/[slug]` rendent la même vue ; seul le
 * modèle affiché change.
 */
export function ModelsView({ score, lang, dict }: { score: ModelScore; lang: Locale; dict: Dictionary }) {
  const { hub } = getHub();

  // La liste part au navigateur : on n'y met que ce qu'une ligne affiche ou filtre.
  const items = hub.scores.map((s): ModelListItem => ({
    slug: modelSlug(s.model.id),
    name: s.model.name,
    labId: s.lab.id,
    labName: s.lab.name,
    slot: s.lab.slot,
    monogram: s.lab.monogram,
    country: s.lab.country,
    weights: s.model.weights,
    released: s.model.released,
    releasedLabel: date(s.model.released, lang),
    indice: s.indice,
    rank: s.rank,
  }));

  return (
    <main className="conteneur pt-6 lg:pt-10">
      <div className="lg:grid lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start lg:gap-8 xl:gap-12">
        <aside className="lg:sticky lg:top-20">
          <ModelList items={items} current={modelSlug(score.model.id)} />
        </aside>
        <article id="fiche" className="mt-8 min-w-0 lg:mt-0">
          <ModelSheet score={score} lang={lang} dict={dict} />
        </article>
      </div>
    </main>
  );
}
