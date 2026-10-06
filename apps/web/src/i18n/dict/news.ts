const fr = {
  // Interface : la page d'accueil lit aussi `kinds[kind]`. Ne pas renommer ces quatre clés.
  kinds: { modele: "Modèle", benchmark: "Benchmark", analyse: "Analyse", annonce: "Annonce" },
  index: {
    metaTitle: "Actualités",
    metaDescription:
      "Comptes rendus par modèle, ouverture de benchmarks et notes de méthode du Hub d'évaluations métier.",
    title: "Actualités du hub",
    lead: "Ce qui entre dans les classements, ce qui change dans la méthode, et la raison de chaque parti pris.",
    tabsLabel: "Filtrer les articles par type",
    tabs: { all: "Tout", modele: "Modèles", benchmark: "Benchmarks", analyse: "Analyses", annonce: "Annonces" },
    featured: "À la une",
    allArticles: "Tous les articles",
    count: { one: "{n} article", other: "{n} articles" },
    viewMore: { one: "Voir {n} article de plus", other: "Voir {n} articles de plus" },
    auto: "Rédigé à partir des classements",
    empty: "Aucun article de ce type pour l'instant.",
    emptyAction: "Voir tous les articles",
  },
  article: {
    breadcrumb: "Fil d'Ariane",
    autoNote:
      "Compte rendu rédigé par le hub à partir des classements publiés : chaque phrase est calculée, aucune n'est une opinion.",
    domainScores: "Scores par métier",
    domainScoresNote: "Exactitude moyenne du modèle sur les benchmarks de chaque métier qu'il a passés.",
    domain: "Métier",
    score: "Score",
    viewModel: "Voir la fiche du modèle",
    compare: "Comparer",
    viewBenchmark: "Voir le benchmark",
    related: "À lire aussi",
    allNews: "Toutes les actualités",
  },
  // Les gabarits des comptes rendus que `lib/news.ts` rédige à partir des classements.
  report: {
    titleAll: "{name} évalué sur les {n} benchmarks du hub",
    titleAllOne: "{name} évalué sur le seul benchmark du hub",
    titlePartial: "{name} évalué sur {taken} des {n} benchmarks du hub",
    summary:
      "Sorti le {date}, {name} ({lab}) entre dans les classements du hub : son rang à l'indice métier, ses métiers forts et faibles, son coût et son taux d'hallucinations.",
    summaryDemo:
      "Sorti le {date}, {name} ({lab}) entre dans les classements du hub, avec des scores de démonstration qui ne sont pas des mesures : rang à l'indice métier, métiers forts et faibles, coût, hallucinations.",
    demoWarning:
      "Scores de démonstration : les chiffres de ce compte rendu sont fabriqués pour construire le site, ce ne sont pas des mesures. N'en tirez aucune conclusion sur le modèle.",
    ordinal: { one: "{n}er", two: "{n}e", few: "{n}e", other: "{n}e" },
    point: { one: "point", other: "points" },
    rank: "{rank} sur {of} à l'indice métier, avec {indice}.",
    rankMargin: "{rank} sur {of} à l'indice métier, avec {indice} (marge d'erreur à 95 % : ± {ci} {unit}).",
    noIndex:
      "Pas d'indice métier : il lui manque au moins un métier entier, et un indice incomplet ne se compare à aucun autre.",
    deltaUp: "{points} {unit} d'indice de plus que {previous}, son prédécesseur chez {lab}, sorti le {date}.",
    deltaDown: "{points} {unit} d'indice de moins que {previous}, son prédécesseur chez {lab}, sorti le {date}.",
    deltaFlat: "Le même indice que {previous}, son prédécesseur chez {lab}, sorti le {date}.",
    deltaWithinMargin: "L'écart est inférieur à la marge d'erreur : les deux modèles ne sont pas départagés.",
    domains:
      "Ses deux meilleurs métiers : {first} ({firstScore}) et {second} ({secondScore}). Le plus faible : {last} ({lastScore}).",
    cost: "Coût moyen par test : {cost}, le {rank} moins cher des {of} modèles dont le tarif est connu.",
    costCheapest: "Coût moyen par test : {cost}, le moins cher des {of} modèles dont le tarif est connu.",
    costPriciest: "Coût moyen par test : {cost}, le plus cher des {of} modèles dont le tarif est connu.",
    costUnknown: "Tarif public non communiqué : il n'entre pas dans la comparaison des coûts.",
    hallucinations:
      "Taux d'hallucinations moyen : {rate}, la part des éléments absents de la source pour lesquels il a inventé une valeur.",
    takenAll: "Il a passé les {n} benchmarks du hub.",
    takenAllOne: "Il a passé le seul benchmark publié du hub.",
    takenTextOnly:
      "Benchmarks passés : {taken} sur {n}. Il ne lit ni image ni PDF : les benchmarks qui soumettent un document lui sont fermés, et chaque métier est noté sur ses seuls benchmarks texte.",
    takenPartial: "Benchmarks passés : {taken} sur {n}. Les autres n'ont pas de résultat publié pour ce modèle.",
  },
};

