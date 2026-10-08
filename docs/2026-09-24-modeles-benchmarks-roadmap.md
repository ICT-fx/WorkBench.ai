# Hub d'évaluations métier — modèles, benchmarks, roadmap

**24 septembre 2026** · document de cadrage, à valider
*Révisé le 26/09 : 27 modèles, catégories renommées, passage à OpenRouter.*
*Révisé le 07/10 : deux sources vérifiées sur pièces — FinanceBench est sous licence non commerciale, et la base CFPB ne fournit plus le texte des réclamations.*

Trois questions traitées ici : quels modèles tester, dans quel ordre construire les
benchmarks et lesquels sont réellement testables, et par quelle API passer.

---

# 1. Les modèles : 27 modèles, quatre questions

## Le tri de départ

Un seul critère élimine d'office : **savoir lire une image**. Six de tes dix métiers
reposent sur des documents. Sur les 458 modèles du catalogue OpenRouter, 288 en sont
capables ; les autres sont hors-jeu.

On écarte ensuite les versions anciennes d'une même famille — comparer GPT-5.2, 5.4 et 5.5
n'apprend rien à un dirigeant — et les versions « preview », qui changent sans prévenir et
rendent un classement daté invérifiable.

Deux principes de sélection s'ajoutent, et ils tirent dans des directions opposées :

- **Les modèles que tout le monde connaît doivent être là.** Si un lecteur cherche Claude
  Sonnet, Gemini, Llama, Mistral Large ou DeepSeek et ne les trouve pas, il doute du
  sérieux du classement avant même de lire les chiffres.
- **Les modèles hors de prix aussi.** Aucune PME ne déploiera Fable 5.1 à 10 $ le million
  de tokens. Mais sans lui, on ne sait pas si les modèles abordables sont *presque* aussi
  bons ou très loin derrière. C'est l'étalon qui donne son sens à tout le reste.

## Les quatre groupes

Chaque groupe répond à une question qu'on te posera. Ce ne sont pas des niveaux de
qualité : un modèle du groupe D peut très bien battre un modèle du groupe A sur la lecture
de factures. C'est précisément ce que le hub cherche à savoir.

### Groupe A — Ce que l'IA sait faire de mieux, prix mis de côté

*La question : « À quoi ressemble le meilleur résultat possible aujourd'hui ? »*
Ces modèles servent de référence haute. Personne ne les industrialise, tout le monde veut
savoir où ils en sont.

| Modèle | Fournisseur | Entrée | Sortie | Pourquoi lui |
|---|---|---:|---:|---|
| `anthropic/claude-fable-5.1` | Anthropic (US) | 10.00 $ | 50.00 $ | Le plus cher du marché. Trop cher pour un usage courant, mais c'est l'étalon : il montre ce que l'IA sait faire au mieux |
| `openai/gpt-6-astra` | OpenAI (US) | 10.00 $ | 50.00 $ | Le sommet d'OpenAI |
| `qwen/qwen3.8-max-prime` | Alibaba (CN) | 4.00 $ | 12.00 $ | Le sommet chinois, deux fois moins cher que ses rivaux américains |
| `anthropic/claude-opus-5.5` | Anthropic (US) | 4.00 $ | 20.00 $ | Le haut de gamme courant d'Anthropic |
| `moonshotai/kimi-k3` | Moonshot (CN) | 3.00 $ | 15.00 $ | Réputé sur les documents très longs |
| `x-ai/grok-4.7` | xAI (US) | 1.60 $ | 4.80 $ | Le haut de gamme de xAI |

### Groupe B — Le bon rapport qualité-prix, ceux qu'on déploie vraiment

*La question : « Lequel je mets en production le mois prochain ? »*
Le cœur du marché, et les noms que tes lecteurs connaissent.

