/**
 * La prose des pages « À propos » et « Méthodologie », les deux langues côte à côte.
 *
 * Elle ne vit pas dans le dictionnaire : celui-ci est transmis en entier aux
 * composants client de chaque page, et plusieurs milliers de signes de prose
 * n'ont rien à faire dans la page d'un classement. Ce module n'est lu que par
 * les pages serveur qui l'affichent. Même garde-fou que le dictionnaire : un
 * texte ajouté en français sans son pendant anglais est une erreur de type.
 *
 * Une ligne commençant par « - » est une puce ; `{jeton}` est rempli par la page.
 */

type Section = { id: string; title: string; body: string[] };

const fr = {
  about: {
    sections: [
      {
        id: "angle-mort",
        title: "Ce que les classements publics ne mesurent pas",
        body: [
          "Les classements publics de modèles d'IA mesurent des examens académiques. Ils disent quel modèle raisonne le mieux sur ce terrain-là, et c'est utile à savoir. Ce n'est pas ce qu'une entreprise a besoin de savoir pour choisir un outil.",
          "Une PME qui s'équipe se pose d'autres questions :",
          "- combien de ses factures passeront sans correction ;",
          "- combien coûtera chacune ;",
          "- à quelle fréquence le modèle inventera un chiffre qui n'est pas sur le document.",
          "Aucun score d'examen n'y répond. Le hub est construit pour y répondre, sur la facture d'abord, puis sur les autres métiers de l'entreprise.",
        ],
      },
      {
        id: "construction",
        title: "Ce que nous construisons",
        body: [
          "Des tâches d'entreprise concrètes, rangées par métier : finance, comptabilité, ressources humaines, juridique, commercial, marketing, service client, achats, informatique, direction. Chaque benchmark part d'une question qu'un dirigeant poserait — combien de vos factures passeront sans qu'un humain ait à corriger ? — et non d'une capacité abstraite du modèle.",
          "Quatre mesures, publiées côte à côte et jamais fondues en une seule note :",
          "- Sans relecture : la part des cas traités sans qu'un humain ait rien à corriger.",
          "- Exactitude : les points obtenus sur l'ensemble des éléments notés, pondérés par leur criticité.",
          "- Hallucinations : les éléments inventés là où la source ne contient rien.",
          "- Coût et temps : par cas de test, aux tarifs publics du jour du test.",
          "Un modèle peut être premier en exactitude et inutilisable parce qu'il invente. Une note unique cacherait exactement cela. Le seul chiffre d'ensemble du site, l'indice métier, n'agrège que l'exactitude, à poids égal par métier.",
          "Trois verdicts et non deux. Un champ absent du document fait partie du test : une facture en franchise de TVA n'a pas de taux de TVA, et répondre « rien » est alors la bonne réponse. Un champ est donc juste, faux ou manquant, ou halluciné — le modèle a produit une valeur là où le document n'en contient aucune. Un chiffre inventé coûte plus cher qu'un chiffre manquant, parce qu'il passe la relecture.",
        ],
      },
      {
        id: "verifiable",
        title: "Tout est vérifiable",
        body: [
          "Le prompt envoyé, les documents soumis, les réponses brutes de chaque modèle, le barème et le code qui note sont publiés dans le dépôt. Chaque chiffre mesuré peut être recalculé à partir de là.",
          "Un run est un dossier horodaté et immuable. Ajouter un modèle crée un nouveau run ; les précédents restent consultables. La version exacte du modèle qui a répondu est relevée à l'exécution, jamais saisie à la main : dans six mois, le même nom commercial ne désignera plus forcément le même modèle.",
          "Les étapes sont séparées à dessein : interroger les modèles, appliquer le barème, arbitrer les cas douteux, figer le classement. Changer le barème et relancer la notation ne coûte aucun appel : les réponses brutes sont conservées, ce qui rend les comparaisons dans le temps honnêtes.",
          "Le site, lui, n'appelle aucun modèle. Il lit des résultats figés, et refuse de se construire si un fichier de données est invalide : mieux vaut pas de site qu'un classement à moitié affiché.",
        ],
      },
    ] satisfies Section[],
    limits: {
      id: "limites",
      title: "Limites assumées",
      body: [
        "Un seul prompt par modèle, aucun ajustement fin, aucun OCR spécialisé en amont, des images plutôt que des PDF avec couche texte, et vingt-cinq documents plutôt que dix mille. Les scores publiés sont un plancher, pas un plafond.",
      ],
      /** Affiché tant qu'un classement de démonstration subsiste. */
      progress:
        "Deux limites tiennent à l'avancement du projet. Protocoles exécutables de bout en bout à ce jour : {executables} sur {total} ({names}) ; les autres sont rédigés, et leur jeu de test reste à construire. Et les scores affichés sont des scores de démonstration, marqués comme tels partout où ils apparaissent : la méthodologie explique comment ils sont fabriqués, et comment ils disparaîtront.",
      closing:
        "Dire ces limites avant qu'on nous les oppose n'est pas de la modestie : c'est ce qui rend le reste crédible.",
    },
    publisher: {
      id: "editeur",
      title: "Qui publie",
      before: "Le hub est publié par ",
      link: "Flowera",
      after:
        ". Il s'adresse aux dirigeants, aux directeurs financiers et aux responsables d'exploitation de PME qui doivent choisir un outil d'IA sans pouvoir l'essayer sur leurs propres documents.",
    },
  },

  methodology: {
    index: {
      id: "indice",
      toc: "Indice métier",
      title: "L'indice métier",
      body: [
        "L'indice métier résume un modèle en un chiffre. Il se calcule en deux temps :",
        "- le score d'un métier est la moyenne de l'exactitude du modèle sur les benchmarks de ce métier qu'il a passés, arrondie au dixième de point ;",
        "- l'indice est la moyenne de ces scores par métier, arrondie de la même façon.",
        "Chaque métier pèse donc autant que les autres, quel que soit son nombre de benchmarks : un métier doté de trois tests ne compte pas trois fois. Un modèle qui obtient 90 % et 70 % sur les deux benchmarks d'un métier, et 50 % sur l'unique benchmark d'un autre, a pour scores 80 % et 50 %. Son indice est 65 %, et non 70 %, la moyenne des trois tests.",
        "Pas d'indice tant qu'un métier manque. Un modèle sans aucun résultat dans un métier n'a ni indice ni rang : il figure comme « Non classé », à la fin des tableaux. Un indice calculé sur une partie des métiers ne se comparerait à aucun autre.",
        "Un modèle qui ne lit pas les documents — ni image ni PDF — ne passe pas les benchmarks qui en soumettent. Dans chaque métier, il est noté sur les seuls benchmarks texte ; un métier qui n'en compterait aucun le priverait d'indice. Son indice repose donc sur moins de tests que celui des autres : le nombre de benchmarks passés est affiché à côté.",
        "L'indice n'agrège que l'exactitude. Le coût, le temps et le taux d'hallucinations d'un modèle sont des moyennes sur les benchmarks qu'il a passés, affichées à part et jamais fondues dans l'indice. Un tarif inconnu n'entre pas dans la moyenne des coûts.",
        "Le rang suit l'indice, du plus élevé au plus bas. Sur un benchmark, il suit l'exactitude.",
      ],
    },
    margin: {
      id: "marge",
      toc: "Marge d'erreur",
      title: "La marge d'erreur",
      body: [
        "Un score mesuré sur vingt-cinq documents n'est pas connu au dixième de point près. La marge d'erreur le dit : c'est la demi-largeur de l'intervalle de confiance à 95 % sur l'exactitude, en points. Quand un classement la publie, elle s'affiche à côté du score : « ± 2,1 ».",
        "Deux modèles séparés par moins que la plus grande de leurs deux marges ne sont pas départagés. Le tableau les range quand même, parce qu'il faut bien un ordre ; la page du benchmark écrit, elle, que le test ne les départage pas. Sans marge publiée, le site ne déclare aucun ex æquo.",
        "L'indice métier a sa propre marge, combinée à partir de celles des benchmarks passés : la racine de la somme de leurs carrés, divisée par leur nombre. Elle n'est publiée que si chaque benchmark passé par le modèle publie la sienne.",
        "La marge décrit le hasard du tirage des documents. Elle ne dit rien des limites du protocole, listées plus bas.",
      ],
    },
    costs: {
      id: "couts",
      toc: "Coûts et tarifs",
      title: "Coûts et tarifs",
      body: [
        "Les tarifs affichés sont les tarifs publics des modèles, en dollars par million de tokens, en entrée et en sortie. Ils sont synchronisés depuis le catalogue public de l'AI Gateway, comme les fenêtres de contexte ; dernière synchronisation le {syncedAt}.",
        "Ils restent en dollars : les convertir daterait le chiffre. Un modèle absent du catalogue porte la mention « Non communiqué » plutôt qu'un prix recopié de mémoire.",
        "Le coût par test est la moyenne des appels réussis, au tarif du jour du test : les tokens consommés par chaque appel, multipliés par le tarif du catalogue. Il est relevé à l'exécution, jamais reconstitué après coup, et recalculé depuis les tarifs publiés plutôt que lu chez le fournisseur : un lecteur du dépôt peut refaire la multiplication.",
        "Un appel en échec ne coûte rien et n'entre dans aucune moyenne. Il est compté à part, et un modèle qui échoue sur plus d'un dixième du jeu bloque la publication du classement.",
        "Le temps affiché est une médiane, pas une moyenne : un seul appel lent fausserait la moyenne.",
      ],
    },
    demo: {
      id: "demo",
      toc: "Scores de démonstration",
      title: "Scores de démonstration",
      body: [
        "Tout classement marqué « Démo » est fabriqué. Aucun modèle n'a été interrogé pour le produire. Ces classements servent à construire le site — tableaux, graphiques, pages de comparaison — avant d'y verser de vraies mesures.",
        "Le niveau d'un modèle y est déduit de deux faits publics : son prix d'entrée, sur une échelle logarithmique, et sa date de sortie. Plus cher et plus récent, donc meilleur — en moyenne. S'y ajoutent une difficulté propre à chaque benchmark, une affinité entre chaque labo et chaque métier, et un aléa propre à chaque couple modèle-benchmark. Ces aléas sont déterministes : relancé, le générateur produit les mêmes chiffres.",
        "Pourquoi le prix et la date ? Pour ne glisser aucune opinion sur tel ou tel labo dans des données factices. Le classement qui en sort ressemble à un vrai classement, ce qui suffit pour construire le site, et ne prétend rien de plus. Un modèle premier ici est cher et récent ; cela ne dit rien de ce qu'il vaut.",
        "Les autres colonnes sont fabriquées de la même façon : le coût à partir du tarif public et d'un nombre de tokens tiré pour chaque benchmark, le temps à partir du prix, le taux d'hallucinations à partir d'un trait tiré pour chaque modèle, la marge d'erreur à partir du score et de la taille de l'échantillon. L'historique des runs passés l'est aussi.",
      ],
      /** Affiché quand le dépôt contient des réponses brutes de démonstration. */
      panel:
        "Des réponses brutes de démonstration n'existent que pour la lecture de factures, et pour un panel de {panel} modèles : chez chaque labo doté d'une couleur dans les graphiques, le modèle le plus récent qui lit les images. Elles sont inventées elles aussi, avec un taux d'erreur calé sur le classement de démonstration.",
      ending:
        "Tout cela disparaît benchmark par benchmark. Quand le vrai pipeline publie un benchmark, son classement remplace le fichier de démonstration : la marque « Démo » tombe pour ce benchmark, et ses chiffres deviennent recalculables à partir des réponses brutes du dépôt. Le bandeau en haut du site reste affiché tant qu'un seul classement de démonstration subsiste.",
      statusSome: "À ce jour, {demo} des {total} classements publiés sont des démonstrations.",
      statusNone: "À ce jour, plus aucun classement publié n'est une démonstration.",
    },
    maturity: {
      id: "protocoles",
      toc: "Protocoles",
      title: "Protocole exécutable ou en préparation",
      body: [
        "Chaque benchmark porte l'une de ces deux mentions :",
        "- Protocole exécutable : la tâche se joue de bout en bout. Sa définition, son barème, son prompt, ses documents et leurs vérités terrain sont dans le dépôt ; n'importe qui peut relancer le pipeline et retrouver les chiffres.",
        "- Protocole en préparation : le protocole est rédigé — la question posée, ce que reçoit le modèle, les sous-tâches, la taille de l'échantillon — mais le jeu de test reste à construire.",
        "Protocoles exécutables à ce jour : {executables} sur {total} ({names}).",
        "La mention est indépendante de la marque « Démo » : un protocole exécutable affiche des scores de démonstration tant qu'aucun vrai run n'a été publié.",
      ],
    },
    invoiceIntro:
      "Les sections qui suivent documentent le protocole de la lecture de factures françaises : ses limites, son barème, ses verdicts, son prompt et son dernier run.",
    limits: {
      id: "limites",
      toc: "Limites du test",
      title: "Ce que ce test ne mesure pas",
      body: [
        "- Un seul prompt par modèle. Un prompt travaillé pour un modèle donné améliorerait ses résultats ; nous mesurons ce que donne une intégration standard.",
        "- Aucun ajustement fin, aucun OCR spécialisé en amont. Une chaîne de traitement dédiée ferait mieux.",
        "- Des factures fabriquées, pas des factures réelles anonymisées. Le dépôt est public : maquiller de vrais documents client laisserait des traces.",
        "- Des images, pas des PDF avec couche texte. Un PDF natif est plus facile à lire pour un modèle : les scores publiés sont un plancher, pas un plafond.",
        "- Vingt-cinq documents, pas dix mille. Assez pour classer, pas pour mesurer un écart de deux points.",
      ],
    },
    scoring: {
      id: "bareme",
      toc: "Barème",
      title: "Le barème",
      body: [
        "Les champs sont pesés par ce qu'une erreur coûte en comptabilité, pas par leur difficulté technique. Un champ critique faux fait basculer toute la facture en « à relire ».",
      ],
      after: [
        "Un champ vaut son poids ou zéro, sans demi-point. L'exactitude est la somme des points obtenus rapportée au total possible. Une facture passe « sans relecture » quand aucun de ses champs critiques n'est faux, manquant ou inventé ; une facture que le modèle n'a pas réussi à traiter ne passe pas.",
        "La comparaison est tatillonne là où le métier l'est : les montants se comparent au centime, et une date écrite 03/04/2026 est lue comme le 3 avril, jamais comme le 4 mars. Elle est indulgente là où il l'est aussi : un identifiant s'écrit avec ou sans espaces, et l'ordre des lignes de facturation ne compte pas.",
      ],
    },
    verdicts: {
      id: "verdicts",
      toc: "Trois verdicts",
      title: "Les trois verdicts",
      body: [
        "Un champ absent du document fait partie du test. Répondre « rien » quand il n'y a rien est compté comme une bonne réponse ; produire une valeur l'est comme une hallucination, comptée à part du reste et jamais fondue dans une note globale.",
        "- Juste : la valeur du document, ou « rien » quand le document ne contient rien.",
        "- Faux ou manquant : une autre valeur que celle du document, ou rien alors que l'information y figurait.",
        "- Halluciné : une valeur là où le document n'en contient aucune.",
        "Seul un champ juste rapporte des points. L'hallucination alimente en plus sa propre mesure : la part des champs réellement absents que le modèle a quand même remplis. Un modèle qui écrit « non trouvé » ou « n/a » s'abstient correctement : sa réponse est ramenée à « rien » avant d'être notée.",
        "Avant publication, un humain relit toutes les hallucinations, les réponses jugées justes mais écrites autrement que la référence, et un échantillon de 10 % des réponses jugées justes. Son verdict prime sur celui du code.",
      ],
    },
    prompt: {
      id: "prompt",
      toc: "Prompt",
      title: "Le prompt, intégralement",
      body: ["Envoyé tel quel à chaque modèle, avec l'image de la facture."],
    },
    run: {
      id: "run",
      toc: "Ce test",
      title: "Ce test",
      body: [] as string[],
    },
  },
};

