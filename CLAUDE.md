# AIWorkBench.fr — consignes de travail

Projet de Fantin (Flowera) : un site qui classe les modèles d'IA sur des tâches
métier concrètes, à partir de mesures réelles et vérifiables.

## À lire avant de toucher au benchmark

**[METHODOLOGIE.md](METHODOLOGIE.md)** — le protocole, la façon de vérifier une
réponse, les résultats obtenus, et surtout la liste des erreurs déjà commises. Sa
section 4 est la plus importante : chacune de ces erreurs a coûté du temps ou de
l'argent réel. La section 11 dit comment publier et comment tester un
modèle sorti après coup.

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

**Chaque benchmark explique son propre protocole.** La page Méthodologie est en deux
parties : ce qui vaut pour tout le hub (indice, marge d'erreur, coûts, maturité), puis
une partie par benchmark mesuré — ses limites, son barème, ses verdicts, son prompt,
son dernier run. Un protocole ne se transpose pas d'une tâche à l'autre, et un barème
lu hors de son benchmark passe pour une règle générale. Toute nouvelle tâche mesurée
ajoute donc sa section avant d'être publiée ; aucune ne se contente de celle d'une
autre.

**Les données partent telles quelles.** Tout ce que le pipeline écrit dans `data/` — réponses
brutes, notes, classements, tests figés, catalogue — est versionné et poussé sans retouche : le
site en ligne lit les mêmes fichiers que nous. On ne corrige jamais un chiffre dans un fichier
publié, on corrige ce qui l'a produit et on republie. Seule exception, les pages rendues des
factures (206 Mo), que `npm run deepform:prepare` régénère et dont le test figé garde l'empreinte.

**Une publication, une actualité.** Mettre un classement en ligne — un nouveau benchmark, un
modèle ajouté, une règle de notation changée — s'accompagne d'un article dans `data/news.json`,
daté du jour de la mesure, qui dit ce qui a été mesuré, ce que ça donne et ce que ça ne dit pas.
Sans lui, l'accueil continue d'annoncer la publication d'avant.

**Un nouveau modèle passe le test publié, pas un test voisin.** `eval publish` fige le test de
chaque benchmark dans `data/published/protocoles/` : documents avec leur empreinte, prompt,
barème, paramètres d'appel, version datée et dates d'appel de chaque modèle. Pour ajouter un
modèle sorti après coup, lancer `eval run --test-publie`, qui s'arrête avant le premier appel si
quoi que ce soit a changé, puis `eval publish --ajouter <run>`. La marche à suivre est dans
METHODOLOGIE.md, section 11.

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