| Modèle | Fournisseur | Entrée | Sortie | Pourquoi lui |
|---|---|---:|---:|---|
| `openai/gpt-6-sol` | OpenAI (US) | 2.00 $ | 10.00 $ | Le GPT que la plupart des entreprises déploieront : cinq fois moins cher que le sommet |
| `anthropic/claude-sonnet-5` | Anthropic (US) | 2.00 $ | 10.00 $ | Le Claude du quotidien, le nom que tout le monde cite |
| `qwen/qwen3.8-max-0902` | Alibaba (CN) | 2.00 $ | 6.00 $ | Le Qwen haut de gamme de série |
| `meta/muse-spark-1.3` | Meta (US) | 1.25 $ | 4.25 $ | La génération actuelle de Meta |
| `moonshotai/kimi-k2.6` | Moonshot (CN) | 0.95 $ | 4.00 $ | Le Kimi de série |
| `amazon/nova-pro-v1` | Amazon (US) | 0.80 $ | 3.20 $ | Disponible sur AWS en région européenne : le chemin déjà validé par beaucoup de DSI |
| `google/gemini-3.8-flash` | Google (US) | 0.75 $ | 3.75 $ | Le Gemini de série, remarquablement peu cher pour son niveau |
| `cohere/command-a-plus` | Cohere (CA) | 0.30 $ | 1.50 $ | Orienté entreprise, déployable sur site |

### Groupe C — Vos documents ne sortent pas : souveraineté et auto-hébergement

*La question : « Et si je ne veux pas que mes factures partent aux États-Unis ? »*
Quatre modèles français, et des modèles à poids ouverts qu'on peut installer sur ses
propres serveurs.

| Modèle | Fournisseur | Entrée | Sortie | Pourquoi lui |
|---|---|---:|---:|---|
| `mistralai/mistral-medium-3-5` | Mistral (FR) | 1.50 $ | 7.50 $ | Le vaisseau amiral français |
| `mistralai/mistral-large-2512` | Mistral (FR) | 0.50 $ | 1.50 $ | Mistral Large, le nom français le plus connu |
| `qwen/qwen3.8-27b` | Alibaba (CN) | 0.42 $ | 3.00 $ | 27 milliards de paramètres : un serveur à un GPU suffit |
| `meta-llama/llama-4-maverick` | Meta (US) | 0.19 $ | 0.65 $ | Llama, le modèle ouvert le plus connu au monde |
| `mistralai/mistral-small-2603` | Mistral (FR) | 0.15 $ | 0.60 $ | Dix fois moins cher que le Medium, et il lit les images |
| `mistralai/ministral-8b-2512` | Mistral (FR) | 0.15 $ | 0.15 $ | 8 milliards : tourne sur une machine de bureau |
| `google/gemma-4-31b-it` | Google (US) | 0.09 $ | 0.34 $ | Le moins cher des auto-hébergeables |

**Le point décisif de ce groupe** : un modèle à poids ouverts peut être hébergé **en
France**. OVHcloud et Scaleway figurent parmi les hébergeurs référencés par Hugging Face.
Les documents ne quittent alors ni l'entreprise ni le territoire. Aucun benchmark public ne
mesure ça aujourd'hui.

### Groupe D — Traiter du volume au coût le plus bas

*La question : « Combien ça me coûte si j'en passe 50 000 par mois ? »*
À ce niveau de prix, le coût cesse d'être un obstacle. Reste à savoir ce qu'on perd en
qualité — et c'est peut-être moins qu'on ne croit.

| Modèle | Fournisseur | Entrée | Sortie | Pourquoi lui |
|---|---|---:|---:|---|
| `deepseek/deepseek-v4.1-flash` | DeepSeek (CN) | 0.30 $ | 1.20 $ | DeepSeek, le nom qui a fait chuter les prix du marché |
| `google/gemini-3.5-flash-lite` | Google (US) | 0.30 $ | 2.50 $ | La version allégée de Gemini |
| `openai/gpt-6-luna` | OpenAI (US) | 0.10 $ | 0.50 $ | Cent fois moins cher que GPT-6 Astra |
| `amazon/nova-lite-v1` | Amazon (US) | 0.06 $ | 0.24 $ | Sur AWS, en région européenne |
| `z-ai/glm-5.3-flash` | Z.ai (CN) | 0.04 $ | 0.50 $ | Poids ouverts |
| `qwen/qwen3.7-flash` | Alibaba (CN) | 0.03 $ | 0.13 $ | Le prix plancher absolu du catalogue |

## Ce que cette liste dit déjà

**Du moins cher au plus cher, il y a un facteur 333.** Qwen 3.7 Flash coûte 0,03 $ le
million de tokens, GPT-6 Astra en coûte 10. Toute la question du hub tient là : le plus
cher fait-il 333 fois mieux sur *votre* facture ? Certainement pas. De combien fait-il
mieux, alors, et l'écart justifie-t-il la dépense ?