const en: typeof fr = {
  kinds: { modele: "Model", benchmark: "Benchmark", analyse: "Analysis", annonce: "Announcement" },
  index: {
    metaTitle: "News",
    metaDescription: "Model reports, benchmark launches and notes on method from the Business Evals Hub.",
    title: "Hub news",
    lead: "What enters the rankings, what changes in the method, and the reasoning behind every choice.",
    tabsLabel: "Filter articles by type",
    tabs: { all: "All", modele: "Models", benchmark: "Benchmarks", analyse: "Analysis", annonce: "Announcements" },
    featured: "Featured",
    allArticles: "All articles",
    count: { one: "{n} article", other: "{n} articles" },
    viewMore: { one: "View {n} more article", other: "View {n} more articles" },
    auto: "Written from the rankings",
    empty: "No articles of this type yet.",
    emptyAction: "View all articles",
  },
  article: {
    breadcrumb: "Breadcrumb",
    autoNote:
      "Report written by the hub from the published rankings: every sentence is computed, none is an opinion.",
    domainScores: "Scores by business function",
    domainScoresNote: "The model's mean accuracy on the benchmarks it took in each business function.",
    domain: "Business function",
    score: "Score",
    viewModel: "View the model page",
    compare: "Compare",
    viewBenchmark: "View the benchmark",
    related: "Read next",
    allNews: "All news",
  },
  report: {
    titleAll: "{name} evaluated on the hub's {n} benchmarks",
    titleAllOne: "{name} evaluated on the hub's only benchmark",
    titlePartial: "{name} evaluated on {taken} of the hub's {n} benchmarks",
    summary:
      "Released on {date}, {name} ({lab}) joins the hub's rankings: its place on the Business Index, its strongest and weakest business functions, its cost and its hallucination rate.",
    summaryDemo:
      "Released on {date}, {name} ({lab}) joins the hub's rankings, on demonstration scores that are not measurements: place on the Business Index, strongest and weakest business functions, cost, hallucinations.",
    demoWarning:
      "Demonstration scores: the figures in this report are fabricated to build the site; they are not measurements. Draw no conclusion about the model from them.",
    ordinal: { one: "{n}st", two: "{n}nd", few: "{n}rd", other: "{n}th" },
    point: { one: "point", other: "points" },
    rank: "{rank} of {of} on the Business Index, at {indice}.",
    rankMargin: "{rank} of {of} on the Business Index, at {indice} (95% margin of error: ± {ci} {unit}).",
    noIndex:
      "No Business Index: at least one whole business function is missing, and an incomplete index cannot be compared with any other.",
    deltaUp: "{points} index {unit} above {previous}, its predecessor at {lab}, released on {date}.",
    deltaDown: "{points} index {unit} below {previous}, its predecessor at {lab}, released on {date}.",
    deltaFlat: "The same index as {previous}, its predecessor at {lab}, released on {date}.",
    deltaWithinMargin: "The gap is smaller than the margin of error: the two models cannot be told apart.",
    domains:
      "Its two strongest business functions: {first} ({firstScore}) and {second} ({secondScore}). Its weakest: {last} ({lastScore}).",
    cost: "Mean cost per test: {cost}, the {rank} cheapest of the {of} models with a known price.",
    costCheapest: "Mean cost per test: {cost}, the cheapest of the {of} models with a known price.",
    costPriciest: "Mean cost per test: {cost}, the most expensive of the {of} models with a known price.",
    costUnknown: "No public price: it is left out of the cost comparison.",
    hallucinations:
      "Mean hallucination rate: {rate}, the share of items missing from the source for which it invented a value.",
    takenAll: "It took all {n} of the hub's benchmarks.",
    takenAllOne: "It took the hub's only published benchmark.",
    takenTextOnly:
      "Benchmarks taken: {taken} of {n}. It reads neither images nor PDFs: benchmarks that submit a document are closed to it, and each business function is scored on its text benchmarks alone.",
    takenPartial: "Benchmarks taken: {taken} of {n}. The others have no published result for this model.",
  },
};

export const news = { fr, en };
