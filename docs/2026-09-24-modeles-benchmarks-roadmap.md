# Hub d'évaluations métier — modèles, benchmarks, roadmap

**24 septembre 2026** · document de cadrage, à valider
*Révisé le 24/09 au soir : 20 modèles au lieu de 10, passage à OpenRouter.*

Trois questions traitées ici : quels modèles tester, dans quel ordre construire les
benchmarks et lesquels sont réellement testables, et par quelle API passer.

---

# 1. Les modèles : 20, choisis pour une entreprise européenne

## Ce qu'on écarte, et pourquoi

Un seul critère fait le tri : **savoir lire une image**. Six de tes dix métiers reposent
sur des documents. Un modèle qui ne lit pas d'image ne peut pas concourir, et sur les 458
modèles du catalogue OpenRouter, 288 en sont capables.

On écarte ensuite les versions anciennes d'une même famille — comparer GPT-5.2, 5.4 et 5.5
intéresse les curieux, pas un dirigeant — et les versions « preview », qui changent sans
prévenir et rendent un classement daté invérifiable.

**Correction par rapport à la première version de ce document.** J'avais écrit que Z.ai,
MiniMax et Xiaomi disparaissaient faute de savoir lire une image. C'était vrai du catalogue
Vercel, pas du catalogue OpenRouter, qui propose des variantes vision de ces modèles. Le
choix d'OpenRouter les remet donc en jeu, et GLM entre dans la liste.

## Les quatre questions d'un dirigeant européen

La liste n'est pas un palmarès, c'est une grille de décision. Chaque groupe répond à une
question qu'on te posera :

1. *« Quel est le meilleur, sans regarder le prix ? »* → les modèles frontière
2. *« Lequel j'industrialise sur du volume ? »* → le milieu de gamme
3. *« Et si je ne veux pas que mes documents sortent d'Europe ? »* → souveraineté et poids ouverts
4. *« Combien ça coûte si j'en passe 50 000 par mois ? »* → le prix plancher

## La liste complète

Prix au million de tokens, relevés sur OpenRouter le 24/09/2026.

### Groupe 1 — Les modèles frontière

| Modèle | Laboratoire | Entrée | Sortie |
|---|---|---:|---:|
| `openai/gpt-6-astra` | OpenAI (US) | 10,00 $ | 50,00 $ |
| `anthropic/claude-opus-5.5` | Anthropic (US) | 4,00 $ | 20,00 $ |
| `x-ai/grok-4.7` | xAI (US) | 1,60 $ | 4,80 $ |
| `meta/muse-spark-1.3` | Meta (US) | 1,25 $ | 4,25 $ |
| `google/gemini-3.8-flash` | Google (US) | 0,75 $ | 3,75 $ |

### Groupe 2 — Le milieu de gamme, celui qu'on industrialise

| Modèle | Laboratoire | Entrée | Sortie | Intérêt pour une PME européenne |
|---|---|---:|---:|---|
| `openai/gpt-6-sol` | OpenAI (US) | 2,00 $ | 10,00 $ | Le compromis d'OpenAI, cinq fois moins cher que son haut de gamme |
| `qwen/qwen3.8-max-0902` | Alibaba (CN) | 2,00 $ | 6,00 $ | Le haut de gamme chinois, souvent au niveau pour bien moins cher |
| `moonshotai/kimi-k2.6` | Moonshot (CN) | 0,95 $ | 4,00 $ | Réputé sur les documents longs |
| `amazon/nova-pro-v1` | Amazon (US) | 0,80 $ | 3,20 $ | **Disponible sur AWS en région européenne** : le chemin déjà validé par beaucoup de DSI |
| `cohere/command-a-plus` | Cohere (CA) | 0,30 $ | 1,50 $ | Orienté entreprise, déployable sur site, poids publiés |

### Groupe 3 — Souveraineté européenne et modèles auto-hébergeables

| Modèle | Laboratoire | Entrée | Sortie | Intérêt |
|---|---|---:|---:|---|
| `mistralai/mistral-medium-3-5` | **Mistral (FR)** | 1,50 $ | 7,50 $ | Le vaisseau amiral français |
| `mistralai/mistral-small-2603` | **Mistral (FR)** | 0,15 $ | 0,60 $ | Dix fois moins cher, et il lit les images |
| `mistralai/ministral-8b-2512` | **Mistral (FR)** | 0,15 $ | 0,15 $ | 8 milliards de paramètres : tourne sur une machine de bureau |
| `qwen/qwen3.8-27b` | Alibaba (CN) | 0,42 $ | 3,00 $ | Poids ouverts, 27 milliards : un serveur à un GPU suffit |
| `google/gemma-4-31b-it` | Google (US) | 0,09 $ | 0,34 $ | Poids ouverts, le moins cher des auto-hébergeables |

