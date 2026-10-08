# Deuxième benchmark : analyse de rapports financiers

**Date** : 2026-10-07
**Statut** : construit les 7 et 8 octobre 2026. Écarts à cette spec, tous motivés dans `METHODOLOGIE.md` § 9 :
trois questions écartées après les runs pour échelle ambiguë (deux rendements des actifs, un taux de
rétention) ; formes acceptées complétées après le premier run ; extension de 17 calculs ; règle des
échecs imputés au modèle à la place du retrait de la question pour tout le panel ; 64 questions classées
au lieu des 50 annoncées. Le texte ci-dessous est la spec telle qu'elle a été validée.

## La demande

Ouvrir un deuxième métier après la comptabilité, avec une tâche peu chère, rapide à
monter, dont les bonnes réponses sont déjà écrites par des humains. Choix de Fantin le
6 et le 7 octobre : la fiche Finance du site, sur le jeu FinanceBench, en n'envoyant au
modèle que les pages de référence, sur **50 questions réparties entre plusieurs formes de
réponse vérifiables sans relecture**, et en gardant les documents pour montrer le jeu de
travail et la méthode.

## Ce qui a été vérifié avant d'écrire

Tout vient du jeu lui-même, lu le 6 et le 7 octobre, sans aucun appel de modèle.

| | |
|---|---|
| **Jeu** | FinanceBench, Patronus AI — 150 questions ouvertes (les 10 231 annoncées sont privées) |
| **Licence** | CC BY-NC 4.0 (fiche Hugging Face) ; aucun fichier de licence sur GitHub. La feuille de route disait « permissive, à confirmer » : c'était faux. Fantin confirme un usage non commercial |
| **Documents** | 84 rapports de 32 sociétés cotées américaines : rapports annuels (10-K), trimestriels (10-Q), communiqués de résultats, annonces (8-K) |
| **Vérité terrain** | Une réponse par question, écrite par un analyste humain, avec la page de preuve et, pour les calculs, la formule |
| **Pages** | Numérotées à partir de zéro dans le jeu. Les 59 pages du périmètre retenu ont été comparées au texte des PDF : 59 conformes |
| **Unités** | Pour les 50 questions de la famille « calcul d'indicateur » du jeu, d'où viennent 24 des 26 nombres retenus, l'unité (millions ou milliers) est imprimée sur la page de référence : 50 sur 50 |
| **Arrondis** | Les références sont arrondies : la page porte 1 615,9, la référence dit 1 616 ; la page porte 302 578 milliers, la référence dit 303 millions |

## La tâche

1. **La fiche du site garde son identifiant** `analyse-financiere` et change de contenu.
   Elle s'appelait « Analyse de liasse fiscale » et décrivait une liasse de PME française,
   des soldes intermédiaires de gestion et un commentaire rédigé : rien de cela n'est
   mesuré. Nouveau libellé : **« Analyse de rapports financiers »**. Question métier :
   « Pages du rapport sous les yeux, un modèle répond-il juste aux questions d'un
   analyste ? »
2. **Un document = une question et ses pages.** Le modèle reçoit une ou deux pages du
   rapport en image, rendues comme les factures, et la question d'origine en anglais, mot
   pour mot. On ne traduit pas et on ne reformule pas : c'est en précisant une consigne
   qu'on l'a rendue fausse sur les factures.
3. **Quatre sous-tâches**, qui remplacent celles de la fiche actuelle :

| Sous-tâche | Ce que le modèle rend | Questions |
|---|---|---:|
| `releve` — relever un chiffre | un nombre | 8 |
| `calcul` — calculer un indicateur | un nombre | 18 |
| `verdict` — trancher un fait | oui, non ou sans objet | 12 |
| `libelle` — nommer un poste | un libellé court, ou « aucun » | 12 |

## Le périmètre : 50 questions

### Le tri d'éligibilité

