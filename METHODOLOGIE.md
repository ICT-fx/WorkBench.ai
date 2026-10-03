# Méthodologie du hub d'évaluations métier

**Dernière mise à jour : 30 septembre 2026** · premier benchmark exécuté le 27/09/2026

Ce document décrit comment un benchmark est construit, comment une réponse de modèle
est vérifiée, ce qui a été mesuré, et **les erreurs commises qu'il ne faut pas
reproduire**. Il est destiné autant à Fantin qu'à toute session d'assistant qui
reprendrait ce projet.

---

# 1. Le protocole, en une phrase

On envoie un document réel à plusieurs modèles, on leur demande de remplir des cases
précises, et on compare leurs réponses à des réponses de référence écrites par des
humains — jamais par une IA.

## Le premier benchmark : lecture de factures

| | |
|---|---|
| **Jeu de données** | DeepForm — factures publicitaires télévisées déposées auprès du régulateur américain (FCC), étiquetées à la main par des journalistes |
| **Licence** | Dépôt distributeur sous licence MIT, documents sources issus d'archives publiques |
| **Documents** | 132 téléchargés, **60 retenus** dans le classement, 12 écartés faute d'avoir été lus par tout le panel |
| **Modèles** | **27**, de 0,0002 $ à 0,085 $ par facture |
| **Appels notés** | 1 620 (60 × 27) |
| **Coût réel** | 39,80 $ sur trois campagnes, tentatives ratées comprises |
| **Runs** | `2026-09-27`, `2026-10-02`, `2026-10-04`, fusionnés en un classement |

## Comment un appel se déroule

1. Le PDF est converti en **une image par page** (MuPDF, niveaux de gris, JPEG qualité 82).
2. Les pages sont envoyées au modèle avec un prompt identique pour tous, via OpenRouter.
3. Le modèle répond en JSON. On extrait l'objet même s'il l'encadre de commentaires.
4. On enregistre la réponse **brute**, la version exacte du modèle, l'hébergeur qui a
   servi l'appel, les jetons consommés, le coût et la latence.
5. Le fichier de réponse n'est **jamais** réécrit. La notation est une étape séparée.

Cette séparation est essentielle : changer le barème six mois plus tard ne coûte aucun
appel, et les scores restent comparables dans le temps.

---

# 2. Comment on vérifie une réponse

C'est la question centrale. Demander quelque chose à une IA est facile ; savoir si elle
a raison est tout le problème.

## La vérité terrain ne vient jamais d'une IA

Les réponses de référence proviennent des étiquettes de DeepForm, saisies à la main par
des journalistes à partir des documents. **Aucun modèle n'évalue un autre modèle.** Si un
jour une tâche l'exige — résumé, rédaction — il faudra une grille écrite et une revue
humaine, et le dire explicitement.

## Chaque champ a sa règle de comparaison

| Type | Règle |
|---|---|
| `number` | Au centime. Lit `1 234,56`, `1.234,56 €`, `$1,880.00`. Un groupe de milliers ne commence jamais par zéro : `0,125` vaut 0,125, pas 125 |
| `date` | Normalisée en AAAA-MM-JJ. **La convention suit le pays du document** : `02/03` est le 3 février sur une facture américaine, le 2 mars sur une française. Une seule lecture est admise, sinon une inversion jour/mois deviendrait indétectable |
| `exact` | Identité après suppression des espaces, accents et ponctuation, et passage en minuscules |
| `lines` | Appariement des lignes, ordre indifférent, reformulation admise si les chiffres concordent. Score F1, correct au-delà de 0,9 |
| `text` | Tous les termes porteurs de sens doivent s'y retrouver, une abréviation valant le mot entier (`art.` ↔ `article`) |

Ces comparateurs sont couverts par une trentaine de tests unitaires
(`packages/eval/src/compare.test.ts`). Ils sont le cœur du projet : une erreur ici
fausse un classement entier sans jamais lever d'exception.

## Trois verdicts, pas deux

Pour chaque case :

- **correct**
- **faux ou manquant**
- **halluciné** — le modèle a produit une valeur là où le document n'en contient aucune

Le troisième est ce qui distingue ce hub des benchmarks classiques. Un chiffre inventé
coûte plus cher qu'un chiffre manquant : il passe la relecture.