Treize fournisseurs de modèles sont représentés, dont **quatre modèles français** et
**neuf modèles à poids ouverts**, donc hébergeables en Europe.

## Ce que coûte un run complet

Sur les tarifs réels du 26/09, avec les 27 modèles :

| Benchmark | Coût des appels |
|---|---|
| 100 factures ou tickets | **21 $** |
| 50 contrats | **86 $** |

Environ **110 $ pour toute la vague 1**. Passer de 20 à 27 modèles coûte une cinquantaine
de dollars de plus : le prix d'un classement que personne ne pourra accuser d'avoir oublié
un modèle connu.

À noter : OpenRouter propose des variantes `:batch` à moitié prix, mais elles faussent la
mesure de latence. On ne les utilisera pas pour un classement publié.

---

# 2. Les métiers et leurs tâches : que peut-on vraiment tester ?

Une tâche n'est testable sérieusement que s'il existe des documents **réels** avec les
**bonnes réponses déjà écrites par des humains**. Sinon, il faut les fabriquer nous-mêmes,
ce qui prend des semaines.

Légende : **✅ testable tout de suite** · **⚠️ partiellement** · **❌ pas sans créer les données**

## ✅ Sept tâches directement testables

| # | Métier | Tâche | Jeu de données réel | Volume | Licence |
|---|---|---|---|---|---|
| 1 | Comptabilité | Lecture de factures | **VRDU Ad-buy** : vraies factures déposées auprès du régulateur télécom américain, annotées au mot près, avec lignes de facturation | 641 | Creative Commons |
| | | | **DocILE** : documents commerciaux réels, 55 types de champs | 6 680 | Accès sur formulaire, « recherche » — à clarifier |
| 2 | Comptabilité | Contrôle de notes de frais | **CORD** : vrais tickets de caisse photographiés, 30 sous-classes annotées | 1 000 | CC BY 4.0 |
| | | | **SROIE** : tickets scannés, 4 champs | 973 | À vérifier |
| 3 | Juridique | Détection de clauses à risque | **CUAD** : vrais contrats commerciaux annotés sous supervision de juristes, 41 types de clauses | 510 | CC BY 4.0, **usage commercial autorisé** |
| | | | **LEDGAR / LexGLUE** : clauses issues de contrats déposés auprès du régulateur boursier américain | 80 000 | CC BY 4.0 |
| 4 | Service client | Tri et routage de tickets | **CFPB** : réclamations réelles de consommateurs, classées par produit et problème. ⚠️ Le 06/10/2026, la base ne fournit plus le texte écrit par le client : il n'y a plus rien à classer, une autre source est à trouver | 18 millions de fiches, sans texte | Données publiques, libres |
| 5 | Informatique | Du besoin métier à la requête SQL | **BIRD** : questions en langage courant et requêtes de référence sur 95 bases réelles, 37 domaines | 12 751 | CC BY-SA 4.0 |
| | | | **Spider 2.0** : problèmes d'entreprise, requêtes de plus de 100 lignes | ~600 | À vérifier |
| 6 | Finance | Analyse de documents financiers | **FinanceBench** : questions sur les rapports de sociétés cotées, avec réponse et page de référence. Les 150 questions ouvertes portent sur 32 sociétés ; 50 sont retenues (spec du 07/10) | 150 ouverts (10 231 au total, privés) | CC BY-NC 4.0 : usage non commercial |
| 7 | Direction | Compte rendu de réunion | **QMSum** : vraies réunions transcrites (produit, académique, parlementaire) avec résumés écrits par des humains | 1 808 résumés, 232 réunions | AMI en CC BY 4.0 |

**Le meilleur des sept, méthodologiquement : le tri de tickets.** La base CFPB est
alimentée en continu. On peut ne retenir que des réclamations **postérieures à la date
d'entraînement des modèles**, donc qu'aucun d'eux n'a pu mémoriser. C'est exactement la
parade que vals.ai applique avec ses jeux de test privés.

⚠️ *Constaté le 06/10/2026 : cet avantage n'existe plus. L'API publique de la base ne
renvoie plus le texte des réclamations, quelle que soit leur date. Le tri de tickets
n'a donc plus de source, et sort de la vague 1 tant qu'on n'en a pas trouvé une autre.*

**Le plus parlant : les clauses de contrat.** Dans un contrat donné, la plupart des 41
clauses sont absentes. Un modèle qui invente une clause de non-concurrence commet
l'erreur la plus grave qui soit, et notre mesure d'hallucination la capte directement.

