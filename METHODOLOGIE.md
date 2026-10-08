# Méthodologie du hub d'évaluations métier

**Dernière mise à jour : 8 octobre 2026** · premier benchmark exécuté le 27/09/2026, deuxième le 07/10/2026 (§ 9)

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
| **Documents** | 132 téléchargés, **100 retenus** dans le classement, aucun écarté |
| **Modèles** | **27**, de 0,0003 $ à 0,085 $ par facture |
| **Appels notés** | 2 700 (100 × 27) |
| **Coût réel** | 52,67 $ sur quatre campagnes, tentatives ratées comprises |
| **Runs** | `2026-09-27`, `2026-10-02`, `2026-10-04`, `2026-10-05`, fusionnés en un classement |

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

100 factures, 27 modèles, 2 700 appels notés. Ordonné par exactitude, puis par prix, puis
par rapidité — ces deux derniers critères départagent les égalités, et ils sont mesurés.

| # | Modèle | Exactitude | Sans relecture | $/facture | Latence |
|---:|---|---:|---:|---:|---:|
| 1 | `openai/gpt-6-luna` | 100.0 % | 100.0 % | 0.0009 $ | 4.0 s |
| 2 | `deepseek/deepseek-v4.1-flash` | 100.0 % | 100.0 % | 0.0025 $ | 12.0 s |
| 3 | `cohere/command-a-plus` | 100.0 % | 100.0 % | 0.0060 $ | 14.4 s |
| 4 | `moonshotai/kimi-k2.6` | 100.0 % | 100.0 % | 0.0127 $ | 28.3 s |
| 5 | `meta/muse-spark-1.3` | 100.0 % | 100.0 % | 0.0127 $ | 10.4 s |
| 6 | `moonshotai/kimi-k3` | 99.8 % | 100.0 % | 0.0208 $ | 7.0 s |
| 7 | `google/gemma-4-31b-it` | 99.3 % | 99.0 % | 0.0003 $ | 4.4 s |
| 8 | `qwen/qwen3.7-flash` | 99.3 % | 99.0 % | 0.0005 $ | 36.2 s |
| 9 | `mistralai/ministral-8b-2512` | 99.3 % | 99.0 % | 0.0010 $ | 2.3 s |
| 10 | `z-ai/glm-5.3-flash` | 99.3 % | 99.0 % | 0.0011 $ | 6.6 s |
| 11 | `google/gemini-3.5-flash-lite` | 99.3 % | 99.0 % | 0.0015 $ | 1.7 s |
| 12 | `qwen/qwen3.8-27b` | 99.3 % | 99.0 % | 0.0036 $ | 16.1 s |
| 13 | `google/gemini-3.8-flash` | 99.3 % | 99.0 % | 0.0070 $ | 6.5 s |
| 14 | `anthropic/claude-sonnet-5` | 99.3 % | 99.0 % | 0.0146 $ | 2.9 s |
| 15 | `qwen/qwen3.8-max-0902` | 99.3 % | 99.0 % | 0.0195 $ | 14.8 s |
| 16 | `x-ai/grok-4.7` | 99.3 % | 99.0 % | 0.0224 $ | 16.9 s |
| 17 | `anthropic/claude-opus-5.5` | 99.3 % | 99.0 % | 0.0305 $ | 5.0 s |
| 18 | `qwen/qwen3.8-max-prime` | 99.3 % | 99.0 % | 0.0371 $ | 11.3 s |
| 19 | `openai/gpt-6-astra` | 99.3 % | 99.0 % | 0.0840 $ | 3.9 s |
| 20 | `openai/gpt-6-sol` | 98.5 % | 98.0 % | 0.0177 $ | 4.1 s |
| 21 | `anthropic/claude-fable-5.1` | 98.5 % | 98.0 % | 0.0723 $ | 5.6 s |
| 22 | `meta-llama/llama-4-maverick` | 98.3 % | 98.0 % | 0.0017 $ | 5.6 s |
| 23 | `mistralai/mistral-small-2603` | 97.8 % | 97.0 % | 0.0010 $ | 2.5 s |
| 24 | `mistralai/mistral-large-2512` | 97.8 % | 97.0 % | 0.0034 $ | 18.9 s |
| 25 | `mistralai/mistral-medium-3-5` | 97.5 % | 97.0 % | 0.0105 $ | 3.0 s |
| 26 | `amazon/nova-lite-v1` | 84.3 % | 79.0 % | 0.0004 $ | 2.2 s |
| 27 | `amazon/nova-pro-v1` | 76.8 % | 69.0 % | 0.0048 $ | 2.4 s |