## Les quatre mesures publiées

Jamais fondues en une note unique.

1. **Factures sans relecture** — part des documents dont aucun champ critique n'est faux
2. **Exactitude pondérée** — points obtenus / points possibles, chaque champ pesé par sa criticité métier
3. **Hallucinations** — champs inventés / champs réellement absents
4. **Coût et latence** — par document, latence en médiane et non en moyenne (un seul appel lent fausserait la moyenne)

## Les vérifications faites au-delà de la notation

La notation seule ne suffit pas. Ce qui a été contrôlé, et qu'il faut refaire :

- **Inspection visuelle des documents rendus.** Ouvrir plusieurs images et vérifier que le
  texte fin est lisible. Une conversion ratée produirait des scores catastrophiques pour
  tout le monde sans qu'on sache pourquoi.
- **Vérification de l'hypothèse du champ sonde.** Avant d'affirmer qu'aucune facture ne
  porte de numéro de TVA, la couche texte des 39 PDF a été fouillée : zéro occurrence de
  « VAT », « TVA », « IBAN », « SIRET ». Une hypothèse vérifiée, pas supposée.
- **Répartition des erreurs par champ.** C'est ce contrôle qui a révélé que le classement
  initial était un artefact (voir § 4).
- **Comparaison de deux classements.** Calculer le classement sur tous les champs, puis
  sur les seuls champs non ambigus. S'ils diffèrent, c'est qu'on mesure la question posée
  et non la compétence.
- **Contrôle des totaux facturés.** Comparer le coût suivi par le pipeline au solde réel
  du fournisseur. Un écart signale des dépenses invisibles.

---

# 3. Les résultats du 27 septembre 2026

## Le barème retenu

Trois champs sur six sont notés : **montant total**, **date de fin de période** et
**numéro de TVA** (champ sonde, absent de tous les documents).

Les trois autres — numéro de contrat, date de début, client facturé — sont **écartés de
la note**, avec leur raison inscrite dans `data/tasks/facture-fcc/task.json`. Leur
question admet plusieurs réponses défendables sur ces documents : on mesurerait la
devinette et non la lecture. Les réponses des modèles restent enregistrées et
consultables.

## Le classement

60 factures, 27 modèles, 1 620 appels notés. Ordonné par exactitude, puis par prix, puis
par rapidité — ces deux derniers critères départagent les égalités, et ils sont mesurés.

| # | Modèle | Exactitude | Sans relecture | $/facture | Latence |
|---:|---|---:|---:|---:|---:|
| 1 | `qwen/qwen3.7-flash` | 100.0 % | 100.0 % | 0.0005 $ | 32.6 s |
| 2 | `openai/gpt-6-luna` | 100.0 % | 100.0 % | 0.0009 $ | 3.8 s |
| 3 | `z-ai/glm-5.3-flash` | 100.0 % | 100.0 % | 0.0012 $ | 5.0 s |
| 4 | `deepseek/deepseek-v4.1-flash` | 100.0 % | 100.0 % | 0.0030 $ | 7.2 s |
| 5 | `qwen/qwen3.8-27b` | 100.0 % | 100.0 % | 0.0035 $ | 17.2 s |
| 6 | `cohere/command-a-plus` | 100.0 % | 100.0 % | 0.0059 $ | 15.2 s |
| 7 | `google/gemini-3.8-flash` | 100.0 % | 100.0 % | 0.0067 $ | 6.4 s |
| 8 | `meta/muse-spark-1.3` | 100.0 % | 100.0 % | 0.0126 $ | 9.9 s |
| 9 | `moonshotai/kimi-k2.6` | 100.0 % | 100.0 % | 0.0129 $ | 31.0 s |
| 10 | `qwen/qwen3.8-max-0902` | 100.0 % | 100.0 % | 0.0187 $ | 14.5 s |
| 11 | `x-ai/grok-4.7` | 100.0 % | 100.0 % | 0.0222 $ | 16.3 s |
| 12 | `anthropic/claude-opus-5.5` | 100.0 % | 100.0 % | 0.0311 $ | 5.2 s |
| 13 | `qwen/qwen3.8-max-prime` | 100.0 % | 100.0 % | 0.0376 $ | 10.7 s |
| 14 | `openai/gpt-6-astra` | 100.0 % | 100.0 % | 0.0849 $ | 4.0 s |
| 15 | `moonshotai/kimi-k3` | 99.6 % | 100.0 % | 0.0218 $ | 6.5 s |
| 16 | `google/gemma-4-31b-it` | 98.8 % | 98.3 % | 0.0002 $ | 8.1 s |
| 17 | `mistralai/ministral-8b-2512` | 98.8 % | 98.3 % | 0.0010 $ | 2.4 s |
| 18 | `google/gemini-3.5-flash-lite` | 98.8 % | 98.3 % | 0.0015 $ | 1.8 s |
| 19 | `anthropic/claude-sonnet-5` | 98.8 % | 98.3 % | 0.0148 $ | 3.1 s |
| 20 | `openai/gpt-6-sol` | 98.8 % | 98.3 % | 0.0180 $ | 4.3 s |
| 21 | `anthropic/claude-fable-5.1` | 98.8 % | 98.3 % | 0.0736 $ | 5.6 s |
| 22 | `meta-llama/llama-4-maverick` | 97.5 % | 96.7 % | 0.0017 $ | 4.6 s |
| 23 | `mistralai/mistral-large-2512` | 97.5 % | 96.7 % | 0.0034 $ | 19.2 s |
| 24 | `mistralai/mistral-small-2603` | 96.3 % | 95.0 % | 0.0011 $ | 2.5 s |
| 25 | `mistralai/mistral-medium-3-5` | 95.8 % | 95.0 % | 0.0107 $ | 3.1 s |
| 26 | `amazon/nova-lite-v1` | 80.0 % | 73.3 % | 0.0004 $ | 2.2 s |
| 27 | `amazon/nova-pro-v1` | 75.0 % | 66.7 % | 0.0048 $ | 2.5 s |