Les 150 questions ont été lues une à une. **91 sont éligibles, 59 sont écartées**, chacune
avec son motif. Le tri complet est dans
[2026-10-07-analyse-rapports-financiers-tri.csv](2026-10-07-analyse-rapports-financiers-tri.csv),
une ligne par question, à valider.

| Motif d'exclusion | Questions |
|---|---:|
| Explication rédigée : seul un humain peut la noter | 27 |
| Oui / non d'opinion : le seuil est laissé au jugement de l'analyste | 8 |
| Nombre dont l'unité ou la définition n'est pas fixée par la question | 11 |
| Oui / non sur un fait mal défini, daté ou répondable sans le document | 8 |
| Libellé ambigu ou référence incohérente | 5 |

Ce tri est une lecture de ma part, pas une mesure : il décide de ce qui est posé, jamais
de qui a raison. Les réponses de référence restent celles des analystes.

### Le tirage

Les 50 questions sont tirées parmi les 91 par une règle qui ne dépend de personne :

- un quota par forme de réponse, ci-dessous ;
- dans chaque forme, les questions sont rangées selon l'empreinte SHA-256 de
  `workbench-finance-v1:` suivi de leur identifiant, et prises dans cet ordre ;
- pas plus de deux questions d'une même société dans une même forme.

