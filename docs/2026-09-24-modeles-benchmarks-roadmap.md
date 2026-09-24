# Hub d'évaluations métier — modèles, benchmarks, roadmap

**24 septembre 2026** · document de cadrage, à valider

Trois questions traitées ici : quels modèles garder, dans quel ordre construire les
benchmarks et lesquels sont réellement testables, et par quelle API passer.

---

# 1. Les modèles : 10 au lieu de 52

## Pourquoi réduire

Cinquante-deux modèles, c'est un tableau que personne ne lit, cinq fois le coût
d'appels, et surtout une comparaison illisible : sept versions d'Anthropic
côte à côte n'aident aucun dirigeant à décider.

Quatre règles pour trancher :

1. **Savoir lire une image.** Six de tes dix métiers reposent sur des documents —
   factures, contrats, justificatifs. Un modèle qui ne lit pas d'image ne peut pas
   concourir. Cela écarte 13 modèles à lui seul.
2. **Une génération par laboratoire**, la plus récente. Comparer GPT-5.2, 5.4, 5.5 et 6
   intéresse les curieux, pas un DAF.
3. **Couvrir les axes de décision réels** : le meilleur, le rapport qualité-prix,
   le français, l'auto-hébergeable, le challenger chinois.
4. **Pas de version « preview »**, qui change sans prévenir et rend un classement daté
   invérifiable.

## Les 10 modèles retenus

Prix au million de tokens, relevés sur le catalogue de la passerelle Vercel le 24/09/2026.

| Modèle | Rôle dans la comparaison | Entrée | Sortie | Poids |
|---|---|---:|---:|---|
| `openai/gpt-6-astra` | Le haut de gamme d'OpenAI | 10,00 $ | 50,00 $ | fermés |
| `anthropic/claude-opus-5` | Le haut de gamme d'Anthropic | 5,00 $ | 25,00 $ | fermés |
| `spacexai/grok-4.6` | Le haut de gamme de xAI | 2,00 $ | 6,00 $ | fermés |
| `mistral/mistral-medium-3.5` | **Le français**, la question de la souveraineté | 1,50 $ | 7,50 $ | ouverts |
| `meta/muse-spark-1.3` | La génération actuelle de Meta | 1,25 $ | 4,25 $ | fermés |
| `google/gemini-3.8-flash` | Le rapport qualité-prix de Google | 0,75 $ | 3,75 $ | fermés |
| `alibaba/qwen3.8-27b` | **Auto-hébergeable** : 27 milliards de paramètres tiennent sur une machine | 0,50 $ | 3,00 $ | ouverts |
| `deepseek/deepseek-v4.1-flash` | Le challenger chinois, ouvert et peu cher | 0,30 $ | 1,20 $ | ouverts |
| `openai/gpt-5.6-luna` | **Le très bon marché** : cinquante fois moins cher que le haut de gamme | 0,20 $ | 1,20 $ | fermés |
| `google/gemma-4-31b-it` | Le moins cher du lot, poids ouverts | 0,14 $ | 0,40 $ | ouverts |

Deux laboratoires apparaissent deux fois, OpenAI et Google. C'est délibéré : dans les
deux cas l'un tient le rôle « haut de gamme » et l'autre le rôle « prix plancher », et
l'écart entre les deux est précisément ce qu'un dirigeant veut voir. Quatre modèles sur
dix ont des poids ouverts, donc hébergeables chez soi : c'est la réponse à « je ne veux
pas que mes documents sortent de l'entreprise ».

## Les 42 modèles écartés

**Incapables de lire une image (13)** — donc hors-jeu sur les tâches documentaires :

`mistral/mistral-small-4` (absent de la passerelle), `deepseek/deepseek-v4-pro`,
`deepseek/deepseek-v4-pro-0813`, `deepseek/deepseek-v3.2-thinking`, `alibaba/qwen3.7-max`,
`moonshotai/kimi-k2-thinking`, `zai/glm-5.3`, `zai/glm-5.1`, `zai/glm-4.7`,
`minimax/minimax-m2.5`, `nvidia/nemotron-3-ultra-550b-a55b`, `tencent/hy4-preview`,
`xiaomi/mimo-v2.5-pro`.

Conséquence : les laboratoires **Z.ai, MiniMax, NVIDIA, Tencent et Xiaomi disparaissent
entièrement** du hub. Aucun de leurs modèles ne sait lire un document.