## Ce que ce classement dit

**Quatorze modèles sur vingt-sept sont parfaits.** Entre le moins cher d'entre eux,
`qwen/qwen3.7-flash` à 0,0005 $ la facture, et le plus cher, `openai/gpt-6-astra` à
0,0849 $, il y a un **facteur 170 pour un résultat identique**.

**L'échantillon a cassé des égalités que dix-neuf factures ne voyaient pas.** Sur 19
documents, dix-neuf modèles étaient à 100 % ; sur 56, dix-huit ; sur 60, quatorze.
`claude-fable-5.1`, le modèle le plus cher du panel, tombe à 98,8 % — une facture lue
de travers sur soixante, pour cent cinquante fois le prix du premier.

**Deux modèles inventent.** `moonshotai/kimi-k3` et `mistralai/mistral-medium-3-5` ont
chacun fabriqué un numéro de TVA sur une facture qui n'en porte aucun. Sur dix-neuf
documents, cela ne s'était jamais produit ; sur soixante, cela apparaît. C'est
exactement ce qu'un échantillon plus large sert à montrer, et ce que mesure le
quatrième verdict.

**Les trois modèles qui décrochent** sont `nova-pro-v1` (75,0 %), `nova-lite-v1`
(80,0 %) et `mistral-medium-3-5` (95,8 %). Le premier laisse une facture sur trois à
reprendre à la main, alors qu'il est vendu comme un modèle haut de gamme.

**La conclusion méthodologique compte autant que le classement : cette tâche reste
trop facile.** Quatorze modèles à égalité parfaite, cela ne hiérarchise pas. La vraie
difficulté est dans les lignes de facturation, que l'annotation d'origine ne couvre
pas : il faudra construire notre propre référence.

## Répartition des erreurs, tous champs confondus

Mesurée avant l'exclusion des champs ambigus. C'est ce tableau qui a révélé le problème.

| Champ | Taux d'erreur | Diagnostic |
|---|---:|---|
| `contract_num` | 47,4 % | **Ambigu** : six identifiants sur le document |
| `flight_from` | 24,2 % | **Ambigu** : « Flight Dates » et « Invoice Period » |
| `advertiser` | 21,1 % | **Partiellement ambigu** : « Advertiser » et « Product » se recouvrent |
| `flight_to` | 6,2 % | Fiable |
| `gross_amount` | 3,5 % | Fiable |
| `vat_number` | 0 % | Fiable (champ sonde) |

