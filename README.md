# Hub d'évaluations métier

Le classement des modèles d'IA sur des tâches d'entreprise concrètes, métier par
métier — finance, comptabilité, ressources humaines, juridique, service client… — à
commencer par la lecture d'une facture française.

Les benchmarks publics mesurent des examens académiques. Une PME qui doit choisir
un outil veut savoir autre chose : combien de ses factures passeront sans
correction, combien coûtera chacune, et à quelle fréquence le modèle inventera un
chiffre qui n'est pas sur le document.

**Tout est vérifiable ici.** Le prompt envoyé, les documents soumis, les réponses
brutes de chaque modèle, le barème et le code qui note. Chaque chiffre publié peut
être recalculé à partir de ce dépôt.

## Ce que le hub mesure

| Mesure | Ce qu'elle dit |
|---|---|
| **Factures sans relecture** | Part des factures dont aucun champ critique n'est faux |
| **Exactitude** | Points obtenus sur l'ensemble des champs, pondérés par leur criticité |
| **Hallucinations** | Champs inventés là où le document ne contient rien |
| **Coût et temps** | Par facture, aux tarifs publics du jour du test |

Les quatre ne sont jamais fondues en une note unique. Un modèle peut être premier
en exactitude et inutilisable parce qu'il invente.

L'**indice métier** du site n'y déroge pas : il ne moyenne que l'exactitude, métier
par métier, chaque métier pesant autant que les autres. Il ne porte que sur les
métiers déjà mesurés — le site dit lesquels et combien — et ne dit rien du coût ni
des hallucinations.

## Ce qui est réel aujourd'hui, et ce qui ne l'est pas

| | Statut |
|---|---|
| Les 27 modèles, leurs labos, dates de sortie, prix et fenêtres de contexte | **Réels**, synchronisés depuis le catalogue public d'OpenRouter |
| La tâche « lecture de factures publicitaires » : documents, annotations, barème, pipeline | **Réels** et rejouables |
| Le classement publié : 27 modèles × 95 factures  2 565 notations | **Mesuré** — chaque chiffre vient d'un appel réellement passé |
| Les vingt-et-un autres benchmarks | Protocole rédigé, jeu de test **à construire**, aucun chiffre affiché |

**Le dépôt ne contient plus aucune donnée fabriquée.** Une tâche est mesurée et porte
ses chiffres, ou elle est au programme et n'en porte aucun ; il n'y a pas de troisième
état. Le générateur de factures de synthèse et celui de scores de démonstration, qui
avaient servi à construire le site, ont été retirés : leur seule fonction était de
produire des chiffres qui n'en étaient pas.

Le marquage `status: "demo"` reste dans le schéma et dans le site — bandeau, pastille
sur chaque tableau et chaque graphique — comme garde-fou : si un classement fabriqué
était publié un jour, il ne pourrait pas l'être silencieusement.

### Les trois verdicts

Un champ absent du document fait partie du test. Les factures américaines du jeu
ne portent pas de numéro de TVA : répondre « rien » est la bonne réponse, produire
une valeur est une **hallucination**, comptée à part. Un chiffre inventé coûte plus
cher qu'un chiffre manquant, parce qu'il passe la relecture.

Sur le classement publié : **vingt-quatre modèles sur vingt-sept n'inventent jamais**. Trois ont fabriqué un numéro de TVA sur une facture qui n'en porte aucun — un cas chacun sur 95.

## Rejouer une évaluation

```bash
npm install
npm run eval:run -- --estimate         # coût prévu, sans aucun appel ni clé
# clé OpenRouter dans .env.local : OPENROUTER_API_KEY=...

npm run eval:run     -- --run 2026-09-27_facture-fcc    # appelle les modèles
npm run eval:score   -- --run 2026-09-27_facture-fcc    # applique le barème
npm run eval:review  -- --run 2026-09-27_facture-fcc    # arbitrage humain
npm run eval:publish -- --run 2026-09-27_facture-fcc    # fige le classement
```

Les quatre étapes sont séparées à dessein. Changer le barème et relancer `score`
ne coûte aucun appel d'API : les réponses brutes sont conservées, ce qui rend les
comparaisons dans le temps honnêtes.

Un run est un dossier horodaté et **immuable**. Ajouter un modèle crée un nouveau
run ; les précédents restent consultables. Une interruption se reprend avec
`--resume`, qui ne repaie jamais un appel déjà obtenu.

