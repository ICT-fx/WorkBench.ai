# Hub d'évaluations métier — design

**Date** : 2026-09-17
**Tâche Notion** : TSK-1 « Hub d'évaluations métier — créer le site »
**Contenu lié** : FLW-1 « Le meilleur modèle d'IA n'est pas forcément le bon pour votre cas »

## 1. Objectif

Un site qui classe les modèles d'IA sur des tâches concrètes d'entreprise — lire une
facture française, répondre à un client en SAV, résumer un contrat — là où les
benchmarks publics mesurent des examens académiques.

Le public visé : dirigeants, DAF et responsables d'exploitation de PME qui doivent
choisir un outil d'IA et n'ont aucun moyen de savoir lequel marche sur *leurs*
documents.

La promesse du hub n'est pas « voici le meilleur modèle », c'est **« voici les
résultats, le protocole et les données brutes — vérifiez vous-même »**. Toutes les
décisions de ce document découlent de cette promesse.

## 2. Décisions de cadrage

| Décision | Choix | Conséquence |
|---|---|---|
| Périmètre | Vitrine de résultats figés | Aucun appel de modèle depuis le site, zéro coût récurrent |
| Notation | Hybride : automatique + revue humaine | Vérité terrain là où c'est objectif, juge + arbitrage humain ailleurs |
| Périmètre V1 | 1 tâche (facture française) en profondeur | En ligne en semaines, chaque tâche suivante = un épisode de contenu |
| Stack | TypeScript, un seul dépôt | Next.js + AI SDK/AI Gateway, résultats en JSON versionnés |
| Architecture | Résultats JSON dans git, site statique | L'historique git *est* l'historique des benchmarks |
| Dépôt | Public dès la V1 | Documents de test **fabriqués**, jamais des factures clients maquillées |

## 3. Architecture

### 3.1 Structure du dépôt

```
hub-evals/
  data/                          # source de vérité ; tout le reste n'en est qu'une lecture
    tasks/
      facture-fr/
        task.json                # définition, critères, poids, profils de reco
        prompt.md                # le prompt exact envoyé aux modèles
        documents/               # les 25 factures fabriquées (PDF/PNG)
        ground-truth/            # 1 JSON par document
    runs/
      2026-10-08_facture-fr/
        run.json                 # date, modèles + versions exactes, paramètres
        raw/<modele>/<doc>.json  # réponse brute, tokens, latence, coût
        scores.json              # note par document et par critère
        review.json              # arbitrages humains et désaccords
    published/
      facture-fr.json            # l'agrégat lu par le site
  packages/eval/                 # les 4 commandes du pipeline
  packages/schema/               # types + schémas Zod partagés site/pipeline
  apps/web/                      # site Next.js
  docs/superpowers/specs/        # ce document
```

### 3.2 Le pipeline

| Commande | Rôle | Écrit |
|---|---|---|
| `eval run` | Envoie chaque document à chaque modèle via l'AI Gateway, sans rien interpréter | `runs/<date>/raw/` |
| `eval score` | Compare aux vérités terrain, applique le barème | `runs/<date>/scores.json` |
| `eval review` | Présente en terminal l'échantillon à arbitrer et les cas où le scoring a hésité | `runs/<date>/review.json` |
| `eval publish` | Agrège en classement et fige la publication | `published/<tache>.json` |

Trois propriétés recherchées :

1. **Étapes rejouables indépendamment.** Changer le barème relance `score` sur les
   réponses brutes déjà collectées : aucun appel API repayé, aucun risque que les
   modèles aient changé entre-temps.
2. **Rien n'est jamais écrasé.** Un run est un dossier horodaté, immuable. Ajouter un
   modèle crée un nouveau run ; les précédents restent consultables.
3. **Coût et latence capturés à l'exécution**, jamais reconstitués après coup.

## 4. Notation

### 4.1 Les trois verdicts

Un champ absent du document fait partie du test. Une facture en franchise de TVA n'a
pas de taux de TVA ; un modèle qui en invente un est plus dangereux qu'un modèle qui
répond « absent ». D'où trois verdicts et non deux :

- `correct`
- `faux` / `manquant`
- `hallucine` — le modèle a produit une valeur là où le document n'en contient aucune

### 4.2 Les métriques publiées

Quatre métriques, jamais fusionnées en une note unique.

