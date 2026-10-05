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
        "L'indice ne porte que sur les métiers déjà mesurés. Un métier dont aucun benchmark n'a encore été joué n'entre pas dans le calcul : il ne compte pas comme un zéro, il ne compte pas du tout. Combien de métiers l'indice couvre est écrit à côté de lui, parce qu'un indice sur un métier ne vaut pas un indice sur dix.",
        "En revanche, un modèle absent d'un métier que les autres ont passé n'a ni indice ni rang : il figure comme « Non classé », à la fin des tableaux. Son indice ne se comparerait à aucun autre.",
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
        "Un score mesuré sur quelques dizaines de documents n'est pas connu au dixième de point près. La marge d'erreur le dit : c'est la demi-largeur de l'intervalle de confiance à 95 % sur l'exactitude, en points. Quand un classement la publie, elle s'affiche à côté du score : « ± 2,1 ».",
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
        "Les tarifs affichés sont les tarifs publics des modèles, en dollars par million de tokens, en entrée et en sortie. Ils sont synchronisés depuis le catalogue public d'OpenRouter — la passerelle par laquelle les appels sont réellement facturés — comme les fenêtres de contexte ; dernière synchronisation le {syncedAt}.",
        "Ils restent en dollars : les convertir daterait le chiffre. Un modèle absent du catalogue porte la mention « Non communiqué » plutôt qu'un prix recopié de mémoire.",
        "Le coût par test est la moyenne des appels réussis, au tarif du jour du test : les tokens consommés par chaque appel, multipliés par le tarif du catalogue. Il est relevé à l'exécution, jamais reconstitué après coup, et recalculé depuis les tarifs publiés plutôt que lu chez le fournisseur : un lecteur du dépôt peut refaire la multiplication.",
        "Un appel en échec n'entre dans aucune moyenne, et il est compté à part. Un modèle qui échoue sur plus d'un dixième du jeu bloque la publication du classement.",
        "Un échec peut malgré tout avoir été facturé : un modèle qui répond puis dépasse la limite de longueur consomme des tokens sans rendre de résultat exploitable. Ces appels sont enregistrés avec leur coût, pour que le total dépensé soit exact, mais ils ne pèsent pas sur le coût par test d'un modèle.",
        "Les échecs ne pénalisent pas la note d'un modèle. Dans ce projet, ceux qu'on a observés venaient du quota du compte, du crédit réservé par les appels simultanés ou d'un hébergeur en panne — de notre côté, donc. Leur nombre reste affiché dans le classement : un modèle qui échouerait pour une raison qui lui est propre doit se voir.",
        "Le temps affiché est une médiane, pas une moyenne : un seul appel lent fausserait la moyenne.",
      ],
    },
    demo: {
      id: "verification",
      toc: "Comment on vérifie",
      title: "Comment une réponse est vérifiée",
      body: [
        "Interroger un modèle est la partie facile. Tout le reste tient dans une question : comment sait-on que sa réponse est bonne ?",
        "Aucune IA n'évalue une IA. La référence est écrite par des humains, avant le test et sans connaître les modèles qui y passeront. Pour les factures, ce sont des journalistes qui ont saisi chaque champ à la main. Faire juger un modèle par un autre modèle reviendrait à mesurer leur accord, pas leur justesse.",
        "La comparaison est faite par un programme écrit à la main, champ par champ, selon la nature de l'information :",
        "- un montant est ramené à un nombre, puis comparé au centime près ;",
        "- une date est ramenée à l'année-mois-jour depuis la dizaine de formes que les modèles emploient — « 12/03/2020 », « March 12, 2020 », « 2020-03-12 » — en appliquant la convention de lecture du pays du document, et non celle du lecteur ;",
        "- un identifiant ou un nom est comparé après normalisation : accents, espaces, ponctuation, abréviations courantes ;",
        "- une liste de lignes est appariée ligne à ligne, l'ordre ne comptant pas.",
        "Ce programme ne devine jamais. Quand il ne sait pas trancher — une valeur illisible dans la référence, une forme qu'il ne reconnaît pas — la réponse part en relecture humaine plutôt que d'être comptée comme fausse. Une référence qu'on ne sait pas lire fait échouer la préparation du test : sans cette règle, elle deviendrait un « rien » silencieux, et un modèle qui a correctement lu le document serait accusé d'avoir inventé.",
        "Le même document, le même prompt, les mêmes conditions pour tous les modèles. Un document que l'un des fournisseurs refuse — trop de pages, trop de pixels — est retiré du test pour tout le monde, pas seulement pour lui : un classement doit comparer des modèles, pas des sous-ensembles de documents.",
        "Les questions ambiguës sont écartées, pas corrigées après coup. Si un champ admet plusieurs réponses défendables, le noter mesure si le modèle devine ce que nous voulions, pas s'il sait lire. Le champ est alors retiré du barème et la raison est écrite dans le barème lui-même ; les réponses des modèles restent publiées.",
        "Enfin, les quatre étapes du pipeline sont séparées et immuables : appeler les modèles, noter, arbitrer, publier. Les réponses brutes sont écrites une fois pour toutes, et renoter ne coûte pas un appel. C'est ce qui permet de corriger un barème sans jamais retoucher une réponse.",
      ],
      panel: "Les réponses brutes des {panel} modèles interrogés sont dans le dépôt, un dossier par modèle : n'importe qui peut refaire la notation et retrouver les chiffres publiés.",
      ending: "Rien de ce que le site affiche n'est fabriqué. Une tâche est mesurée et porte ses chiffres, ou elle est au programme et n'en porte aucun.",
      statusSome: "À ce jour, {demo} des {total} classements publiés sont des démonstrations.",
      statusNone: "À ce jour, aucun classement publié n'est une démonstration : tous les chiffres du site viennent d'appels réellement passés.",
    },
    maturity: {
      id: "protocoles",
      toc: "Protocoles",
      title: "Mesuré ou à venir",
      body: [
        "Chaque benchmark porte l'une de ces deux mentions :",
        "- Protocole exécutable : la tâche se joue de bout en bout et porte des chiffres mesurés. Sa définition, son barème, son prompt, ses documents et leurs annotations sont dans le dépôt ; n'importe qui peut relancer le pipeline et retrouver les chiffres.",
        "- À venir : le protocole est rédigé — la question posée, ce que reçoit le modèle, les sous-tâches, la taille d'échantillon visée — mais le jeu de test reste à construire. Aucun chiffre n'est affiché.",
        "Mesurés à ce jour : {executables} sur {total} ({names}).",
        "Une tâche à venir dit ce qui lui manque, parce que les causes ne s'équivalent pas : un jeu public réel et annoté qu'il reste à intégrer ; une tâche dont aucune référence publique ne donne la bonne réponse, et qui demande donc une grille de notation et un arbitrage humain ; ou des documents qui ne sortent jamais des entreprises, et qu'il faudra collecter auprès de partenaires avec leur accord.",
        "Pourquoi publier un protocole avant ses résultats ? Parce qu'il ne pourra plus être retouché ensuite pour arranger un classement, et parce qu'il se discute mieux avant qu'après.",
      ],
    },
    invoiceIntro:
      "Les sections qui suivent documentent le seul protocole mesuré à ce jour, la lecture de factures : ses limites, son barème, ses verdicts, son prompt et son dernier run.",
    limits: {
      id: "limites",
      toc: "Limites du test",
      title: "Ce que ce test ne mesure pas",
      body: [
        "- Un seul prompt par modèle. Un prompt travaillé pour un modèle donné améliorerait ses résultats ; nous mesurons ce que donne une intégration standard.",
        "- Aucun ajustement fin, aucun OCR spécialisé en amont. Une chaîne de traitement dédiée ferait mieux.",
        "- Cent documents, pas dix mille. Assez pour voir un écart de vingt points, pas pour départager deux modèles séparés d'un point. La marge d'erreur de chaque score le dit.",
        "- Des factures américaines, en anglais, et d'un seul secteur : l'achat d'espace publicitaire télévisé. Rien ne garantit que ces résultats se transposent à une facture française.",
        "- Des images, pas des PDF avec couche texte. Un PDF natif est plus facile à lire pour un modèle : les scores publiés sont un plancher, pas un plafond.",
        "- Deux champs notés. Les autres champs de ces factures admettent plusieurs réponses défendables — six identifiants concurrents, deux périodes distinctes — et la question ne leur est plus posée.",
        "- Pas de lignes de facturation. C'est la vraie difficulté du métier, et l'annotation d'origine ne la couvre pas : il faudrait construire notre propre référence.",
        "- Une tâche plus facile que prévu. Vingt-cinq modèles sur vingt-sept dépassent 97 % : ce test les sépare mal, et il faut le lire comme un seuil d'entrée plutôt que comme un palmarès.",
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
        "La comparaison est tatillonne là où le métier l'est : les montants se comparent au centime. Elle est indulgente là où il l'est aussi : un identifiant s'écrit avec ou sans espaces, et l'ordre des lignes de facturation ne compte pas.",
        "Les dates suivent la convention du pays du document, déclarée champ par champ dans le barème. Sur ces factures américaines, 03/04/2020 est lu comme le 4 mars ; sur une facture française, la même écriture désignerait le 3 avril. Lire une date américaine à la française avait d'ailleurs produit, sur un premier essai, une vingtaine d'erreurs attribuées à tort aux modèles.",
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
        "Le code n'a pas le dernier mot. Une étape d'arbitrage humain sélectionne les réponses à relire — toutes les hallucinations, celles jugées justes mais écrites autrement que la référence, et un échantillon des autres — et le verdict de l'humain remplace celui du code dans le calcul.",
        "Sur le run publié, cette étape n'a pas encore été jouée : les chiffres affichés sont ceux du comparateur seul. 80 notations sur 2700 sont marquées « à relire », et le classement le dira autrement quand elles auront été arbitrées. Le dire plutôt que de laisser croire à une relecture qui n'a pas eu lieu fait partie du protocole.",
      ],
    },
    prompt: {
      id: "prompt",
      toc: "Prompt",
      title: "Le prompt, intégralement",
      body: ["Envoyé tel quel à chaque modèle, avec les pages scannées de la facture. Le même pour les vingt-sept, sans un mot de différence."],
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
        "The index covers only the business functions already measured. A function whose benchmarks have not been run does not enter the computation: it does not count as a zero, it does not count at all. How many functions the index covers is written next to it, because an index over one function is not worth an index over ten.",
        "A model missing from a function the others took, however, has neither an index nor a rank: it appears as “Not ranked”, at the bottom of the tables. Its index could not be compared with any other.",
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
        "A score measured on a few dozen documents is not known to a tenth of a point. The margin of error says so: it is the half-width of the 95% confidence interval on accuracy, in points. When a ranking publishes it, it is shown next to the score: “± 2.1”.",
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
        "The prices shown are the models' public prices, in dollars per million tokens, for input and output. They are synced from OpenRouter's public catalogue — the gateway the calls are actually billed through — as are context windows; last synced on {syncedAt}.",
        "They stay in dollars: converting them would date the figure. A model missing from the catalogue is labelled “Undisclosed” rather than given a price copied from memory.",
        "Cost per test is the mean of successful calls, at the price on the day of the test: the tokens each call consumed, multiplied by the catalogue price. It is recorded at run time, never reconstructed afterwards, and recomputed from published prices rather than read from the provider: anyone reading the repository can redo the multiplication.",
        "A failed call enters no average, and is counted separately. A model that fails on more than a tenth of the set blocks publication of the ranking.",
        "A failure may still have been billed: a model that answers and then exceeds the length limit consumes tokens without returning a usable result. Those calls are recorded with their cost, so that the total spent is accurate, but they do not weigh on a model's cost per test.",
        "Failures do not penalise a model's score. In this project, the ones we observed came from the account quota, from credit reserved by concurrent calls, or from a host being down — from our side, that is. Their number stays in the ranking: a model failing for a reason of its own has to be visible.",
        "The time shown is a median, not a mean: a single slow call would skew the mean.",
      ],
    },
    demo: {
      id: "verification",
      toc: "How we verify",
      title: "How an answer is verified",
      body: [
        "Querying a model is the easy part. Everything else comes down to one question: how do we know its answer is right?",
        "No AI grades an AI. The reference is written by humans, before the test and without knowing which models will take it. For the invoices, journalists entered every field by hand. Having one model judge another would measure their agreement, not their correctness.",
        "The comparison is done by a hand-written program, field by field, according to the nature of the information:",
        "- an amount is reduced to a number, then compared to the cent;",
        "- a date is reduced to year-month-day from the dozen forms models use — “12/03/2020”, “March 12, 2020”, “2020-03-12” — applying the reading convention of the document's country, not the reader's;",
        "- an identifier or a name is compared after normalisation: accents, spaces, punctuation, common abbreviations;",
        "- a list of line items is matched line by line, order not counting.",
        "This program never guesses. When it cannot decide — an unreadable value in the reference, a form it does not recognise — the answer goes to human review rather than being counted wrong. A reference we cannot read fails the preparation of the test: without that rule it would become a silent “nothing”, and a model that read the document correctly would be accused of inventing.",
        "The same document, the same prompt, the same conditions for every model. A document one provider refuses — too many pages, too many pixels — is dropped from the test for everyone, not just for that provider: a ranking must compare models, not subsets of documents.",
        "Ambiguous questions are excluded, not patched afterwards. If a field admits several defensible answers, scoring it measures whether the model guesses what we wanted, not whether it can read. The field is then removed from the rubric and the reason is written into the rubric itself; the models' answers stay published.",
        "Finally, the pipeline's four stages are separate and immutable: call the models, score, arbitrate, publish. Raw answers are written once and for all, and re-scoring costs no call. That is what makes it possible to fix a rubric without ever touching an answer.",
      ],
      panel: "The raw answers of all {panel} models queried are in the repository, one folder per model: anyone can redo the scoring and get the published figures back.",
      ending: "Nothing the site displays is fabricated. A task is measured and carries its figures, or it is on the roadmap and carries none.",
      statusSome: "As of today, {demo} of the {total} published rankings are demonstrations.",
      statusNone: "As of today, no published ranking is a demonstration: every figure on the site comes from calls actually made.",
    },
    maturity: {
      id: "protocoles",
      toc: "Protocols",
      title: "Measured or coming",
      body: [
        "Every benchmark carries one of these two labels:",
        "- Runnable protocol: the task runs end to end and carries measured figures. Its definition, scoring grid, prompt, documents and annotations are in the repository; anyone can rerun the pipeline and get the same figures.",
        "- Coming: the protocol is written — the question asked, what the model receives, the subtasks, the target sample size — but the test set has still to be built. No figure is shown.",
        "Measured as of today: {executables} of {total} ({names}).",
        "A task that is coming states what it is waiting for, because the causes are not equivalent: a real, annotated public dataset still to be wired in; a task for which no public reference gives the right answer, and which therefore needs a scoring rubric and human arbitration; or documents that never leave the company, to be collected from partners with their consent.",
        "Why publish a protocol before its results? Because it can no longer be adjusted afterwards to suit a ranking, and because it is easier to challenge before than after.",
      ],
    },
    invoiceIntro:
      "The sections below document the only protocol measured so far, invoice reading: its limits, its scoring grid, its verdicts, its prompt and its latest run.",
    limits: {
      id: "limites",
      toc: "Limits of the test",
      title: "What this test does not measure",
      body: [
        "- One prompt per model. A prompt tuned for a given model would improve its results; we measure what a standard integration gives.",
        "- No fine-tuning, no specialised OCR upstream. A dedicated processing chain would do better.",
        "- One hundred documents, not ten thousand. Enough to see a twenty-point gap, not to separate two models one point apart. Each score's margin of error says so.",
        "- American invoices, in English, from a single sector: television advertising buys. Nothing guarantees these results carry over to a French invoice.",
        "- Images, not PDFs with a text layer. A native PDF is easier for a model to read: published scores are a floor, not a ceiling.",
        "- Two scored fields. The other fields on these invoices admit several defensible answers — six competing identifiers, two distinct periods — and the question is no longer asked.",
        "- No line items. That is the real difficulty of the job, and the original annotation does not cover it: we would have to build our own reference.",
        "- A task easier than expected. Twenty-five models out of twenty-seven exceed 97%: this test separates them poorly, and should be read as an entry threshold rather than a ranking.",
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
        "The comparison is fussy where the business is fussy: amounts are compared to the cent. It is lenient where the business is lenient too: an identifier may be written with or without spaces, and the order of line items does not matter.",
        "Dates follow the convention of the document's country, declared field by field in the rubric. On these American invoices, 03/04/2020 is read as 4 March; on a French invoice the same writing would mean 3 April. Reading an American date the French way had in fact produced, on a first attempt, some twenty errors wrongly blamed on the models.",
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
        "The code does not have the last word. A human arbitration stage selects the answers to review — every hallucination, those judged correct but written differently from the reference, and a sample of the rest — and the human's verdict replaces the code's in the computation.",
        "On the published run, that stage has not been played yet: the figures shown are the comparator's alone. 80 of the 2700 gradings are flagged “needs review”, and the ranking will say otherwise once they have been arbitrated. Saying so, rather than implying a review that did not happen, is part of the protocol.",
      ],
    },
    prompt: {
      id: "prompt",
      toc: "Prompt",
      title: "The prompt, in full",
      body: ["Sent as is to every model, along with the scanned pages of the invoice. The same for all twenty-seven, without a word of difference."],
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