## Déployer le site

Sur Vercel, avec **Root Directory** réglé sur `apps/web` et l'option d'inclusion des
fichiers hors du dossier racine laissée active (c'est le réglage par défaut) : le
build copie les images de test depuis `data/`, qui se trouve au-dessus. Next.js est
détecté automatiquement, aucune variable d'environnement n'est nécessaire — le site
ne fait aucun appel à un modèle.

## Structure

```
data/
  catalogue/            labos, modèles, métiers, benchmarks — ce que le site sait du marché
  tasks/facture-fcc/    définition, barème, prompt, documents, annotations
  runs/<date>_<tâche>/  réponses brutes, scores, arbitrages — jamais réécrits
  published/            le dernier classement de chaque benchmark
  published/history/    toutes les publications passées : l'évolution dans le temps
  news.json             les actualités rédigées à la main
packages/schema/        types et validation partagés
packages/fixtures/      préparation du jeu de test réel depuis les archives publiques
packages/eval/          le pipeline, et la synchronisation du catalogue
apps/web/               le site (français et anglais)
```

Le site reprend la structure de vals.ai : accueil, benchmarks par métier, fiches
modèles, comparaison, actualités, à propos. Tout est statique : les pages sont
calculées au build à partir de `data/`.

## Le jeu de test

Quatre-vingt-quinze factures **réelles**, pas des factures fabriquées. Ce sont des
factures d'achat d'espace publicitaire télévisé que les chaînes américaines doivent déposer
auprès de la Federal Communications Commission, et que la loi rend publiques. Des
journalistes les ont saisies champ par champ pour suivre les dépenses de campagne :
c'est cette saisie, faite par des humains et sans rapport avec ce test, qui sert
d'annotation de référence.

```bash
npm run deepform:prepare    # télécharge, tire l'échantillon et rend les pages en images
```

Le tirage est déterministe : relancé, il produit le même échantillon.

Le barème ne note que ce qui n'admet qu'une seule bonne réponse : le montant total
facturé, et le numéro de TVA absent de ces documents. Les autres champs — numéro de
contrat, annonceur, période — ont été retirés de la question elle-même : ces factures
portent six identifiants distincts et deux périodes également défendables, si bien
qu'on y mesurait la devinette et non la lecture.

**Ce que ce jeu ne couvre pas** : les lignes de facturation, qui sont la vraie
difficulté du métier. L'annotation d'origine ne les contient pas. C'est la prochaine
étape, et elle demandera de construire notre propre référence.

## Ajouter un modèle

Pour qu'il apparaisse sur le site, ajoutez-le à `data/catalogue/models.seed.json`
(identifiant OpenRouter, nom, labo, date de sortie, statut des poids), puis :

```bash
npm run catalogue:sync    # prix, contexte et modalités depuis le catalogue public, sans clé
```

Un modèle absent du catalogue garde des champs vides : le site affiche « non
communiqué » plutôt qu'un chiffre recopié de mémoire. Un modèle dont on ne sait pas
si ses poids sont ouverts porte `null`, et non une supposition.

Pour le mesurer, ajoutez son identifiant à `HUB_MODELS` dans
`packages/eval/src/models.ts`, puis lancez un nouveau run. Les identifiants sont
vérifiés contre le catalogue d'OpenRouter avant le premier appel : un modèle absent
ou incapable de lire une image arrête le run au lieu de produire un classement amputé.

Un modèle ajouté après coup n'apparaît pas dans un classement déjà publié : il
faudrait rejouer le run entier pour que tous les modèles aient été testés à
l'identique, ce qui est la seule façon de les comparer.

## Ajouter une tâche

Déclarez le benchmark dans `data/catalogue/benchmarks.json` (métier, question,
sous-tâches, `maturity: "maquette"`), puis créez `data/tasks/<id>/` avec `task.json`
(les critères et leurs poids), `prompt.md`, `documents/` et `ground-truth/`. Quand la
tâche est jouable de bout en bout, passez-la en `maturity: "pipeline"`.

## Limites assumées

Un seul prompt par modèle, aucun ajustement fin, aucun OCR spécialisé en amont, des
images plutôt que des PDF avec couche texte, et vingt-cinq documents plutôt que dix
mille. Les scores publiés sont un plancher, pas un plafond.

---

Publié par [Flowera](https://flowera.fr).