| Métrique | Définition | Rôle |
|---|---|---|
| **Factures sans relecture** | % de documents où aucun champ critique n'est faux | Le chiffre qu'un DAF comprend immédiatement : « sur 100 factures, 87 passent sans intervention » |
| **Exactitude pondérée** | Somme des points par champ × criticité / total possible | Ordonne le classement |
| **Hallucinations** | Champs inventés / champs attendus nuls | Drapeau rouge, disqualifiant même en tête de classement |
| **Coût & latence** | € par document, latence médiane | Décide de l'industrialisation |

### 4.3 Trois recommandations, pas un vainqueur

Le site met en avant trois profils : **précision maximale**, **meilleur rapport
coût/précision**, **le moins risqué** (hallucinations les plus basses). C'est la thèse
éditoriale du projet rendue visible dans l'interface.

### 4.4 Barème de la facture française

Pesé par criticité métier, pas par difficulté technique.

| Champ | Type | Poids | Critique |
|---|---|---|---|
| Montant TTC, HT, TVA | numérique, tolérance 0 (centime) | 3 | oui |
| SIREN / SIRET émetteur | exact, clé de Luhn vérifiable | 3 | oui |
| Numéro de facture | exact | 2 | oui |
| Date d'émission | date normalisée ISO | 2 | oui |
| N° TVA intracommunautaire | exact | 2 | non |
| Lignes (désignation, qté, PU, taux) | appariement, score F1 | 2 | non |
| Échéance / conditions de règlement | date + texte | 1 | non |
| Mentions spéciales (autoliquidation, art. 293 B) | texte | 1 | non |

### 4.5 Cas pièges obligatoires dans le jeu de test

Sans eux, tous les modèles finissent à 95 % et le classement ne dit rien.

- multi-taux de TVA sur une même facture
- avoir (montants négatifs)
- remise en pied de facture
- acompte déjà déduit
- franchise en base de TVA (art. 293 B du CGI) → pas de TVA
- autoliquidation BTP
- scan de travers ou photo de mauvaise qualité
- devise étrangère
- facture sur deux pages

### 4.6 Part automatique / part humaine

- **Automatique** : tous les champs du barème ci-dessus, comparés à la vérité terrain.
  La facture est intégralement notable sans juge LLM.
- **Humain** : `eval review` présente systématiquement les verdicts `hallucine`, les
  écarts de formatage limites (dates, séparateurs de milliers, casse) et un échantillon
  aléatoire de 10 % des champs `correct` pour vérifier que le scoring ne se trompe pas
  dans l'autre sens. Les arbitrages sont écrits dans `review.json` et priment sur le
  score automatique.
- Le **juge LLM** n'est pas nécessaire pour la facture. Il le deviendra pour le SAV et
  le contrat, qui sont des tâches rédactionnelles. Le modèle de données le prévoit
  (`kind: "text"` + emplacement pour une note de juge), mais aucun juge n'est implémenté
  en V1. YAGNI.

## 5. Modèle de données

```ts
type Value = string | number | boolean | Value[] | { [k: string]: Value };

type Criterion = {
  id: string; label: string;
  kind: "exact" | "number" | "date" | "lines" | "text";
  weight: 1 | 2 | 3; critical: boolean; tolerance?: number;
};

type Task = {
  id: string; label: string; question: string;
  criteria: Criterion[];
};

// null = champ absent du document → piège à hallucination
type GroundTruth = { docId: string; fields: Record<string, Value | null>; notes?: string };

type FieldVerdict = "correct" | "faux" | "manquant" | "hallucine";

type ModelResult = {            // écrit par `eval run`, jamais modifié ensuite
  runId: string; model: string; modelVersion: string; docId: string;
  raw: unknown; latencyMs: number; costUsd: number; error?: string;
};

type DocScore = {
  model: string; docId: string;
  byCriterion: Record<string, { got: Value | null; expected: Value | null;
                                verdict: FieldVerdict; points: number }>;
  needsReview: boolean;
};

type Leaderboard = {            // écrit par `eval publish`, lu par le site
  taskId: string; runDate: string; sampleSize: number;
  rows: { model: string; modelVersion: string;
          sansRelecture: number; exactitude: number;
          hallucinations: number; costPerDoc: number; latencyP50: number }[];
};
```

Deux points d'attention :

- `ModelResult` ne contient **aucune note**. C'est de la donnée brute, rejouable.
- `modelVersion` est capturée à l'exécution, jamais saisie à la main. Dans six mois, un
  même nom commercial ne désignera plus le même modèle — c'est le flou qui décrédibilise
  la plupart des benchmarks.

Tous les fichiers de `data/` sont validés par un schéma Zod (`packages/schema`) au moment
de l'écriture **et** au build du site. Un JSON malformé doit faire échouer le build, pas
produire une page à moitié vide.