## Ce que ce classement dit

**Le vainqueur coûte 0,0009 $ la facture.** `openai/gpt-6-luna` lit les cent factures sans
une erreur, pour quatre-vingts fois moins cher que `openai/gpt-6-astra`, du même
fournisseur, qui en rate une.

**L'échantillon a fait le tri que dix-neuf factures ne pouvaient pas faire.** Ils étaient
dix-neuf modèles à 100 % sur dix-neuf documents ; ils sont **cinq sur cent**.
Les deux modèles les plus chers du panel, `claude-fable-5.1` et `gpt-6-astra`, n'en font
pas partie. Un classement bâti sur un petit échantillon ne dit pas « ces modèles se
valent », il dit « ce test ne les sépare pas encore ».

**Trois modèles inventent** un numéro de TVA que ces factures ne portent pas :
`kimi-k3`, `llama-4-maverick` et `mistral-medium-3-5`, un cas chacun. Aucun ne le faisait
sur l'échantillon initial. C'est ce que mesure le quatrième verdict, et il fallait
cent documents pour le voir.

**Les deux modèles qui décrochent** sont `nova-pro-v1` (76,8 %) et `nova-lite-v1`
(84,3 %). Le premier laisse près d'une facture sur trois à reprendre à la main, alors
qu'il est vendu comme un modèle haut de gamme.

**La conclusion méthodologique compte autant que le classement : cette tâche reste
facile.** Vingt-cinq modèles sur vingt-sept dépassent 97 %. La vraie difficulté est dans
les lignes de facturation, que l'annotation d'origine ne couvre pas : il faudra
construire notre propre référence.

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

**Un délai maximal uniforme fait payer trois fois les modèles lents.** Le plafond
de quatre minutes par appel, posé pour qu'une connexion morte ne fige plus un run,
interrompt aussi les modèles qui répondent lentement sur un document lourd : deux
appels ont mis 681 et 685 secondes, c'est-à-dire deux tentatives avortées puis une
réussie. Les tentatives avortées peuvent être facturées, et à deux appels
simultanés elles bloquent les deux créneaux pendant onze minutes. Le plafond doit
suivre le modèle, comme celui des jetons — relevé là où c'est nécessaire, serré
ailleurs — plutôt que d'être le même pour les vingt-sept.

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
dit maintenant que les chiffres publiés sont ceux du comparateur seul, et que 80
notations sur 2700 restent marquées « à relire ».

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

---

# 9. Deuxième benchmark : analyse de rapports financiers (7 et 8 octobre 2026)

Le premier benchmark lit des factures ; celui-ci fait le premier étage du travail d'un
analyste financier : tirer d'un rapport des indicateurs et un jugement. Les questions ont été
écrites par des analystes — calculer une marge d'EBITDA, un cycle de conversion de trésorerie,
dire si une marge s'améliore, quel segment a freiné la croissance, ou qu'un indicateur n'a pas
de sens pour une banque. Ce n'est pas le métier entier : la page utile est fournie, et rédiger
une note, prévoir ou défendre un avis ne sont pas notés. Les
sections 1 à 8 décrivent le premier : **un protocole ne se transpose pas**, et celui-ci a
ses propres règles, ses propres limites et ses propres erreurs.

## 9.1 Le protocole

