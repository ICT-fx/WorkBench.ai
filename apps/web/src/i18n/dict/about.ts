// Les textes d'interface seulement : la prose longue des deux pages vit dans
// `components/about/content.ts`, pour ne pas voyager avec le dictionnaire de chaque page.
const fr = {
  tabs: { label: "Pages de la rubrique À propos", about: "À propos", methodology: "Méthodologie" },
  about: {
    metaTitle: "À propos",
    metaDescription:
      "Pourquoi un classement des modèles d'IA sur des tâches d'entreprise concrètes, ce qu'il mesure, ses limites, et qui le publie.",
    title: "À propos du hub",
    lead: "AIWorkBench.fr classe les modèles d'IA sur des tâches d'entreprise concrètes, métier par métier, et publie tout ce qu'il faut pour refaire le calcul.",
    ctaMethodology: "Lire la méthodologie",
    ctaBenchmarks: "Voir les benchmarks",
  },
  methodology: {
    metaTitle: "Méthodologie",
    metaDescription:
      "Comment l'indice métier est calculé, ce que vaut un écart, d'où viennent les coûts, comment sont fabriqués les scores de démonstration, et le barème complet de la lecture de factures.",
    title: "Méthodologie",
    lead: "Deux parties : la méthode commune à tout le hub, puis le protocole propre à chaque benchmark mesuré. Tout est vérifiable dans le dépôt — le prompt envoyé, le barème appliqué, les documents soumis et les réponses brutes de chaque modèle.",
    toc: "Sommaire",
    tocHub: "La méthode du hub",
    tocTask: "Protocole : {benchmark}",
    table: { field: "Champ", comparison: "Comparaison", weight: "Poids", critical: "Critique", yes: "oui", no: "non" },
    kinds: {
      exact: "identité, ponctuation ignorée",
      number: "au centime",
      numberTolerance: "à {n} près",
      numberRelative: "à {n} % près, ou à la moitié du dernier chiffre",
      date: "date normalisée",
      lines: "appariement des lignes",
      text: "termes porteurs de sens",
    },
    originalLabels: "Libellés d'origine, tels qu'ils figurent dans la définition de la tâche.",
    scoringCaption: "Barème de ce benchmark",
    run: {
      caption: "Dernier run publié de ce benchmark",
      run: "Run",
      date: "Date",
      documents: "Documents",
      questions: "Questions classées",
      models: "Modèles",
      status: "Statut",
      demo: "démonstration",
      real: "mesure réelle",
    },
    viewBenchmark: "Voir le benchmark",
  },
};

const en: typeof fr = {
  tabs: { label: "Pages of the About section", about: "About", methodology: "Methodology" },
  about: {
    metaTitle: "About",
    metaDescription:
      "Why rank AI models on concrete business tasks, what the hub measures, its limits, and who publishes it.",
    title: "About the hub",
    lead: "AIWorkBench.fr ranks AI models on concrete business tasks, one business function at a time, and publishes everything needed to redo the sums.",
    ctaMethodology: "Read the methodology",
    ctaBenchmarks: "View the benchmarks",
  },
  methodology: {
    metaTitle: "Methodology",
    metaDescription:
      "How the Business Index is computed, what a gap is worth, where costs come from, how demonstration scores are fabricated, and the full scoring grid for invoice reading.",
    title: "Methodology",
    lead: "Two parts: the method common to the whole hub, then the protocol specific to each measured benchmark. Everything can be checked in the repository — the prompt sent, the scoring grid applied, the documents submitted and each model's raw answers.",
    toc: "Contents",
    tocHub: "The hub's method",
    tocTask: "Protocol: {benchmark}",
    table: { field: "Field", comparison: "Comparison", weight: "Weight", critical: "Critical", yes: "yes", no: "no" },
    kinds: {
      exact: "identical, punctuation ignored",
      number: "to the cent",
      numberTolerance: "within {n}",
      numberRelative: "within {n}%, or half of the last digit",
      date: "normalised date",
      lines: "line-item matching",
      text: "meaning-bearing terms",
    },
    originalLabels: "Field labels are the original French ones, as written in the task definition.",
    scoringCaption: "Scoring grid of this benchmark",
    run: {
      caption: "Latest published run of this benchmark",
      run: "Run",
      date: "Date",
      documents: "Documents",
      questions: "Questions ranked",
      models: "Models",
      status: "Status",
      demo: "demonstration",
      real: "real measurement",
    },
    viewBenchmark: "View the benchmark",
  },
};

export const about = { fr, en };