# 4. Les erreurs commises, à ne pas reproduire

Chacune a coûté du temps ou de l'argent. Elles sont listées avec la règle qui en découle.

## Sur la méthode

**Préciser une consigne peut la rendre fausse.** Trois champs sur six avaient été
écartés parce que la question admettait plusieurs réponses. Pour les récupérer, le
prompt a été réécrit en nommant les étiquettes exactes du document : « prends la
date du champ `Flight Dates`, `Order Flight` ou `Flight`, **pas** celle de
`Invoice Period` ». Or beaucoup de ces factures ne portent aucun champ « Flight » :
elles n'ont qu'un `Period`, et c'est lui que les annotateurs ont saisi. Sur un
document, seize modèles sur vingt-cinq ont obéi à la consigne et répondu « rien »,
donc faux ; ceux qui l'ont ignorée ont eu juste. Le taux de « rien » est passé de
0,2 % à 8,7 %. **Une consigne qui interdit une source doit d'abord vérifier que la
source autorisée existe sur tous les documents.**

**Un texte identique ne garantit pas une question identique.** Le champ
« date de fin » était défini par « le dernier jour de *ce* vol », mot pour mot
inchangé entre les deux runs — mais la définition de « ce vol » avait bougé juste
au-dessus. Il avait été annoncé comme comparable entre les deux runs sur la foi
d'un `diff` ; c'était faux, et seules les données l'ont montré. **Comparer les
textes ne suffit pas : il faut comparer les antécédents.**

**Un prompt ambigu mesure la devinette, pas la compétence.**
Demander « le numéro de contrat » sur un document qui en porte six revient à mesurer si
le modèle devine ce qu'on voulait. → **Nommer l'étiquette exacte imprimée sur le
document.** Avant de lancer, ouvrir trois documents et vérifier qu'un humain trouverait
une seule réponse possible pour chaque champ demandé.

**Un `null` produit par notre code est un piège imaginaire.**
Cinq dates que le code ne savait pas lire (`February 12, 2020`, `May12/20`) étaient
devenues `null`, donc « absent du document ». Un modèle lisant correctement la date
aurait été accusé d'hallucination. → **Une valeur présente mais illisible arrête la
préparation.** Elle ne devient jamais un `null` silencieux.

**Vérifier une hypothèse avant de bâtir dessus.**
L'angle « qui invente » supposait des champs absents. Il n'y en avait aucun une fois les
dates correctement lues. → **Compter les cas avant de promettre un résultat.**

**Un champ dont la question admet plusieurs réponses doit être écarté, pas corrigé
après coup.** Le barème porte un motif d'exclusion explicite, et la réponse du modèle
reste consultable. Masquer le champ sans dire pourquoi serait invérifiable.

**Un échec d'appel ne pénalise pas le modèle.** Les échecs rencontrés venaient du quota
du compte, du crédit réservé par les appels simultanés ou d'un hébergeur en panne —
de notre côté, donc. Ils restent visibles dans `errorCount` pour qui veut juger sur
pièces, mais n'entrent pas dans les taux. À réexaminer le jour où un modèle échouera
pour une raison qui lui est propre.

**Comparer deux classements avant de publier.**
Calculer le classement sur tous les champs puis sur les seuls champs non ambigus. S'ils
divergent, le benchmark mesure autre chose que ce qu'on croit.

## Sur les données

**Les images doivent être de poids comparable.**
Certains PDF ont des pages de 11,4 millions de pixels contre 1,4 pour les autres, soit
huit fois plus cher pour tous les modèles, et au-delà des limites de certains
fournisseurs. → **Plafonner la taille de page au rendu**, et pas seulement filtrer après
coup.

**Les limites des fournisseurs s'appliquent à tout le monde.**
Mistral refuse plus de 8 images par requête ; Cohere plafonne à 20 millions de pixels.
→ **Écarter les documents concernés pour tous les modèles**, jamais pour un seul. Un
classement compare des modèles, pas des sous-ensembles de documents.

**Ne pas commiter d'images sans les regarder.**
156 Mo de PNG sont entrés dans l'historique git d'un coup. → **Rendre en JPEG niveaux de
gris**, et vérifier le poids avant de commiter.

## Sur l'exécution et l'argent