| Forme | Éligibles | Retenues | Pourquoi ce quota |
|---|---:|---:|---|
| Relevé d'un chiffre | 16 | 8 | |
| Calcul d'un indicateur | 36 | 18 | Les nombres font un peu plus de la moitié : c'est la forme qui départage le mieux |
| Oui | 15 | 5 | |
| Non | 6 | 6 | Toutes prises, pour qu'un modèle qui répond toujours « oui » plafonne à 5 sur 12 |
| Sans objet | 1 | 1 | L'indicateur demandé n'a pas de sens pour cette société (marge brute d'une banque) |
| Libellé | 14 | 9 | |
| Aucun | 3 | 3 | Questions pièges : la bonne réponse est « il n'y en a pas » |

Le tirage donne 27 sociétés, 42 rapports (37 annuels, 4 trimestriels, 1 communiqué) et
59 pages distinctes. 40 questions tiennent sur une page, 10 sur deux ; une page sert à
deux questions.

### Les 50 questions

Les pages sont données comme un lecteur de PDF les affiche (la première page porte le
numéro 1). La colonne « Attendu » est la réponse de l'analyste, telle qu'elle sera
comparée ; pour les verdicts et les libellés, c'est ma transcription de sa phrase, à
valider.

| # | Sous-tâche | Société | Rapport | Page | Attendu | Identifiant |
|---:|---|---|---|---|---|---|
| 1 | `releve` | Best Buy | BESTBUY_2019_10K | 52 | $5409.00 | 04417 |
| 2 | `releve` | AES Corporation | AES_2022_10K | 132 | 0 | 01319 |
| 3 | `releve` | Amcor | AMCOR_2020_10K | 50 | $1616.00 | 03882 |
| 4 | `releve` | Microsoft | MICROSOFT_2016_10K | 52 | $32780.00 | 04700 |
| 5 | `releve` | Nike | NIKE_2019_10K | 54 | $16525.00 | 03531 |
| 6 | `releve` | Costco | COSTCO_2021_10K | 38 | $59268.00 | 04209 |
| 7 | `releve` | 3M | 3M_2018_10K | 58 | $8.70 | 04672 |
| 8 | `releve` | 3M | 3M_2018_10K | 60 | $1577.00 | 03029 |
| 9 | `calcul` | Walmart | WALMART_2019_10K | 48 | 0.2% | 04784 |
| 10 | `calcul` | MGM Resorts | MGMRESORTS_2020_10K | 65, 67 | 7.9% | 03849 |
| 11 | `calcul` | Coca-Cola | COCACOLA_2017_10K | 74, 76 | 0.01 | 03473 |
| 12 | `calcul` | AES Corporation | AES_2022_10K | 130, 132 | -0.02 | 10420 |
| 13 | `calcul` | Best Buy | BESTBUY_2017_10K | 56 | 2.8% | 02608 |
| 14 | `calcul` | Kraft Heinz | KRAFTHEINZ_2019_10K | 50, 52 | 6.25 | 10499 |
| 15 | `calcul` | Coca-Cola | COCACOLA_2021_10K | 62 | 39.7% | 09724 |
| 16 | `calcul` | Walmart | WALMART_2020_10K | 51, 56 | 6.2% | 06741 |
| 17 | `calcul` | American Water Works | AMERICANWATERWORKS_2021_10K | 86, 88 | $1832.00 | 04254 |
| 18 | `calcul` | General Mills | GENERALMILLS_2020_10K | 52 | $3215.00 | 04854 |
| 19 | `calcul` | AMD | AMD_2015_10K | 56, 60 | 4.2% | 03069 |
| 20 | `calcul` | Lockheed Martin | LOCKHEEDMARTIN_2022_10K | 63 | 0.4% | 03718 |
| 21 | `calcul` | CVS Health | CVSHEALTH_2018_10K | 302, 304 | 17.98 | 05915 |
| 22 | `calcul` | PepsiCo | PEPSICO_2022_10K | 62, 64 | $9068.00 | 03620 |
| 23 | `calcul` | Block | BLOCK_2016_10K | 68 | 1.73 | 04660 |
| 24 | `calcul` | Nike | NIKE_2018_10K | 46 | 55.1% | 04302 |
| 25 | `calcul` | General Mills | GENERALMILLS_2020_10K | 50 | 0.68 | 03471 |
| 26 | `calcul` | Netflix | NETFLIX_2015_10K | 40, 42 | 5.4% | 04458 |
| 27 | `verdict` | JPMorgan | JPMORGAN_2023Q2_10Q | 85 | oui | 02049 |
| 28 | `verdict` | Pfizer | PFIZER_2021_10K | 59 | oui | 00302 |
| 29 | `verdict` | AMD | AMD_2022_10K | 12 | oui | 00757 |
| 30 | `verdict` | Best Buy | BESTBUY_2024Q2_10Q | 17 | oui | 00460 |
| 31 | `verdict` | Boeing | BOEING_2022_10K | 62 | oui | 00517 |
| 32 | `verdict` | Microsoft | MICROSOFT_2023_10K | 60 | non | 00552 |
| 33 | `verdict` | Johnson & Johnson | JOHNSON_JOHNSON_2022Q4_EARNINGS | 1 | non | 00651 |
| 34 | `verdict` | PepsiCo | PEPSICO_2022_10K | 26 | non | 00735 |
| 35 | `verdict` | Verizon | VERIZON_2022_10K | 77 | non | 00566 |
| 36 | `verdict` | Amcor | AMCOR_2023_10K | 50 | non | 00684 |
| 37 | `verdict` | Adobe | ADOBE_2022_10K | 54 | non | 00438 |
| 38 | `verdict` | JPMorgan | JPMORGAN_2022_10K | 3 | sans objet | 00206 |
| 39 | `libelle` | MGM Resorts | MGMRESORTS_2023Q2_10Q | 11 | corporate bonds | 00407 |
| 40 | `libelle` | 3M | 3M_2022_10K | 25 | Consumer | 01865 |
| 41 | `libelle` | AMD | AMD_2022_10K | 58 | operations | 01279 |
| 42 | `libelle` | American Express | AMERICANEXPRESS_2022_10K | 98 | Customer deposits | 01964 |
| 43 | `libelle` | Best Buy | BESTBUY_2023_10K | 42 | operating activities | 01275 |
| 44 | `libelle` | AMD | AMD_2022_10K | 48 | Data Center | 00563 |
| 45 | `libelle` | Verizon | VERIZON_2021_10K | 85 | Cross currency swaps | 00859 |
| 46 | `libelle` | JPMorgan | JPMORGAN_2021Q1_10Q | 19 | Corporate | 00299 |
| 47 | `libelle` | Nike | NIKE_2023_10K | 62 | operations | 01163 |
| 48 | `libelle` | American Express | AMERICANEXPRESS_2022_10K | 1 | aucun (`null`) | 00476 |
| 49 | `libelle` | Ulta Beauty | ULTABEAUTY_2023_10K | 1 | aucun (`null`) | 00746 |
| 50 | `libelle` | Ulta Beauty | ULTABEAUTY_2023_10K | 57 | aucun (`null`) | 00521 |

### Si une question tombe

Une question retenue qui échoue à une vérification gratuite (page illisible, référence
qu'on ne retrouve pas) est écartée avec son motif et remplacée par la suivante de sa
forme dans l'ordre du tirage. Les formes « non », « sans objet » et « aucun » n'ont pas
de réserve : le total descend alors sous 50, et c'est annoncé.

## Ce que reçoit le modèle

Un texte commun, puis la question, puis le format attendu selon la forme. Brouillon à
valider :

```
You are given one or two pages of a company's financial report, as images, and one
question. Answer from these pages only, with a JSON object and nothing around it.

Question: {question}
```

| Forme | Consigne de format |
|---|---|
| Nombre | A plain decimal number: no currency symbol, no thousands separator, no unit. Use the unit the question asks for; a percentage of 12.5% is written `12.5`. |
| Verdict | `"yes"`, `"no"` or `"not_applicable"`. Use `"not_applicable"` only when the question itself invites you to say the metric is not relevant for this company, and it is not. |
| Libellé | The short name of the item, as printed on the page. If the pages show there is none, answer `null`. |

La consigne « réponds `null` s'il n'y en a pas » est donnée aux douze questions de
libellé, pas aux trois seules questions pièges : elle ne les désigne pas.

## La notation

4. **Un critère par sous-tâche, et chaque question n'en porte qu'un.** Un critère que la
   vérité terrain d'une question ne déclare pas n'est pas noté pour elle. Aujourd'hui, il
   serait lu comme `null`, donc « absent du document », et un modèle serait compté juste
   sans avoir rien fait : c'est le piège du `null` silencieux, à fermer dans
   `scoreDocument` avant tout run.
5. **Nombres** — règle validée par Fantin le 7 octobre : juste si l'écart ne dépasse pas
   **0,5 % de la référence**, ou **la moitié du dernier chiffre affiché** par la
   référence, selon le plus large des deux. Exemples : référence 1 616 → 1 615,9 est
   juste ; référence 303 → 302,578 est juste ; référence 1,9 % → 1,94 est juste, 2,0 ne
   l'est pas. La tolérance « au centime » des factures ne change pas.
6. **Verdicts** — égalité stricte entre `yes`, `no` et `not_applicable`. Seul le verdict
   est noté, pas la justification.
7. **Libellés** — la référence est une liste de formes acceptées (« operations »,
   « operating activities »), écrite à la préparation. Une réponse que le comparateur ne
   reconnaît pas est comptée fausse, puis portée à l'arbitrage humain avant publication :
   au plus 12 questions × 27 modèles, en pratique les seuls écarts.
8. **Quatre verdicts, inchangés** : correct, faux, manquant, halluciné. « Halluciné » ne
   peut tomber que sur les trois questions pièges ; le site l'affiche comme un compte
   sur 3, jamais comme un pourcentage.
9. **Mesures publiées** : exactitude (questions justes sur 50, poids égal), exactitude par
   sous-tâche, coût et latence par question. « Sans relecture » se confond ici avec
   l'exactitude, puisqu'une question n'a qu'une case : la page n'en montre qu'une.

## Ce qu'on garde et ce que le site montre

10. **Le manifeste est versionné** (`data/tasks/analyse-financiere/`) : identifiant,
    société, rapport, pages, sous-tâche, question, réponse attendue, formule de l'analyste,
    lien vers le PDF source. C'est lui qui fixe le périmètre.
11. **Les 59 pages rendues** sont versionnées si leur total reste sous 20 Mo, mesuré
    avant de commiter. Le site montre alors, pour chaque question, la page exacte vue par
    le modèle. Les 42 rapports entiers (98 Mo) restent hors du dépôt, retéléchargés à
    l'identique par la préparation.
12. **La page du benchmark** porte le tableau « Les questions posées » : société, rapport,
    page, question, réponse attendue, nombre de modèles justes, lien vers la source. Même
    principe que « Les documents analysés » des factures.
13. **La page Méthodologie** reçoit une partie « Protocole : analyse de rapports
    financiers » — périmètre, tri, tirage, barème, verdicts, prompt, limites — avant toute
    publication (`apps/web/src/components/about/content.ts`).
14. **Mention de source** sur la page : « FinanceBench, Patronus AI, CC BY-NC 4.0 ».

## Vérifications

**Avant de payer.** La préparation s'arrête à la première qui échoue.

- Chaque page rendue correspond au texte de la page dans le jeu (fait sur brouillon : 59 sur 59).
- Regarder les pages rendues à l'œil : les petits caractères des tableaux doivent être lisibles.
- Plafonner la taille de page au rendu, pour des images de poids comparable.
- Pour les nombres, l'unité est imprimée sur la page ; pour les libellés, la forme attendue y figure.
- Refaire les 18 calculs à partir de la formule de l'analyste. Un écart n'est pas corrigé : il est soumis à Fantin, qui tranche.
- `npm run key:check` pour le solde réel, puis `npm run eval:run -- --task analyse-financiere --estimate`. Le compteur doit annoncer 50 documents. Le montant est annoncé, et le run attend l'accord de Fantin.

**Avant de publier.**

- Répartition des erreurs par sous-tâche et par question. Une question que presque tous
  les modèles ratent est d'abord suspecte, pas difficile.
- Deux comparaisons de classement : les 26 nombres seuls contre les 50 ; la tolérance à
  0,1 % et à 1 % contre celle à 0,5 %. Si le classement bouge, on ne publie pas.
- Arbitrage humain des libellés non reconnus et des hallucinations.

## Coût

Projection : **10 à 15 $** pour 50 questions et 27 modèles, soit 1 350 appels. Elle est
tirée des jetons réellement consommés sur les factures et des prix du catalogue ; elle
ignore ce que les modèles dépenseront à réfléchir sur un calcul. Seul `--estimate` fait
foi.

## Limites à afficher sur le site

- 50 questions : deux modèles séparés par quelques points ne sont pas départageables.
- Sociétés célèbres, jeu public depuis 2023 : un modèle peut connaître certains chiffres par cœur.
- Les pages utiles sont fournies : on mesure « lire et calculer », pas « retrouver dans 140 pages ».
- Rapports américains, en anglais.
- Une seule annotation par question, avec ses erreurs éventuelles.
- Un oui / non a une chance sur deux d'être juste au hasard.
- Trois questions pièges seulement : le compte des hallucinations est indicatif.
- Verdicts et libellés sont notre transcription de la phrase de l'analyste.

## Ce qui change dans le code

- `packages/fixtures` : une préparation FinanceBench (`npm run financebench:prepare`),
  sœur de celle de DeepForm — téléchargement, vérifications, rendu, manifeste, vérité terrain.
- `packages/schema` et `packages/eval` : la question portée par le document et jointe au
  prompt ; le critère non déclaré non noté ; la tolérance relative ; les formes acceptées
  d'un libellé ; l'exactitude par sous-tâche.
- `data/catalogue/benchmarks.json` : la fiche `analyse-financiere` réécrite.
- `apps/web` : le tableau des questions, le protocole du benchmark, la mention de source.
- Textes à corriger au passage : la ligne FinanceBench de la feuille de route (licence,
  32 sociétés et non 40) et la source CFPB de `tri-tickets`, qui ne fournit plus le texte
  des réclamations.

## Hors périmètre

- Les 27 questions à explication rédigée et les 8 d'opinion.
- Donner le rapport entier au modèle, ou le laisser chercher la page.
- Des documents français.
- L'épinglage de l'hébergeur.
