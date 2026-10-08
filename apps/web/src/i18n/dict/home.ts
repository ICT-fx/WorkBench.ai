const fr = {
  hero: {
    title: "Quel modèle d'IA pour quel métier de l'entreprise ?",
    lead:
      "Les classements publics mesurent des examens. Nous testons les principaux modèles sur le travail réel d'une entreprise — lire une facture, résumer un contrat, répondre à un client — et publions le protocole, les documents et les réponses brutes.",
    ctaBenchmarks: "Parcourir les benchmarks",
    ctaCompare: "Comparer des modèles",
    facts: "{models} modèles · {labs} labos · {benchmarks} benchmarks dans {domains} métiers · {measured} mesuré{measuredS} à ce jour",
  },
  ticker: {
    label: "Dernières actualités",
    prev: "Actualité précédente",
    next: "Actualité suivante",
  },
  index: {
    title: "L'indice métier, labo par labo",
    measure: "Mesure affichée",
    note: "Le meilleur modèle de chaque labo, classé par indice métier.",
    scope: "Indice calculé sur {domains} métier{domainsS} mesuré{domainsS} sur {domainsTotal}. Les autres métiers ne comptent pas encore — ni en bien, ni en mal.",
  },
  reports: {
    title: "Derniers rapports",
    lead: "Nouveaux modèles évalués, nouveaux benchmarks, notes de méthode.",
    read: "Lire l'article",
    all: "Toutes les actualités",
    topOf: "Haut du classement",
    bestDomains: "Ses meilleurs métiers",
  },
  domains: {
    title: "Le classement, métier par métier",
    lead: "Le meilleur modèle en finance n'est pas forcément le bon pour votre service client. Choisissez un métier, puis un benchmark.",
    soon: "{n} autres tâches, dans {d} métiers, ont un protocole écrit et attendent leur jeu de test.",
    soonLink: "Voir ce qui est au programme",
    pick: "Métier",
    benchmark: "Benchmark",
    showing: "Les {n} modèles les plus récents. La ligne verte relie ceux qu'aucun autre ne bat à la fois en prix et en exactitude.",
    allModels: "Voir tous les modèles",
  },
  time: {
    title: "La performance dans le temps",
    lead: "À chaque sortie qui bat le record de son groupe, une marche. Entre deux sorties, le meilleur modèle disponible ne change pas.",
    groupBy: "Regrouper par",
    labs: "Labos",
    countries: "Pays",
    weights: "Poids",
    chartLabel: "Indice métier du meilleur modèle de chaque groupe, selon la date de sortie",
    note: "Indice métier du meilleur modèle sorti à chaque date. Un point par sortie qui améliore le record du groupe.",
  },
};

const en: typeof fr = {
  hero: {
    title: "Which AI model for which business function?",
    lead:
      "Public leaderboards measure exams. We test the leading models on a company's real work — reading an invoice, summarising a contract, answering a customer — and publish the protocol, the documents and the raw answers.",
    ctaBenchmarks: "Browse the benchmarks",
    ctaCompare: "Compare models",
    facts: "{models} models · {labs} labs · {benchmarks} benchmarks across {domains} business functions · {measured} measured so far",
  },
  ticker: {
    label: "Latest news",
    prev: "Previous item",
    next: "Next item",
  },
  index: {
    title: "The Business Index, lab by lab",
    measure: "Displayed measure",
    note: "Each lab's best model, ranked by Business Index.",
    scope: "Index computed over {domains} of {domainsTotal} business functions measured. The others do not count yet — neither for nor against.",
  },
  reports: {
    title: "Latest reports",
    lead: "Newly evaluated models, new benchmarks, notes on method.",
    read: "Read the article",
    all: "All news",
    topOf: "Top of the leaderboard",
    bestDomains: "Its best business functions",
  },
  domains: {
    title: "The leaderboard, function by function",
    lead: "The best model for finance is not necessarily the right one for your customer service. Pick a function, then a benchmark.",
    soon: "{n} further tasks, across {d} business functions, have a written protocol and are waiting for their test set.",
    soonLink: "See what is on the roadmap",
    pick: "Function",
    benchmark: "Benchmark",
    showing: "The {n} most recent models. The green line links those that no other model beats on both price and accuracy.",
    allModels: "View all models",
  },
  time: {
    title: "Performance over time",
    lead: "Each release that beats its group's record adds a step. Between two releases, the best available model does not change.",
    groupBy: "Group by",
    labs: "Labs",
    countries: "Countries",
    weights: "Weights",
    chartLabel: "Business Index of each group's best model, by release date",
    note: "Business Index of the best model released at each date. One point per release that improves the group's record.",
  },
};

export const home = { fr, en };