## 6. Le site

### 6.1 Pages

- **`/`** — la thèse en deux phrases, puis le chiffre d'accroche (« sur 25 factures
  françaises, le meilleur modèle en traite N sans aucune correction ; le plus connu, M »).
  Liste des tâches : facture publiée, SAV et contrat annoncées avec leur date prévue.
- **`/taches/facture-fr`** — les trois recommandations en encarts ; le classement complet
  et triable (4 métriques en colonnes) ; **les réponses côte à côte sur les cas pièges**
  (le document, la réponse de chaque modèle, la bonne réponse) ; date du test, taille de
  l'échantillon, versions exactes des modèles.
- **`/methodologie`** — le prompt intégral, le barème et ses poids, la composition du jeu
  de test, et une section **« ce que ce test ne mesure pas »** : un seul prompt par
  modèle, pas de fine-tuning, pas d'OCR spécialisé en amont, 25 documents et non 10 000,
  **des factures synthétiques et non des factures réelles anonymisées**, et **des images
  et non des PDF avec couche texte** — un PDF natif est sensiblement plus facile à lire
  pour un modèle, donc les scores publiés sont un plancher, pas un plafond.

La section des limites n'est pas de la modestie : reconnaître les limites avant qu'on
les oppose est ce qui rend le reste crédible.

### 6.2 Technique

Next.js App Router, pages statiques générées au build depuis `data/published/`, déployé
sur Vercel. Pas d'API, pas de base de données, pas de JavaScript client au-delà du tri
des tableaux. Le contenu des pages est du texte dense et tabulaire : la lisibilité du
tableau de classement est le principal enjeu de design.

## 7. Les modèles de la V1

Six modèles, choisis pour couvrir les questions que se posera le public :

- les trois grandes familles propriétaires (OpenAI, Anthropic, Google) ;
- au moins un **modèle français** — la question de la souveraineté viendra avant celle
  du score ;
- un **modèle open-source auto-hébergeable** — « et si je ne veux pas que mes factures
  sortent de chez moi ».

Les identifiants exacts sont figés au moment du run depuis le catalogue de l'AI Gateway,
jamais écrits en dur dans ce document : la version testée doit être celle réellement
appelée.

## 8. Tests

Le paquet de scoring est développé en TDD. C'est de la logique pure — comparaison de
montants à la tolérance près, normalisation de dates, appariement de lignes, distinction
entre `manquant` et `hallucine` — exactement le type de code où une erreur silencieuse
fausserait tout un classement sans jamais lever d'exception.

Couverture attendue :

- chaque `kind` de critère, cas nominal et cas limites (montant négatif, date au format
  US, séparateur de milliers, casse et accents) ;
- `expected === null` + valeur produite → `hallucine` ;
- `expected === null` + rien produit → `correct` ;
- agrégation : un champ critique faux fait basculer `sansRelecture` pour ce document ;
- validation de schéma : un JSON malformé fait échouer le build.

Le site est vérifié par un test de build sur un jeu de données d'exemple, pas par des
tests de rendu unitaires.

## 9. Étapes

| # | Étape | Notion | Nature | Ordre de grandeur |
|---|---|---|---|---|
| 0 | Socle : dépôt, schémas Zod, `task.json` facture, `prompt.md` | TSK-2 | dev | ½ journée |
| 1 | 25 factures fabriquées + vérité terrain, cas pièges compris | TSK-3 | générées par code, revue visuelle | ½ journée |
| 2 | `eval run` + `eval score` | TSK-4 | dev, TDD | 1 journée |
| 3 | `eval review` + `eval publish` | TSK-4 | dev + ~2 h de revue | ¾ journée |
| 4 | Site Next.js et mise en ligne | TSK-5 | dev | 1½ jour |

L'étape 1 est le goulot d'étranglement et relève du travail humain. Elle est indépendante
de l'étape 0 : la collecte peut démarrer pendant que le socle se monte.

## 10. Hors périmètre V1

- Les tâches SAV et contrat (conçues dans le modèle de données, non publiées).
- Le juge LLM.
- Toute interaction du visiteur avec un modèle (dépôt de son propre document).
- Base de données, authentification, back-office de saisie.
- Comparaison de plusieurs prompts pour un même modèle.

## 11. Points ouverts

- Nom de domaine et rattachement à la marque Flowera (sous-domaine ou domaine dédié).
- Date de publication cible, à reporter dans les propriétés Notion de TSK-1 à TSK-5,
  aujourd'hui vides.
- Licence du dépôt public et licence des données de test.