**Versions plus anciennes de familles conservées (23)** :

- Anthropic : `claude-opus-4.8`, `claude-opus-4.6`, `claude-opus-4.5`, `claude-sonnet-5`, `claude-haiku-4.5`
- OpenAI : `gpt-5.6-sol`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.2`
- Google : `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3-flash`
- xAI : `grok-4.5`, `grok-4.3`, `grok-4.1-fast-reasoning`
- Alibaba : `qwen3.8-max`, `qwen3.6-27b`, `qwen3.5-plus`
- Mistral : `mistral-large-3`, `ministral-14b`
- Meta : `muse-spark-1.1`, `llama-4-maverick`

**Autres (6)** : `anthropic/claude-fable-5.1` et `google/gemini-3.1-pro-preview`
(version d'essai), `moonshotai/kimi-k3`, `moonshotai/kimi-k2.6`, `minimax/minimax-m3`,
`amazon/nova-2-lite`.

## Le banc de réserve

Quatre modèles à rajouter si tu veux enrichir un benchmark précis sans alourdir tout le
hub : `anthropic/claude-fable-5.1` et `openai/gpt-5.6-sol` pour le très haut de gamme,
`moonshotai/kimi-k3` pour un deuxième chinois, `mistral/mistral-large-3` si tu veux deux
français.

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

## Ce que couvre déjà Vercel

Vérification faite le 24/09 sur le catalogue en direct : **la passerelle Vercel expose 389
modèles**, et **51 de tes 52** y figurent. Le seul absent est `mistral/mistral-small-4`,
qui de toute façon ne lit pas les images.

**Conclusion : la couverture n'est pas ton problème.** Les dix modèles retenus sont tous
disponibles chez Vercel, avec une seule clé et une seule facture.

## Les alternatives, comparées

| Solution | Couverture | Modèle économique | Verdict |
|---|---|---|---|
| **Vercel AI Gateway** | 389 modèles, tous les grands laboratoires | Une clé, une facture, coût et latence remontés par appel | **À garder.** Déjà intégré au projet |
| **OpenRouter** | 458 modèles, 63 fournisseurs, 288 sachant lire une image | Prix des fournisseurs **sans marge** sur l'inférence ; frais de 5,5 % à l'achat de crédits ; possibilité d'apporter ses propres clés | **La meilleure roue de secours.** Couverture supérieure, à adopter si un modèle manque chez Vercel |
| **Hugging Face Inference Providers** | Route vers des hébergeurs de modèles **ouverts** : Together, Fireworks, Groq, Cerebras, DeepInfra, Novita… Interface compatible OpenAI | Paiement à l'usage chez l'hébergeur | **Complément, pas substitut.** Pas de Claude ni de Gemini. Utile pour la partie auto-hébergeable |
| **LiteLLM** (open source) | 100+ fournisseurs, 1 800+ modèles, proxy à installer soi-même | Gratuit, mais **il faut un compte et une clé chez chaque fournisseur** | À considérer seulement si tu veux mesurer sans aucun intermédiaire. Coût caché : dix comptes à ouvrir et à facturer |

## Une réserve méthodologique importante

Un agrégateur qui route vers des hébergeurs tiers ne sert pas toujours le modèle dans la
même version : la compression appliquée au modèle varie d'un hébergeur à l'autre, et la
latence avec. Pour un classement publié, il faut soit **épingler le fournisseur**, soit
**l'indiquer dans les résultats**. vals.ai insiste sur ce point : ils appellent les modèles
« à travers un harnais fixe, de sorte que les écarts de score reflètent le modèle et non
l'échafaudage ». Nous ferons pareil, et la colonne « version exacte du modèle » du
classement est déjà là pour ça.

## Recommandation

Rester sur Vercel pour toute la vague 1. Ajouter OpenRouter en second fournisseur si un
modèle manque ou si un prix devient aberrant. Ne pas monter de proxy maison : ça
n'apporterait rien au classement et ajouterait un composant à maintenir.

---

# Ce qu'il reste à décider

1. Valider la liste des 10 modèles, ou en ajuster un ou deux.
2. Confirmer l'ordre de la vague 1 : factures, puis clauses, puis tickets.
3. Trancher sur DocILE : demander l'accès et clarifier si un usage par Flowera est permis,
   ou s'en tenir à VRDU dont la licence est claire.
4. Obtenir une clé AI Gateway pour lancer le premier run réel.
