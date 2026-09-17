# Hub d'évaluations métier

Le classement des modèles d'IA sur des tâches d'entreprise concrètes, à commencer
par la lecture d'une facture française.

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

### Les trois verdicts

Un champ absent du document fait partie du test. Une facture en franchise de TVA
n'a pas de taux de TVA : répondre « rien » est la bonne réponse, produire une
valeur est une **hallucination**, comptée à part. Un chiffre inventé coûte plus
cher qu'un chiffre manquant, parce qu'il passe la relecture.

## Rejouer une évaluation

```bash
npm install
export AI_GATEWAY_API_KEY=...          # clé Vercel AI Gateway

npm run eval:run     -- --run 2026-10-08_facture-fr    # appelle les modèles
npm run eval:score   -- --run 2026-10-08_facture-fr    # applique le barème
npm run eval:review  -- --run 2026-10-08_facture-fr    # arbitrage humain
npm run eval:publish -- --run 2026-10-08_facture-fr    # fige le classement
```

Les quatre étapes sont séparées à dessein. Changer le barème et relancer `score`
ne coûte aucun appel d'API : les réponses brutes sont conservées, ce qui rend les
comparaisons dans le temps honnêtes.

Un run est un dossier horodaté et **immuable**. Ajouter un modèle crée un nouveau
run ; les précédents restent consultables. Une interruption se reprend avec
`--resume`, qui ne repaie jamais un appel déjà obtenu.

## Structure

```
data/
  tasks/facture-fr/     définition, barème, prompt, documents, vérités terrain
  runs/<date>_<tâche>/  réponses brutes, scores, arbitrages — jamais réécrits
  published/            les classements que le site affiche
packages/schema/        types et validation partagés
packages/fixtures/      génération du jeu de test
packages/eval/          les quatre commandes du pipeline
apps/web/               le site
```

## Le jeu de test

Vingt-cinq factures **fabriquées**, pas des factures clients anonymisées : ce dépôt
est public, et maquiller de vrais documents laisse des traces. Les vérités terrain
sont exactes par construction, puisque les montants sont produits avant d'être
imprimés.

Neuf cas pièges y sont placés délibérément — multi-taux de TVA, avoir, remise en
pied, acompte déjà versé, franchise en base, autoliquidation, scan de travers,
devise étrangère, facture sur deux pages. Sans eux, tous les modèles finiraient
au-dessus de 95 % et le classement ne dirait rien.

```bash
npm run fixtures:generate    # régénère le jeu à l'identique (générateur déterministe)
```

## Ajouter un modèle

Ajoutez son identifiant à `V1_MODELS` dans `packages/eval/src/models.ts`, puis
lancez un nouveau run. Les identifiants sont vérifiés contre le catalogue de l'AI
Gateway avant le premier appel : un modèle absent ou incapable de lire une image
arrête le run au lieu de produire un classement amputé.

## Ajouter une tâche

Créez `data/tasks/<id>/` avec `task.json` (les critères et leurs poids), `prompt.md`,
`documents/` et `ground-truth/`. Le site découvre les tâches publiées tout seul.

## Limites assumées

Un seul prompt par modèle, aucun ajustement fin, aucun OCR spécialisé en amont, des
images plutôt que des PDF avec couche texte, et vingt-cinq documents plutôt que dix
mille. Les scores publiés sont un plancher, pas un plafond.

---

Publié par [Flowera](https://flowera.fr).