## ⚠️ Six tâches partiellement testables

| Métier | Tâche | Ce qui manque |
|---|---|---|
| Juridique | Résumé de contrat | Pas de résumés de référence. Il faut une grille et un modèle juge, donc une notation contestable |
| Direction | Note de synthèse | Même problème. Des jeux de résumés de documents longs existent, à évaluer |
| RH | Présélection de candidatures | Des CV publics existent, mais aucune décision de recrutement fiable comme référence. **Et un enjeu de biais** : mesurer un tri de candidatures demande un protocole anti-discrimination sérieux |
| RH | Questions de droit du travail | Rien en droit français. LegalBench existe mais porte sur le droit américain |
| Informatique | Support de niveau 1 | Les jeux publics de tickets informatiques sont générés, pas réels |
| Achats | Prévision de réapprovisionnement | Des jeux réels de ventes existent, mais ce n'est pas une tâche documentaire : protocole à repenser |

## ❌ Huit tâches non testables sans créer les données

Rapprochement bancaire · Prévision de trésorerie · Réponse à un client en SAV ·
Qualification de prospects · Rédaction de propositions commerciales · Contenus à la voix
de la marque · Analyse de campagnes · Comparaison de devis fournisseurs.

Pour toutes, il n'existe aucun jeu public réel et annoté. Ce sont des tâches internes aux
entreprises, dont les données ne sortent jamais. Elles constituent la **phase française** :
documents réels collectés auprès de tes clients avec leur accord, annotés par nous,
gardés privés et publiés uniquement sous forme de scores — le modèle de vals.ai.

## Le sujet de la langue

Tous les jeux ci-dessus sont anglophones. Aucun jeu français réel et annoté n'existe pour
ces tâches. Décision prise le 19/09 : **anglais d'abord, français ensuite**, le site
indiquant clairement l'origine des documents.

---

# 3. Roadmap

Principe : un métier à la fois, une tâche à la fois. Chaque vague se termine par une
publication en ligne et peut nourrir un contenu LinkedIn.

## Vague 1 — Prouver la méthode (le socle)

| Ordre | Benchmark | Pourquoi celui-ci | Charge |
|---|---|---|---|
| 1 | **Comptabilité — lecture de factures** | Le pipeline de notation existe déjà : comparaison de montants, de dates, appariement de lignes. Chemin le plus court vers un premier classement mesuré | ~1 jour |
| 2 | **Juridique — clauses à risque** | Le plus parlant pour un dirigeant, et celui où l'hallucination se voit le mieux | ~2 jours |
| 3 | **Service client — tri de tickets** | Le plus incontestable : données postérieures à l'entraînement des modèles | ~1,5 jour |

À la fin de la vague 1 : trois benchmarks réels, trois métiers, un indice global qui
commence à avoir du sens. C'est le moment de tourner la vidéo.

## Vague 2 — Élargir

| Ordre | Benchmark | Charge |
|---|---|---|
| 4 | Informatique — du besoin à la requête SQL | ~1,5 jour |
| 5 | Finance — analyse de documents financiers | ~1,5 jour |
| 6 | Comptabilité — notes de frais | ~1 jour |

## Vague 3 — Les tâches rédactionnelles

Compte rendu de réunion, résumé de contrat, note de synthèse. Elles exigent un **modèle
juge** et une grille validée, donc un travail de méthode avant tout développement.

## Vague 4 — La phase française

Collecte et annotation de documents réels français auprès de tes clients. C'est la vague
qui donne au hub son intérêt unique : personne d'autre ne l'aura.

## Ce que coûte une vague

À titre d'ordre de grandeur, avec 10 modèles : un benchmark de 100 documents courts
revient à quelques dollars d'appels. Les contrats, qui sont longs, coûtent nettement plus.
Chaque run sera chiffré avant d'être lancé avec `npm run eval:run -- --estimate`.

---

# 4. Accéder aux API des modèles

## Ce qu'est une clé d'API

Une clé d'API est une longue chaîne de caractères qui sert de mot de passe pour un
programme. Quand notre script demande à un modèle de lire une facture, il joint cette clé
à sa requête. Le fournisseur reconnaît le compte, autorise l'appel et le facture.