const en: typeof fr = {
  about: {
    sections: [
      {
        id: "angle-mort",
        title: "What public leaderboards do not measure",
        body: [
          "Public AI leaderboards measure academic exams. They tell you which model reasons best on that ground, and that is worth knowing. It is not what a company needs to know to choose a tool.",
          "An SME buying a tool is asking other questions:",
          "- how many of its invoices will go through without correction;",
          "- how much each one will cost;",
          "- how often the model will invent a figure that is not on the document.",
          "No exam score answers them. The hub is built to answer them — for invoices first, then for the company's other business functions.",
        ],
      },
      {
        id: "construction",
        title: "What we build",
        body: [
          "Concrete business tasks, grouped by business function: finance, accounting, human resources, legal, sales, marketing, customer service, procurement, IT, management. Each benchmark starts from a question an executive would ask — how many of your invoices will go through without a human fixing them? — not from some abstract capability of the model.",
          "Four measures, published side by side and never melted into a single score:",
          "- No review needed: the share of cases handled with nothing for a human to fix.",
          "- Accuracy: the points earned across all graded items, weighted by how critical they are.",
          "- Hallucinations: items invented where the source contains nothing.",
          "- Cost and time: per test case, at public prices on the day of the test.",
          "A model can come first on accuracy and be unusable because it makes things up. A single score would hide exactly that. The site's one overall figure, the Business Index, aggregates accuracy alone, with every business function weighing the same.",
          "Three verdicts rather than two. A field absent from the document is part of the test: an invoice under the VAT exemption has no VAT rate, and answering “nothing” is then the right answer. So a field is correct, wrong or missing, or hallucinated — the model produced a value where the document contains none. An invented figure costs more than a missing one, because it gets through review.",
        ],
      },
      {
        id: "verifiable",
        title: "Everything can be checked",
        body: [
          "The prompt sent, the documents submitted, each model's raw answers, the scoring grid and the scoring code are published in the repository. Every measured figure can be recomputed from there.",
          "A run is a timestamped, immutable folder. Adding a model creates a new run; earlier ones remain available. The exact version of the model that answered is recorded at run time, never typed in by hand: six months from now, the same commercial name may no longer point to the same model.",
          "The steps are kept separate on purpose: query the models, apply the grid, settle the doubtful cases, freeze the ranking. Changing the grid and rescoring costs no API call: raw answers are kept, which is what keeps comparisons over time honest.",
          "The site itself calls no model. It reads frozen results, and refuses to build if a data file is invalid: better no site than a half-displayed ranking.",
        ],
      },
    ],
    limits: {
      id: "limites",
      title: "Acknowledged limits",
      body: [
        "One prompt per model, no fine-tuning, no specialised OCR upstream, images rather than PDFs with a text layer, and twenty-five documents rather than ten thousand. Published scores are a floor, not a ceiling.",
      ],
      progress:
        "Two limits come from how far along the project is. Protocols that can be run end to end today: {executables} of {total} ({names}); the others are written, and their test sets have still to be built. And the scores on display are demonstration scores, marked as such wherever they appear: the methodology explains how they are fabricated, and how they will disappear.",
      closing:
        "Stating these limits before anyone throws them back at us is not modesty: it is what makes the rest credible.",
    },
    publisher: {
      id: "editeur",
      title: "Who publishes it",
      before: "The hub is published by ",
      link: "Flowera",
      after:
        ". It is meant for the executives, finance directors and operations managers of SMEs who have to choose an AI tool without being able to try it on their own documents.",
    },
  },

  methodology: {
    index: {
      id: "indice",
      toc: "Business Index",
      title: "The Business Index",
      body: [
        "The Business Index sums a model up in one figure. It is computed in two steps:",
        "- a business function's score is the mean of the model's accuracy on the benchmarks it took in that function, rounded to a tenth of a point;",
        "- the index is the mean of those per-function scores, rounded the same way.",
        "So every business function weighs the same, however many benchmarks it has: a function with three tests does not count three times. A model scoring 90% and 70% on one function's two benchmarks, and 50% on another's only benchmark, has function scores of 80% and 50%. Its index is 65%, not 70%, the mean of the three tests.",
        "No index while a business function is missing. A model with no result at all in one function has neither an index nor a rank: it appears as “Not ranked”, at the bottom of the tables. An index computed over some of the functions could not be compared with any other.",
        "A model that cannot read documents — neither images nor PDFs — does not take the benchmarks that submit one. Within each business function, it is scored on the text benchmarks alone; a function with none would leave it without an index. Its index therefore rests on fewer tests than the others': the number of benchmarks taken is shown alongside.",
        "The index aggregates accuracy alone. A model's cost, time and hallucination rate are means over the benchmarks it took, shown separately and never melted into the index. An unknown price stays out of the cost mean.",
        "Rank follows the index, from highest to lowest. On a benchmark, it follows accuracy.",
      ],
    },
    margin: {
      id: "marge",
      toc: "Margin of error",
      title: "The margin of error",
      body: [
        "A score measured on twenty-five documents is not known to a tenth of a point. The margin of error says so: it is the half-width of the 95% confidence interval on accuracy, in points. When a ranking publishes it, it is shown next to the score: “± 2.1”.",
        "Two models separated by less than the larger of their two margins are not told apart. The table still puts them in order, because some order is needed; the benchmark page, for its part, states that the test does not separate them. With no published margin, the site declares no tie.",
        "The Business Index has a margin of its own, combined from those of the benchmarks taken: the square root of the sum of their squares, divided by their number. It is published only if every benchmark the model took publishes one.",
        "The margin describes the luck of the draw in the documents. It says nothing about the limits of the protocol, listed further down.",
      ],
    },
    costs: {
      id: "couts",
      toc: "Costs and prices",
      title: "Costs and prices",
      body: [
        "The prices shown are the models' public prices, in dollars per million tokens, for input and output. They are synced from the AI Gateway's public catalogue, as are context windows; last synced on {syncedAt}.",
        "They stay in dollars: converting them would date the figure. A model missing from the catalogue is labelled “Undisclosed” rather than given a price copied from memory.",
        "Cost per test is the mean of successful calls, at the price on the day of the test: the tokens each call consumed, multiplied by the catalogue price. It is recorded at run time, never reconstructed afterwards, and recomputed from published prices rather than read from the provider: anyone reading the repository can redo the multiplication.",
        "A failed call costs nothing and enters no average. It is counted separately, and a model that fails on more than a tenth of the set blocks publication of the ranking.",
        "The time shown is a median, not a mean: a single slow call would skew the mean.",
      ],
    },
    demo: {
      id: "demo",
      toc: "Demonstration scores",
      title: "Demonstration scores",
      body: [
        "Any ranking marked “Demo” is fabricated. No model was queried to produce it. These rankings exist to build the site — tables, charts, comparison pages — before real measurements are poured in.",
        "A model's level is derived from two public facts: its input price, on a logarithmic scale, and its release date. Pricier and more recent, hence better — on average. On top of that come a difficulty specific to each benchmark, an affinity between each lab and each business function, and noise specific to each model-benchmark pair. All of it is deterministic: run the generator again and it produces the same figures.",
        "Why price and date? So as not to slip any opinion about this or that lab into fake data. What comes out looks like a real ranking, which is enough to build the site, and claims nothing more. A model that comes first here is expensive and recent; that says nothing about what it is worth.",
        "The other columns are fabricated the same way: cost from the public price and a token count drawn for each benchmark, time from the price, the hallucination rate from a trait drawn for each model, the margin of error from the score and the sample size. The history of past runs is fabricated too.",
      ],
      panel:
        "Demonstration raw answers exist only for invoice reading, and for a panel of {panel} models: for each lab with a colour in the charts, its most recent model that can read images. They are invented too, with an error rate matched to the demonstration ranking.",
      ending:
        "All of this goes away benchmark by benchmark. When the real pipeline publishes a benchmark, its ranking replaces the demonstration file: the “Demo” mark drops for that benchmark, and its figures can then be recomputed from the raw answers in the repository. The banner at the top of the site stays for as long as a single demonstration ranking remains.",
      statusSome: "As of today, {demo} of the {total} published rankings are demonstrations.",
      statusNone: "As of today, no published ranking is a demonstration any longer.",
    },
    maturity: {
      id: "protocoles",
      toc: "Protocols",
      title: "Runnable protocol or protocol in preparation",
      body: [
        "Every benchmark carries one of these two labels:",
        "- Runnable protocol: the task runs end to end. Its definition, scoring grid, prompt, documents and ground truths are in the repository; anyone can rerun the pipeline and get the same figures.",
        "- Protocol in preparation: the protocol is written — the question asked, what the model receives, the subtasks, the sample size — but the test set has still to be built.",
        "Runnable protocols as of today: {executables} of {total} ({names}).",
        "The label is independent of the “Demo” mark: a runnable protocol shows demonstration scores for as long as no real run has been published.",
      ],
    },
    invoiceIntro:
      "The sections below document the protocol for French invoice reading: its limits, its scoring grid, its verdicts, its prompt and its latest run.",
    limits: {
      id: "limites",
      toc: "Limits of the test",
      title: "What this test does not measure",
      body: [
        "- One prompt per model. A prompt tuned for a given model would improve its results; we measure what a standard integration gives.",
        "- No fine-tuning, no specialised OCR upstream. A dedicated processing chain would do better.",
        "- Fabricated invoices, not real ones anonymised. The repository is public: disguising real client documents would leave traces.",
        "- Images, not PDFs with a text layer. A native PDF is easier for a model to read: published scores are a floor, not a ceiling.",
        "- Twenty-five documents, not ten thousand. Enough to rank, not to measure a two-point gap.",
      ],
    },
    scoring: {
      id: "bareme",
      toc: "Scoring grid",
      title: "The scoring grid",
      body: [
        "Fields are weighted by what a mistake costs in accounting, not by how technically hard they are. One critical field wrong drops the whole invoice into “needs review”.",
      ],
      after: [
        "A field is worth its weight or zero, with no half points. Accuracy is the sum of points earned over the total possible. An invoice counts as “no review needed” when none of its critical fields is wrong, missing or invented; an invoice the model failed to process does not count.",
        "The comparison is fussy where the business is fussy: amounts are compared to the cent, and a date written 03/04/2026 is read as 3 April, never 4 March. It is lenient where the business is lenient too: an identifier may be written with or without spaces, and the order of line items does not matter.",
      ],
    },
    verdicts: {
      id: "verdicts",
      toc: "Three verdicts",
      title: "The three verdicts",
      body: [
        "A field absent from the document is part of the test. Answering “nothing” when there is nothing counts as a right answer; producing a value counts as a hallucination, tallied separately from the rest and never melted into an overall score.",
        "- Correct: the value on the document, or “nothing” when the document contains nothing.",
        "- Wrong or missing: a value other than the one on the document, or nothing when the information was there.",
        "- Hallucinated: a value where the document contains none.",
        "Only a correct field earns points. A hallucination also feeds a measure of its own: the share of genuinely absent fields that the model filled in anyway. A model that writes “non trouvé” or “n/a” is abstaining correctly: its answer is reduced to “nothing” before it is scored.",
        "Before publication, a human reviews every hallucination, the answers judged correct but written differently from the reference, and a 10% sample of the answers judged correct. That verdict prevails over the code's.",
      ],
    },
    prompt: {
      id: "prompt",
      toc: "Prompt",
      title: "The prompt, in full",
      body: ["Sent as is to every model, along with the image of the invoice. The test set is French, and so is the prompt."],
    },
    run: {
      id: "run",
      toc: "This test",
      title: "This test",
      body: [],
    },
  },
};

export const content = { fr, en };
