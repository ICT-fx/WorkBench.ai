# Design — AIWorkBench.fr

Décrit le système tel qu'il est construit dans `apps/web`. La source de vérité reste
`apps/web/src/app/globals.css` ; ce fichier dit *pourquoi*.

## L'idée

Le grand livre comptable, passé au vert. Du grand livre : filets fins, colonnes de
chiffres alignées à droite, encre rouge réservée à ce qui cloche. Du vert : des panneaux
aux angles adoucis posés sur un papier teinté, et un vert profond pour tout ce qui
structure — bandeaux de section, sélection, action principale.

La structure des pages est celle de vals.ai (demande du propriétaire). Le style s'en
écarte sur trois points voulus : **moins carré** (rayons de 6 / 10 / 16 px, onglets en
pilules), **une seule famille typographique** (pas de sérif de titrage, pas de
monospace d'apparat), et **des monogrammes colorés** à la place des logos de labos.

Mode : *Operate* / *Read*. On vient ici décider, pas s'émerveiller : la lisibilité d'un
tableau passe avant tout effet.

## Couleur

Stratégie : neutres teintés de vert + un vert profond qui possède des régions entières
(bandeaux), jamais un accent saupoudré.

| Jeton | Rôle |
|---|---|
| `papier` | fond de page |
| `surface` | panneaux, graphiques |
| `creux` | en-têtes de tableau, pistes de barres, fond des onglets |
| `encre` / `encre-pale` / `encre-muette` | texte, du plus au moins important |
| `filet` / `filet-fort` | séparateurs ; le fort pour les bordures de champs et les axes |
| `vert-fonce` | bandeaux, onglet actif, bouton plein |
| `vert` | liens, focus secondaire, séries neutres des barres |
| `vert-vif` | anneau de focus, frontière de Pareto |
| `vert-pale` / `vert-brume` | sélection douce, podium des tableaux / barres d'outils, survol |
| `rouge` / `rouge-pale` | **uniquement** ce qui cloche : hallucinations, quadrant « imprécis et cher » |
| `ambre*` | **uniquement** la marque « Démo » et son bandeau |
| `serie-1…8`, `serie-autre`, `sur-serie-*` | graphiques : la teinte d'un labo et l'encre lisible dessus |

Le mode sombre redéfinit les mêmes jetons (`prefers-color-scheme`). Aucune couleur en
dur dans les composants. Le bloc `@theme` est `static` : les teintes de séries sont
choisies à l'exécution, Tailwind ne les verrait pas autrement.

**Palette des séries.** Huit teintes validées pour les daltoniens (écart ΔE adjacent
≥ 8, contrôlé par script sur les surfaces claire et sombre), dans un ordre fixe. La
couleur suit le labo (`labs.json › slot`), jamais son rang ; les labos sans
emplacement sont gris. L'identité ne repose jamais sur la couleur seule : monogramme
dans le marqueur, légende, et tableau équivalent sous chaque graphique. La page
Comparaison est la seule exception assumée : on y compare des modèles, parfois du même
labo, donc la teinte suit l'ordre de sélection.

## Typographie

Archivo variable (`wdth`), partout.

- `.etendu` — titres : largeur 118 %, graisse 600, interlettrage −0,018 em.
- `.etiquette` — libellés de structure (en-têtes de colonnes, onglets, légendes) : 0,72 rem, capitales, +0,07 em.
- `.chiffres` — chiffres tabulaires, pour les **colonnes** de tableaux. Les grands nombres isolés gardent leurs chiffres proportionnels.
- Échelle en rem fixes : h1 `text-4xl sm:text-5xl`, h2 `text-2xl` (ou `text-3xl` sur l'accueil), h3 `text-lg`/`text-xl`. Prose limitée à 68 ch.
- Pas de surtitre au-dessus d'un titre. Plus d'espace au-dessus d'un titre qu'en dessous ; sections séparées de `mt-16` à `mt-24`.

## Composants (classes de `globals.css`)

`.conteneur` colonne centrée 78 rem · `.panneau` surface bordée, rayon 16 px · `.bandeau`
bande vert foncé qui coiffe une section · `.barre` barre d'outils d'un panneau · `.segment`
onglets en pilule (actif : `aria-pressed` / `aria-selected` / `aria-current`) · `.bouton`,
`.bouton-plein` · `.pastille`, `.pastille-demo` · `.champ` · `.trame` fond pointé des
graphiques · `.tableau` (+ `.droite`, podium par `tr[data-rang]`) · `.prose-hub` · `.infobulle`.

Primitives React : `Icon` (jeu maison, trait 1,5 px sur grille de 20), `LabMark`
(teinte + monogramme du labo), `DemoTag`, `ScoreBar`.

Une grille de benchmarks est faite de **cellules séparées par des filets** dans un seul
panneau, jamais de cartes posées dans une carte.

## Graphiques

SVG à la main, en pixels réels (`useMeasure`), pour que le texte garde sa taille.

- Traits fins : lignes 2 px, marqueurs r ≥ 4 avec anneau de 2 px couleur surface, grille en filets pleins. Le tireté est réservé aux repères (« meilleure exactitude », « coût le plus bas »).
- Le texte ne porte jamais la couleur de la série.
- Un seul axe Y. Les coûts passent en échelle logarithmique dès qu'ils couvrent un ordre de grandeur.
- Étiquettes directes avec parcimonie (frontière de Pareto : quatre au plus, deux sur téléphone, placées sans chevauchement) ; le reste vit dans l'infobulle, disponible au survol **et** au focus clavier, cible ≥ 24 px.
- `BarresIndice` : l'ordre des colonnes reste celui de l'indice quelle que soit la mesure ; sous 768 px, des lignes remplacent les colonnes.
- `NuageCout` : deux quadrants seulement sont teintés — « précis et bon marché », « imprécis et cher ».
- `CourbesTemps` : des marches, pas des pentes — entre deux sorties, le meilleur modèle disponible ne change pas.

## Mouvement

Transitions d'état de 150–250 ms, `--ease-sortie`. Un seul moment dessiné : la pousse des
colonnes de l'indice, sans délai d'attente (un élément n'est jamais invisible par
défaut). Tout se coupe sous `prefers-reduced-motion`.

## Intégrité visuelle

Tant qu'un classement est une démonstration : bandeau ambre en tête de chaque page **et**
pastille « Démo » dans la barre de chaque tableau et de chaque graphique. Une capture
d'écran recadrée la porte encore.