Sans intermédiaire, il en faudrait **une par laboratoire** : un compte OpenAI, un compte
Anthropic, un compte Google, un compte Mistral, un compte Alibaba… soit douze comptes,
douze moyens de paiement et douze factures pour nos vingt modèles.

Un agrégateur supprime ce problème : **une seule clé, un seul compte, une seule facture**,
et il redistribue les appels aux bons fournisseurs. C'est ce que fait la passerelle de
Vercel, et c'est ce que fait OpenRouter.

## Le choix : OpenRouter

Décision du 24/09, et c'est la bonne pour la raison que tu as identifiée : **le contrôle
du fournisseur**.

Un modèle à poids ouverts n'est pas servi par un seul hébergeur. Le même Qwen peut tourner
chez cinq hébergeurs différents, avec des niveaux de compression différents — un modèle
compressé répond plus vite, pour moins cher, mais un peu moins bien. Si l'hébergeur change
entre deux mesures, le classement bouge sans que le modèle ait changé. Le benchmark ne
mesure alors plus rien.

OpenRouter laisse reprendre la main, et c'est documenté :

| Paramètre | Ce qu'il permet |
|---|---|
| `order` + `allow_fallbacks: false` | Imposer un hébergeur précis, sans report automatique sur un autre |
| `quantizations` | N'accepter qu'un niveau de compression donné (`fp8`, `bf16`, `int8`…) |
| `data_collection` | **Écarter les hébergeurs qui conservent les données** — décisif pour un public européen |
| `only` / `ignore` | Liste blanche ou liste noire d'hébergeurs |

La documentation prévient elle-même que « les modèles compressés peuvent présenter des
performances dégradées sur certaines requêtes ». C'est précisément ce qu'on veut maîtriser.

Chaque classement publié indiquera donc **l'hébergeur et le niveau de compression**, au
même titre que la version exacte du modèle.

## Les autres solutions, et pourquoi elles ne conviennent pas ici

| Solution | Couverture | Verdict |
|---|---|---|
| **OpenRouter** | 458 modèles, 63 fournisseurs, 288 sachant lire une image. Prix des fournisseurs **sans marge** ; frais de 5,5 % à l'achat de crédits | **Retenu.** Le seul qui donne la maîtrise de l'hébergeur |
| **Vercel AI Gateway** | 389 modèles. Déjà intégré au projet | Bon, mais catalogue plus étroit et pas d'épinglage d'hébergeur. À garder comme secours |
| **Hugging Face Inference Providers** | Route vers des hébergeurs de modèles **ouverts** : Together, Fireworks, Groq, Cerebras, DeepInfra, **OVHcloud, Scaleway**… | Pas de Claude ni de Gemini, donc pas un substitut. **Mais la bonne piste pour mesurer un modèle ouvert hébergé en France** — un test à part, très parlant pour tes clients |
| **LiteLLM** (open source) | 100+ fournisseurs, proxy à installer soi-même | Gratuit, mais il faut **une clé chez chaque fournisseur** : on revient aux douze comptes. Aucun gain pour le classement |

## Ce qu'il faut faire concrètement

1. Créer un compte sur **openrouter.ai**.
2. Aller dans **Keys**, créer une clé, la copier — elle ne s'affiche qu'une fois.
3. Créditer le compte. **Vingt dollars couvrent largement la vague 1.**
4. Créer à la racine du projet un fichier `.env.local` contenant
   `OPENROUTER_API_KEY=ta-clé`. Ce fichier est déjà exclu de git, la clé ne sera jamais
   publiée. **Ne la colle pas dans le chat.**

Côté code, le changement est modeste : les identifiants de modèles diffèrent un peu entre
les deux catalogues (`mistral/mistral-medium-3.5` chez Vercel, `mistralai/mistral-medium-3-5`
chez OpenRouter), et il faut ajouter les paramètres d'épinglage d'hébergeur.

---

# Ce qu'il reste à décider

1. Valider la liste des 20 modèles, ou ajuster les groupes.
2. Confirmer l'ordre de la vague 1 : factures, puis clauses de contrat, puis tickets.
3. Trancher sur DocILE : demander l'accès et clarifier si un usage par Flowera est permis,
   ou s'en tenir à VRDU dont la licence est claire.
4. Créer la clé OpenRouter et créditer une vingtaine de dollars.
5. Décider si l'on ajoute un test « modèle ouvert hébergé en France » via OVHcloud ou
   Scaleway. Ce serait un angle que personne d'autre ne publie.