| | |
|---|---|
| **Jeu de données** | FinanceBench (Patronus AI), 150 questions ouvertes sur les rapports de 32 sociétés cotées américaines. **CC BY-NC 4.0** : usage non commercial |
| **Tri** | 91 questions sur 150 se vérifient sans relecture humaine ; 59 sont écartées, chacune avec son motif (`data/tasks/analyse-financiere/tri.csv`) |
| **Premier tirage** | 50 questions, par quotas de forme de réponse, ordre fixé par l'empreinte SHA-256 de `workbench-finance-v1:` + identifiant, deux questions par société au plus |
| **Extension** | 17 calculs ajoutés après le premier run, parce que le haut du classement ne se départageait pas : tous les calculs éligibles non tirés, sans choix sur les résultats, sauf le taux de distribution des dividendes (écarté avant le run, échelle ambiguë) |
| **Ce que reçoit le modèle** | La ou les pages de preuve en image (89 pages, 13 Mo, versionnées), et la question d'origine en anglais, mot pour mot |
| **Formes de réponse classées** | Relever un chiffre (8), calculer un indicateur (32), trancher un fait (12), nommer un poste (12) : **64 questions** |
| **Barème** | Un point par question, sur un seul critère : celui que la question pose |
| **Tolérance** | 0,5 % de la référence, ou la moitié de son dernier chiffre affiché si c'est plus large |
| **Modèles** | Les 27, comme pour les factures |
| **Runs** | `2026-10-07_analyse-financiere` (50 questions, 1 350 appels) et `2026-10-08_analyse-financiere` (17 questions, 459 appels), fusionnés. Environ 12,6 $ débités, contre 12,1 $ suivis |

Un critère que la vérité terrain d'une question **ne déclare pas** n'est pas noté pour elle.
Avant cette règle, il se lisait `null`, donc « absent du document », et rapportait des points
à un modèle qui n'avait rien répondu. C'est le piège du `null` silencieux, sous une autre forme.

## 9.2 Résultats

64 questions classées sur 67 préparées, 27 modèles.

| Palier | Modèles |
|---|---:|
| 100 % | 7 |
| 90 à 99,9 % | 11 |
| 70 à 89,9 % | 1 |
| Moins de 70 % | 8 |