**`--limit` désigne un rang, pas un document.** Le filtre garde les N premiers du
tirage. Le tirage s'allonge quand on prépare de nouveaux documents : « les 25
premiers » de septembre, rejoués en octobre sur un dossier passé de 39 à 132
documents, ne désignent plus les mêmes factures. Renoter septembre avec le même
`--limit 25` a produit sept documents au lieu de dix-neuf, sans rien signaler.
La notation le refuse désormais : le périmètre d'un run est ce que le run
contient, et les plafonds de pages et de pixels suffisent, car ils décrivent une
propriété du document et non son rang.

**Le plafond d'une clé n'est pas le solde d'un compte.** `key:check` affichait
« plafond : 50 $ » : c'est une limite posée sur la clé, pas de l'argent disponible.
Le compte, lui, n'avait que 0,09 $. Un lot de 40 documents a été dimensionné sur
29 $ de marge imaginaire ; il s'est arrêté à mi-course, 9,13 $ dépensés et trois
modèles finis sur vingt-sept. Le solde se lit sur `/api/v1/credits`
(`total_credits - total_usage`), et c'est lui, désormais affiché en premier, qui
décide de ce qu'on peut lancer.

**Un appel HTTP sans délai maximal fige un run entier.** `fetch` n'en avait
aucun : une connexion qui cesse de répondre bloque l'appel pour toujours, et à
deux appels simultanés, deux connexions mortes suffisent. Le run est resté figé
à 194 appels sur 1080, processus vivant, zéro pour cent de processeur, sans un
message. Quatre minutes de plafond, et un dépassement traité comme une erreur
passagère.

**Un run s'arrête proprement, mais pas au bon endroit.** Le pipeline interroge
les modèles l'un après l'autre : à l'arrêt, trois modèles avaient lu les quarante
documents et vingt-quatre n'en avaient lu aucun. Rien n'est publiable dans cet
état, alors qu'avec un parcours document par document, on aurait eu des documents
complets et un échantillon réduit mais exploitable. À corriger avant le prochain
run sur budget serré.

**Deux appels simultanés au maximum.**
À huit, OpenRouter réserve d'avance plus de crédit que le compte n'en a de disponible et
refuse tout : **419 appels perdus** sur un premier run. Un seul appel à la fois lorsque
les quotas par minute se déclenchent.

**Les échecs sont facturés.**
Un modèle qui réfléchit puis rend une réponse vide a consommé des jetons, facturés. Ne
pas les enregistrer a produit un écart de 1,27 $ entre le compteur et la réalité.
→ **Enregistrer le coût même en cas d'échec.**

**Un refus 402 recouvre deux situations opposées.**
« Les appels en cours réservent le crédit » se règle en patientant. « Le coût maximal de
cette requête dépasse le crédit disponible » ne se règle qu'en rechargeant. Les confondre
a fait tourner un run **une heure à vide**. → Ne réessayer que le premier.

**L'ordre des filtres de périmètre compte.**
`--limit` désigne les N premiers documents du tirage, `--max-pages` et `--max-pixels`
écartent ensuite les trop lourds. Dans l'autre sens, **treize documents hors périmètre**
sont entrés dans un run payant. → Le périmètre est calculé par une fonction unique,
partagée par le run et la notation.

**Chiffrer avant de dépenser, et annoncer le chiffre.**
`npm run eval:run -- --estimate` ne passe aucun appel. Le coût réel a dérivé de 13,92 $ à
16,23 $ puis 19,15 $ au fil des mesures : chaque révision doit être annoncée avant de
lancer.

---

# 5. Limites du benchmark, à afficher sur le site

- Factures publicitaires américaines, pas des factures fournisseurs françaises.
- **19 documents** : deux modèles séparés par quelques points ne sont pas départageables.
- Documents envoyés en **images** alors que les PDF ont une couche texte : le test est
  plus difficile que la réalité d'un PDF natif.
- Vérité terrain héritée des annotateurs de DeepForm, avec leurs erreurs éventuelles.
  Les 73 documents qu'ils ont eux-mêmes signalés sont écartés.
- Documents de plus de 8 pages ou de plus de 20 millions de pixels écartés, à cause de
  limites de fournisseurs.
