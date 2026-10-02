# Hub d'évaluations métier — consignes de travail

Projet de Fantin (Flowera) : un site qui classe les modèles d'IA sur des tâches
métier concrètes, à partir de mesures réelles et vérifiables.

## À lire avant de toucher au benchmark

**[METHODOLOGIE.md](METHODOLOGIE.md)** — le protocole, la façon de vérifier une
réponse, les résultats obtenus, et surtout la liste des erreurs déjà commises. Sa
section 4 est la plus importante : chacune de ces erreurs a coûté du temps ou de
l'argent réel.

Autres repères : `docs/2026-09-24-modeles-benchmarks-roadmap.md` (les 27 modèles et la
feuille de route), `docs/superpowers/specs/` (les specs de conception).

## Règles non négociables

**L'argent.** Chaque appel de modèle est payant, sur le compte personnel de Fantin,
dont le budget est serré. Chiffrer avec `npm run eval:run -- --estimate` avant tout
run, annoncer le montant, et attendre son accord. Réannoncer si le chiffre change.
Ne jamais lancer un run « pour voir ».

**Le périmètre.** Un run porte sur un ensemble de documents décidé ensemble. Vérifier
le nombre de documents annoncé par la commande avant qu'elle ne dépense quoi que ce
soit. Un oubli de filtre a déjà fait entrer treize documents hors périmètre.

**L'intégrité des mesures.** Aucune IA n'évalue une autre IA. La vérité terrain vient
d'humains. Une valeur qu'on ne sait pas lire arrête la préparation, elle ne devient
jamais un `null` silencieux — ce `null` signifierait « absent du document » et
accuserait d'hallucination un modèle qui a correctement lu.

**Aucune donnée fabriquée dans le dépôt.** Depuis le 2 octobre 2026, il n'y a plus un
seul document de synthèse ni un seul score de démonstration, et les générateurs qui les
produisaient ont été supprimés. Une tâche est mesurée et porte ses chiffres, ou elle est
déclarée à venir et n'en porte aucun — il n'y a pas de troisième état. Ne pas remplir
une page vide avec des chiffres plausibles : une page qui dit « pas encore mesuré » vaut
mieux. Le marquage `status: "demo"` et son bandeau restent câblés comme garde-fou, pour
qu'un classement fabriqué ne puisse pas être publié sans se signaler.

**Un chiffre affiché est un chiffre mesuré.** Cela vaut aussi pour les textes : une page
qui décrit une étape du protocole doit décrire ce qui a réellement été fait. L'étape
d'arbitrage humain n'a jamais été exécutée, et le site le dit.

**Avant de publier un classement.** Regarder la répartition des erreurs par champ, et
comparer le classement obtenu sur tous les champs à celui obtenu sans les champs
ambigus. S'ils divergent, le benchmark mesure la question posée et non la compétence
des modèles : ne pas publier.

## Façon de travailler attendue

Définir avant de construire, et faire valider. Fantin veut décider du quoi avant le
comment, tâche par tâche, secteur par secteur. Il préfère une question claire à une
initiative prise à sa place.

Dire ce qui ne va pas, y compris ses propres erreurs, avec le chiffre et la cause.
Les limites d'un résultat s'affichent, elles ne se masquent pas : c'est ce qui fait la
valeur de ce hub face aux classements existants.

## Technique

Monorepo npm, TypeScript strict, Vitest, ESM. `data/` est la source de vérité, tout le
reste n'en est qu'une lecture. Les appels passent par OpenRouter, clé dans `.env.local`.
Les runs sont immuables et se reprennent avec `--resume`.