**Le haut du classement ne se départage pas** : sept modèles à 100 %, ordonnés par le prix puis
la vitesse. **Ce sont les mêmes sept sur les 48 questions du premier tirage et sur les 64** : les
seize calculs ajoutés ne les ont pas départagés. Ils ont surtout pénalisé le bas du classement :
trois modèles sont passés de la tranche 70-89,9 % à celle sous 70 %. Ce qui sépare ces sept des
suivants est surtout la question de Netflix (marge d'EBITDA), ratée par 17 modèles sur 27 : sept y ajoutent
les deux lignes d'amortissement des contenus (3 405 + 79 millions) au « D&A » et trouvent 56,83 %
au lieu de 5,4 %. La référence prend la ligne nommée D&A, ce que la question demande ; elle est
gardée, et sans elle dix modèles seraient parfaits.

En bas, Nova Pro et Nova Lite (33 et 30 %) sont les seuls à inventer une réponse sur les trois
questions où il n'y en a pas (trois hallucinations en tout). Le classement est stable :
corrélation de rang de 0,97 à 1,00 selon la tolérance, les nombres seuls, les calculs seuls ou le
premier tirage seul ; **0,86** sur les verdicts et libellés seuls, où quatorze modèles sont
parfaits et l'ordre se joue sur très peu de questions. À 0,1 %, plus aucun modèle n'est parfait :
tous ratent la question 3M, dont la référence (8,70) est inexacte (la page porte 8 738 millions).

**Pour départager les sept premiers, ce jeu ne suffit pas.** Ils ne se trompent sur aucune des 64
questions. Il faut des questions où les meilleurs modèles échouent : FinanceMath ou FinQA (calculs
plus longs, licence MIT, entrée texte à écrire), ou davantage de pages par question.

## 9.3 Les erreurs commises, à ne pas reproduire

**Un extracteur de réponses trop étroit transforme des réponses justes en échecs.** Il
prenait tout ce qui sépare la première `{` de la dernière `}`. Une explication contenant des
accolades, ou la réponse écrite deux fois, le rendait illisible : 7 appels payés sur 1 350, tous
chez Mistral. Or un document en échec chez un seul modèle sort du classement **pour les 27** :
une vingtaine de questions sur 50 étaient touchées. → L'extracteur parcourt maintenant les
objets un à un, les réunit tant qu'ils ne se contredisent pas, et rejette sinon. **Garder le
texte rejeté** (2 000 caractères, contre 160) : c'est tout ce qui reste d'un appel facturé.

**Une consigne d'unité peut déplacer l'échelle d'une réponse.** « Un pourcentage de 12,5 %
s'écrit 12.5 » a poussé 21 modèles sur 23 à écrire le rendement des actifs de Coca-Cola en
pourcentage (1,42) quand la référence est le ratio arrondi (0,01). La valeur lue était juste.
Les deux questions ROA (Coca-Cola, AES) ont été écartées après le run, avec leur motif.
→ Au tri, vérifier non seulement que l'unité des montants est imprimée sur la page, mais
**l'échelle des ratios**. Une référence arrondie qui ne distingue pas 0,5 % de 1,5 % est de
toute façon une question mal posée. Repérée par la répartition des erreurs par question :
une question que presque tout le panel rate est d'abord suspecte.
**Le défaut est revenu dans l'extension, sous un autre nom** : le taux de distribution des
dividendes (écarté avant le run) a un complément, le taux de rétention (fb-10136), qui nous a
échappé : 8 modèles sur 17 l'ont écrit en pourcentage (54,0), 3 en ratio (0,54). → Le tri doit
écarter **une famille de ratios** (rendement, distribution, rétention, marges exprimées en
ratio…), pas une question à la fois, et se refaire sur la répartition des réponses d'un run.

**Une liste de formes acceptées écrite avant le run peut être trop étroite.** Pour les trois
questions « quelle activité a rapporté le plus de trésorerie », les pages impriment « Net
cash provided by operating activities » (AMD), « Total cash provided by operating
activities » (Best Buy), « Cash provided (used) by operations » (Nike) : **12 réponses
nommant la ligne imprimée ont été refusées**, dont celles de Claude Fable 5.1 et Opus 5.5. Le
correctif fait passer de 5 à 12 le nombre de modèles à 100 % (sur le classement à 45 questions d'alors). → Pour un libellé, lister les
formes imprimées sur la page, pas seulement les génériques. **Et regarder les réponses
fausses question par question** : aucun contrôle statistique ne l'aurait montré.

**`eval:review` ne présente pas les réponses jugées fausses.** La spec disait que les libellés
non reconnus iraient à l'arbitrage humain ; le code ne sélectionne que les hallucinations, les
écritures différentes jugées justes et un échantillon de contrôle. Un libellé non reconnu n'y
passe donc jamais. À corriger avant de s'appuyer sur l'arbitrage pour un benchmark à libellés.

**Un plafond de jetons commun coûte des questions entières.** 10 appels de 7 modèles ont
réfléchi jusqu'à 8 000 jetons (20 000 pour Cohere) sans écrire de réponse : 0,61 $ facturés
pour rien. Le plafond a été relevé à 16 000 pour Kimi K3, Kimi K2.6, Qwen 3.7 Flash et
Qwen 3.8 Max (`cli.ts`), et rien n'a été récupéré pour Kimi K3 sur la question Netflix.

**`--resume --models` réécrivait `run.json` avec les seuls modèles relancés.** Sauvegardé puis
restauré à la main à chaque rejeu. Corrigé le 08/10 dans `runTask` : la reprise garde les
modèles du run, son nombre de documents et sa date de départ, et met à jour la version des
modèles relancés (la version fraîchement servie prime sur celle d'une réponse réutilisée).

**Un run lancé avec un solde insuffisant s'arrête proprement.** L'extension a épuisé le crédit
aux trois quarts : 17 appels ont été refusés (402 « le coût maximal dépasse le crédit
disponible »), enregistrés sans coût, et se rejouent avec `--resume`. Ne rien conclure d'un
run tant qu'il contient des refus de ce type : les modèles les plus chers y sont les premiers
touchés, ce qui fausserait un classement lu trop tôt.

**Le coût suivi sous-estime la dépense réelle**, de 2 à 6 % selon le moment (8,45 $ suivis
contre environ 9,0 $ débités) : des appels interrompus sont facturés sans être enregistrés.

**`npm run typecheck` ne couvre pas le site.** Il n'inclut que `packages/` ; le site se vérifie
avec `cd apps/web && npx tsc --noEmit`, puis `next build`.

## 9.4 Une règle changée après le premier run

Le premier classement retirait une question à tout le panel dès qu'un modèle n'y répondait pas.
Cinq échecs ont fini par rester sans réponse exploitable, tous imputables au modèle : Kimi K3
(16 000 jetons de réflexion sans écrire de réponse, sur Netflix), Mistral Large trois fois (deux
réponses contradictoires dans le même texte, la dernière étant juste deux fois sur trois), Ministral
8B (une soustraction à la place d'un nombre). **Ces questions comptaient parmi les plus disputées** :
sur Netflix, 16 des 26 modèles qui ont répondu se trompent, dont 5 des 12 modèles alors parfaits.
Les retirer rendait le test plus facile.

La règle devient : un échec compte contre le modèle quand **il** n'a rien rendu d'exploitable, et il
y est noté « manquant », lui seul, la question restant classée pour tous. Un échec venu de nous
(refus de débit, crédit épuisé, extracteur trop étroit) ne compte jamais contre lui. Chaque échec
imputé est lu, motivé, et listé dans `data/tasks/<tâche>/echecs-imputes.json` ; le site l'affiche.
Le verdict est forcé « manquant » et non calculé sur une réponse vide : sur une question dont la
bonne réponse est « il n'y en a pas », une réponse vide serait juste.

Le changement a été décidé après avoir vu l'effet de la règle précédente, mais il rend le test plus
exigeant et non plus flatteur : il est écrit ici pour que personne n'ait à le deviner.

## 9.5 Commandes

```bash
npm run financebench:prepare                       # télécharge, vérifie, rend les 60 pages, écrit manifeste et vérité terrain
npm run eval:run -- --task analyse-financiere --estimate
npm run eval:run -- --task analyse-financiere --run <id>                 # un second run : ajouter --deja <run précédent>
npm run eval:score -- --task analyse-financiere --run <id>
npm run eval:publish -- --task analyse-financiere --run <id1>,<id2>      # plusieurs runs : séparés par une virgule
```

`data/tasks/analyse-financiere/exclusions.json` écarte une question après coup, avec son motif :
le run et la notation la sautent, ses réponses restent consultables, et le site la liste.

## 9.6 Ce que la vérification du site a trouvé (8 octobre)

Le classement publié était juste ; ce qui l'entourait ne l'était pas partout. Chaque page a été
comparée aux fichiers de `data/`, chiffre par chiffre, dans un navigateur : tableaux, tris,
filtres, nuages de points, 27 fiches modèles, comparateur, 168 adresses et 276 ancres.

**Les chiffres concordaient tous.** Les défauts étaient dans ce qui les commente.

1. **80 réponses affichées comme des abstentions.** Sous « Les documents qui départagent », la
   page du benchmark finance écrivait « le modèle s'abstient » pour tous les modèles des trois
   questions montrées (80 lignes sur 81), y compris ceux notés justes. Cause : la page lisait la réponse sous
   l'identifiant du critère (`calcul`), alors que les questions financières se répondent toutes
   sous la clé `answer`. Les notes n'étaient pas touchées, seul l'affichage l'était. Corrigé par
   `cleReponse` dans `apps/web/src/lib/data.ts`.
2. **Une courbe de stabilité qui mêlait deux benchmarks.** Sur les 27 fiches modèles, la courbe
   « d'un run à l'autre » mettait bout à bout trois publications des factures et celle des
   questions financières : Mistral Large y passait de 97,8 % à 53,1 %, comme s'il avait dérivé.
   Cause : une moyenne par date, écrite quand le hub n'avait qu'un benchmark. Il y a désormais
   une courbe par benchmark, et un benchmark publié une seule fois le dit au lieu d'en tracer une.
3. **Une égalité racontée comme un podium.** « DeepSeek V4.1 Flash prend la tête, devant
   Kimi K2.6 et Qwen3.8 Max » : ces trois-là, et quatre autres, ont le même score. La phrase
   nomme désormais les ex æquo et dit que le test ne les départage pas. La règle d'égalité
   comparait l'écart à la marge avec « < » : deux modèles à 100 % ont une marge nulle, et
   « 0 < 0 » les déclarait départagés.
4. **Des textes restés à l'état d'avant.** « 2 benchmark mesuré », « 2 mesuré à ce jour » ; la
   page À propos annonçait « vingt-cinq documents » pour des tests de 100 et 64 ; la méthode du
   hub affirmait que « les échecs ne pénalisent pas la note d'un modèle », ce que le benchmark
   finance contredit pour cinq réponses ; le fil d'Ariane des tâches au programme visait seize
   ancres absentes.

Deux fichiers de tests gardent ces liaisons : `packages/eval/src/chaine.test.ts` rejoue la
chaîne réponses brutes → notes → classement publié → historique, et échoue si un fichier publié
ne sort plus de ses runs ; `apps/web/src/lib/liaisons.test.ts` vérifie ce que les pages
reçoivent, dont la règle « une réponse notée juste n'est jamais montrée comme une abstention ».

La leçon : **publier un deuxième benchmark, c'est aussi relire tout ce qui avait été écrit pour
un seul.** Les phrases, les moyennes et les accords qui tenaient avec une tâche ne tiennent pas
d'office avec deux.

---

# 10. Épreuve de départage sur FinQA (8 octobre 2026) — non publiée

**But.** Départager les sept modèles à 100 % sur l'analyse de rapports financiers.

**Protocole.** FinQA (Chen et al., 2021, licence MIT) : calculs sur un extrait de rapport annuel,
envoyé en texte. Sur les 84 calculs à trois étapes ou plus du jeu de test, 48 sont éligibles et 36
écartés avec un motif (22 ratios sans signe %, à l'échelle ambiguë ; 12 réponses écrites qui
contredisent leur propre programme de calcul ; 2 réponses vides). Les 40 premières dans l'ordre de
l'empreinte SHA-256 de `workbench-finqa-v1:` + identifiant sont posées. Sept modèles, 280 appels,
3,24 $ suivis. Run `2026-10-08_departage-finqa`, tâche `data/tasks/departage-finqa/`.

**Règle posée avant le run.** Une question où les sept modèles donnent la même réponse, différente
de la référence, est une référence suspecte et sort du compte. Cinq questions sur 40 sont dans ce
cas (fq-04, fq-11, fq-16, fq-21, fq-29) ; une sixième n'a pas été lue par tous. Reste 34 questions.

| Modèle | Justes sur 34 | Sans les 3 questions d'intention ou d'unité (31) |
|---|---:|---:|
| GPT-6 Astra | 32 | 29 |
| Claude Opus 5.5 | 30 | 27 |
| Claude Fable 5.1 | 29 | 26 |
| Qwen 3.8 Max Prime | 28 | 28 |
| Qwen 3.8 Max 0902 | 27 | 26 |
| Kimi K2.6 | 24 | 24 |
| DeepSeek V4.1 Flash | 24 | 23 |

**Ce que l'épreuve dit, et ne dit pas.** Les sept ne sont plus à égalité : GPT-6 Astra est premier
et Kimi K2.6 et DeepSeek V4.1 Flash derniers, quelle que soit la variante. **Le milieu ne se
départage pas** : les marges d'erreur vont de ±8 à ±15 points, et l'ordre de Claude Opus, Claude
Fable et des deux Qwen change selon qu'on garde ou non trois questions où l'erreur tient à
l'intention de la question (« total return » : le gain ou la valeur finale) ou à l'unité (milliers
ou millions). Seules 11 questions sur 34 départagent quelqu'un. Les deux classements divergent :
**à ne pas publier comme un classement.**

**Leçons.** Une question sur huit de FinQA a une référence que sept modèles contredisent d'une seule
voix, en plus des 12 que le recoupement avec le programme avait déjà écartées : ce jeu ne s'utilise
pas sans ces deux filtres. Deux questions restent fausses pour tous avec des réponses divergentes
(fq-05, fq-10) : elles ne départagent personne. Pour séparer le milieu du groupe, il faudrait une
centaine de questions propres, pas quarante.

---

# 11. Publier, et tester un modèle sorti après coup (8 octobre 2026)

## 11.1 Ce qui part en ligne

Le site n'a pas de base de données : il lit `data/` au moment où il se construit. **Les fichiers
partent tels quels.** Ce que le pipeline a écrit est versionné et poussé sans retouche, et un
chiffre faux ne se corrige jamais dans un fichier publié : on corrige ce qui l'a produit, on
renote ou on republie, et le fichier change de lui-même.

| Fichier | Ce qu'il contient | Écrit par |
|---|---|---|
| `data/runs/<run>/raw/<modèle>/<document>.json` | La réponse brute, son coût, son temps, l'hébergeur, la version déclarée, la date de l'appel | `eval run`, jamais modifié |
| `data/runs/<run>/run.json` | Les modèles du run, leur version datée, l'empreinte du prompt | `eval run` |
| `data/runs/<run>/calendrier.json` | Les dates d'appel des runs antérieurs au 8 octobre, relevées une fois | relevé du 8 octobre |
| `data/runs/<run>/scores.json` | La note de chaque réponse | `eval score` |
| `data/published/<tâche>.json` | Le classement : seul fichier que lisent tableaux et graphiques | `eval publish` |
| `data/published/history/<tâche>.json` | Les passages successifs du test | `eval publish` |
| `data/published/protocoles/<tâche>.json` | Le test figé (11.3) | `eval publish` |
| `data/catalogue/*.json` | Modèles, labos, métiers, fiches des benchmarks | à la main, et `catalogue:sync` |
| `data/news.json` | Les actualités | à la main |

Deux tests gardent la chaîne : `packages/eval/src/chaine.test.ts` échoue si un classement publié
ne sort plus de ses runs ou si son test figé ne correspond plus à ce que le pipeline enverrait ;
`apps/web/src/lib/liaisons.test.ts` vérifie ce que les pages reçoivent.

Seule exception au « tout est versionné » : les pages rendues des factures, 206 Mo, que
`npm run deepform:prepare` régénère depuis l'archive publique. Le test figé garde l'empreinte de
chaque document, ce qui permet de prouver qu'elles sont revenues à l'identique.

## 11.2 Une publication, une actualité

Mettre un classement en ligne s'accompagne d'un article dans `data/news.json`, daté du jour de la
mesure et lié au benchmark (`"benchmark": "<id>"`). Il dit ce qui a été mesuré, ce que ça donne,
ce qui a été corrigé en chemin et ce que la mesure ne dit pas. Un modèle ajouté ou une règle de
notation changée en demandent un aussi. Sans lui, l'accueil continue d'annoncer la publication
d'avant : c'est ce qui est arrivé le 8 octobre, où le benchmark finance était prêt et l'accueil
titrait toujours sur les factures.

## 11.3 Le test figé

À chaque publication, `eval publish` écrit `data/published/protocoles/<tâche>.json` :

- **les documents du test**, un par un, avec leur nombre de pages et une **empreinte** de ce que le
  modèle reçoit : le prompt envoyé avec le document, puis chaque page, octet pour octet ;
- l'empreinte du **prompt** (la même que dans chaque `run.json`) et celle du **barème** ;
- les **paramètres d'appel** : plafond de jetons, plafonds relevés pour certains modèles, report
  d'hébergeur autorisé ;
- pour **chaque modèle** : la version que le fournisseur a déclarée, la **version datée** vers
  laquelle son identifiant pointait (`anthropic/claude-opus-5.5-20260921`) avec le jour du relevé,
  la date de son premier et de son dernier appel, et les hébergeurs qui l'ont servi.

Les versions datées viennent du champ `canonical_slug` du catalogue d'OpenRouter. Pour les runs
de septembre et d'octobre 2026, elles ont été relevées le 8 octobre, après coup : la date du
relevé est écrite à côté. Les runs suivants les consignent au lancement, dans `run.json`.

## 11.4 Ajouter un modèle : la marche à suivre

Le jour où un modèle sort, il passe **le test publié**, pas un test voisin.

```bash
# 1. Déclarer le modèle : data/catalogue/models.seed.json (nom, labo, date, poids),
#    la liste HUB_MODELS de packages/eval/src/models.ts, puis :
npm run catalogue:sync

# 2. Chiffrer, annoncer le montant, attendre l'accord.
npm run eval:run -- --task analyse-financiere --models <alias> --test-publie --estimate

# 3. Lancer : les documents sont ceux du test figé, vérifiés un par un avant le premier appel.
npm run eval:run -- --task analyse-financiere --models <alias> --test-publie --run <date>_analyse-financiere

# 4. Noter, puis publier ce run avec ceux qui le sont déjà.
npm run eval:score -- --task analyse-financiere --run <date>_analyse-financiere
npm run eval:publish -- --task analyse-financiere --ajouter <date>_analyse-financiere

# 5. Écrire l'actualité (11.2), lancer les tests, construire le site, pousser.
```

`--test-publie` s'arrête sans rien dépenser si le prompt, le barème ou une seule page a changé
depuis la publication, et dit laquelle. Il ne se combine pas avec `--limit`, `--max-pages`,
`--max-pixels` ni `--deja` : le test publié fixe déjà ses documents.

Ajouter un modèle ne re-teste pas les autres. L'historique d'un benchmark ne reçoit donc pas de
nouveau point : une publication qui reprend tous les runs de la précédente la remplace. Les
factures avaient été publiées trois fois, sur 56, 70 puis 100 documents, et l'historique en
faisait trois points « dans le temps » — 97,3 %, 96,8 %, 97,8 % pour un même modèle — alors que
seul l'échantillon avait grossi. Il n'en reste qu'un. Un point d'historique, c'est un nouveau
passage du test : des runs que la publication d'avant n'avait pas.

## 11.5 Statut des poids : quatre modèles vérifiés le 8 octobre

Quatre modèles portaient « non communiqué » et n'entraient dans aucun des deux filtres.

| Modèle | Statut | Ce qui le fonde |
|---|---|---|
| Command A+ | **ouverts** | Dépôt `CohereLabs/command-a-plus-05-2026` sur Hugging Face, licence Apache 2.0, poids téléchargeables |
| Qwen3.7 Flash | **fermés** | Aucun dépôt Qwen3.7 dans l'organisation Qwen de Hugging Face ; classé « closed weights » par Epoch AI |
| Qwen3.8 Max Prime | **fermés** | Offre hébergée par Alibaba Cloud seul, aucun dépôt de poids |
| Qwen3.8 Max (0902) | **fermés** | Voir ci-dessous |

Le cas de Qwen3.8 Max (0902) demande une phrase. Alibaba a publié en août des poids de cette
famille (`Qwen/Qwen3.8-2.4T-A95B`, licence propre), mais ils sont **en texte seul**. La version
que nous avons testée est l'instantané hébergé du 2 septembre, qui lit les images — et nos deux
benchmarks envoient des images. Ce que nous avons mesuré ne se télécharge donc pas : « fermés »
décrit le modèle testé, pas la famille.

À revoir aussi : la date de sortie du catalogue est celle de l'arrivée du modèle sur OpenRouter.
Pour Command A+, c'est le 22 septembre 2026, alors que ses poids sont publics depuis mai.