- Un seul prompt par modèle, aucun ajustement fin, aucun OCR spécialisé en amont.

---

# 6. Ce qu'il faut faire ensuite

1. **Durcir la tâche.** L'extraction de cinq champs d'en-tête est trop facile : vingt
   modèles sont à égalité parfaite. La difficulté réelle est dans les **lignes de
   facturation**, ce tableau détaillé que DeepForm n'annote pas. Il faudra construire
   notre propre vérité terrain.
2. **Reprendre le prompt** en nommant les étiquettes exactes, si l'on veut réutiliser les
   champs ambigus.
3. **Étape d'arbitrage humain** (`npm run eval:review`), jamais exécutée à ce jour. Elle
   soumet les hallucinations, les écarts d'écriture et un échantillon de contrôle.
4. **Épingler l'hébergeur** une fois qu'on sait lesquels servent bien chaque modèle.
   L'hébergeur est déjà enregistré à chaque appel.

---

# 7. Ce que le site publie, et ce qu'il ne publie plus

**2 octobre 2026.** Le dépôt a été purgé de toute donnée fabriquée, à la demande de
Fantin. Ont été supprimés :

- les 22 classements de démonstration (`data/published/*.json`) et leurs historiques,
  dont les chiffres étaient tirés du prix et de la date de sortie des modèles ;
- le jeu de 25 factures françaises de synthèse (`data/tasks/facture-fr`), ses vérités
  terrain et ses images ;
- le run de démonstration associé ;
- **les générateurs eux-mêmes** : `invoice-model`, `render`, `scenarios`, `degrade`,
  `demo-run`, `demo-hub`, `demo-model`, et les commandes `fixtures:generate`,
  `demo:run`, `demo:hub`. Supprimer les données sans supprimer l'usine à données
  n'aurait tenu que jusqu'au prochain besoin de remplir une page.

Ce qui reste est mesuré ou déclaré à venir. **Il n'y a pas de troisième état.**

Le catalogue est passé de 52 modèles aux **27 réellement testés**, avec leurs
identifiants OpenRouter — les anciens étaient ceux de la passerelle Vercel et ne
correspondaient à rien de ce qui avait été appelé. `catalogue-sync` lit désormais le
catalogue d'OpenRouter : les prix affichés sont ceux qui ont été facturés.

Les 21 tâches non mesurées restent en ligne, chacune avec sa page, son protocole, sa
place dans la feuille de route et **ce qui lui manque** : un jeu public à intégrer, une
grille de notation à écrire, ou des documents que seules des entreprises détiennent.
Les trois causes ne s'équivalent pas, et les confondre reviendrait à promettre
vingt-et-un classements imminents.

## Deux règles de plus, apprises ici

**Un indice calculé sur un métier n'est pas un indice métier.** La règle « pas d'indice
tant qu'un métier manque » rendait l'indice impossible dès qu'un seul benchmark était
mesuré, et la contourner en silence en aurait fait un verdict général tiré d'une seule
tâche. L'indice porte maintenant sur les métiers mesurés, et le site affiche partout
combien il en couvre — 1 sur 10 aujourd'hui.

**Une page d'aide qui décrit une étape jamais exécutée est un mensonge poli.** La page
méthodologie affirmait qu'« avant publication, un humain relit toutes les
hallucinations ». L'étape existe dans le pipeline ; elle n'a jamais été lancée. Le site
dit maintenant que les chiffres publiés sont ceux du comparateur seul, et que 52
notations sur 1 620 restent marquées « à relire ».

---

# 8. Commandes

```bash
npm run key:check                    # la clé OpenRouter fonctionne-t-elle, et reste-t-il du crédit
npm run deepform:prepare -- --n 40   # télécharger et préparer les documents
npm run eval:run -- --task facture-fcc --estimate          # coût prévu, sans aucun appel
npm run eval:run -- --task facture-fcc --run <id> --limit 25 --max-pages 8 --max-pixels 20000000
npm run eval:score -- --task facture-fcc --run <id> --limit 25 --max-pages 8 --max-pixels 20000000
npm run eval:review -- --run <id>    # arbitrage humain
npm run eval:publish -- --run <id>   # fige le classement publié
```

Le run se reprend avec `--resume` : aucun appel déjà payé n'est repayé.