**Le point décisif de ce groupe** : un modèle à poids ouverts peut être hébergé **en
France**. OVHcloud et Scaleway figurent parmi les hébergeurs référencés par Hugging Face.
Les documents ne quittent alors ni l'entreprise ni le territoire. C'est l'argument que tes
clients attendent, et aucun benchmark public ne le mesure aujourd'hui.

### Groupe 4 — Le prix plancher, pour les gros volumes

| Modèle | Laboratoire | Entrée | Sortie | Poids |
|---|---|---:|---:|---|
| `deepseek/deepseek-v4.1-flash` | DeepSeek (CN) | 0,14 $ | 0,42 $ | ouverts |
| `z-ai/glm-5.3-flash` | Z.ai (CN) | 0,15 $ | 0,50 $ | ouverts |
| `meta-llama/llama-4-maverick` | Meta (US) | 0,19 $ | 0,65 $ | ouverts |
| `openai/gpt-6-luna` | OpenAI (US) | 0,10 $ | 0,50 $ | fermés |
| `amazon/nova-lite-v1` | Amazon (US) | 0,06 $ | 0,24 $ | fermés |

## Ce que dit déjà cette liste

**Du moins cher au plus cher, il y a un facteur 167.** Nova Lite coûte 0,06 $ le million de
tokens, GPT-6 Astra en coûte 10. Toute la question du hub tient là : est-ce que le plus
cher fait 167 fois mieux sur *votre* facture ? Presque sûrement pas. Reste à savoir de
combien il fait mieux, et si l'écart justifie la dépense.

Douze laboratoires sont représentés, dont **trois modèles français** et **huit modèles à
poids ouverts**, donc hébergeables en Europe.

## Ce que coûte un run avec 20 modèles

Calculé sur les tarifs réels du 24/09 :

| Benchmark | Coût des appels |
|---|---|
| Documents courts — 100 factures ou tickets | **12 $** |
| Documents longs — 50 contrats | **49 $** |

Donc environ **60 $ pour la vague 1 complète**, avec vingt modèles. C'est très abordable.
À noter : OpenRouter propose des variantes `:batch` à moitié prix, mais elles faussent la
mesure de latence — on ne les utilisera pas pour un classement publié.

## Le banc de réserve

À ajouter si tu veux creuser un point précis : `anthropic/claude-fable-5.1` et
`openai/gpt-6-astra-pro` pour l'extrême haut de gamme, `moonshotai/kimi-k3` pour un second
chinois de pointe, `mistralai/mistral-large-3` pour un troisième français,
`minimax/minimax-m3` et `xiaomi/mimo-v2.5-pro` pour élargir le champ chinois.

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
| 4 | Service client | Tri et routage de tickets | **CFPB** : réclamations réelles de consommateurs, texte écrit par le client, classé par produit et problème. **Mis à jour en continu** | > 100 000 | Données publiques, libres |
| 5 | Informatique | Du besoin métier à la requête SQL | **BIRD** : questions en langage courant et requêtes de référence sur 95 bases réelles, 37 domaines | 12 751 | CC BY-SA 4.0 |
| | | | **Spider 2.0** : problèmes d'entreprise, requêtes de plus de 100 lignes | ~600 | À vérifier |
| 6 | Finance | Analyse de documents financiers | **FinanceBench** : questions sur les rapports annuels de 40 sociétés cotées, avec réponse et page de référence | 150 ouverts (10 231 au total) | Permissive, à confirmer |
| 7 | Direction | Compte rendu de réunion | **QMSum** : vraies réunions transcrites (produit, académique, parlementaire) avec résumés écrits par des humains | 1 808 résumés, 232 réunions | AMI en CC BY 4.0 |

**Le meilleur des sept, méthodologiquement : le tri de tickets.** La base CFPB est
alimentée en continu. On peut ne retenir que des réclamations **postérieures à la date
d'entraînement des modèles**, donc qu'aucun d'eux n'a pu mémoriser. C'est exactement la
parade que vals.ai applique avec ses jeux de test privés.

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
