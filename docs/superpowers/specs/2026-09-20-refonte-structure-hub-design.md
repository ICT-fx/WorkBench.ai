# Refonte du site : structure « vals.ai », dix métiers, catalogue de modèles

**Date** : 2026-09-20
**Statut** : construit. Les décisions marquées ⚠️ ont été prises sans validation préalable et restent à confirmer.

## La demande

Reprendre la structure de vals.ai — Benchmarks, Models, Comparison, News, About, et une
page d'accueil du même esprit — pour un hub qui reste dans le monde de l'entreprise :
des catégories par métier (finance, comptabilité, ressources humaines…) plutôt que par
discipline académique. Intégrer les principaux modèles récents (Anthropic, OpenAI,
Google, Meta, xAI, Mistral, DeepSeek, Qwen…), pouvoir suivre leur performance dans le
temps, français avec bascule anglais, style très simple mais moins carré, dans les verts.

## Ce qui a été observé sur vals.ai

- **Accueil** : fil d'actualités, accroche, histogramme de l'indice (meilleur modèle de chaque labo, onglets score / coût / latence), derniers rapports, classement par secteur (onglets de secteur → benchmark → nuage exactitude × coût avec frontière de Pareto), performance dans le temps (frontière par labo, pays, poids).
- **Benchmarks** : sommaire collant des catégories à gauche ; à droite, un bandeau par catégorie et une grille de cartes (statut, titre, date, nombre de modèles, description, trois meilleurs, « view details »).
- **Détail d'un benchmark** : en-tête, nuage exactitude × coût, « key takeaways », tableau triable, contexte, résultats par catégorie, méthodologie.
- **Models** : liste filtrable à gauche, fiche à droite (specs, trois tuiles avec réglette de distribution, scores par benchmark avec rang, mises à jour).
- **Comparison** : sélecteurs de modèles (5 max) et de benchmarks, grille avec meilleure cellule surlignée, histogramme, radar par secteur, analyse des coûts ; état dans l'URL.
- **News / About** : onglets, articles à la une, liste ; prose institutionnelle et méthodologie.

## Décisions

### Données

1. **Catalogue** (`data/catalogue/`) : `labs.json`, `models.seed.json` → `models.json`, `domains.json`, `benchmarks.json`, validés par `packages/schema/src/catalogue.ts`. La sélection des modèles est éditoriale ; prix, fenêtre de contexte, sortie maximale et modalités viennent du catalogue public de l'AI Gateway (`npm run catalogue:sync`, sans clé). Un champ inconnu reste `null` → « non communiqué ». Dates de sortie et statut des poids relevés sur les fiches publiques de vals.ai le 2026-09-20.
2. **52 modèles, 15 labos**, sur douze mois de sorties — de quoi tracer une frontière par labo sans remonter au-delà.
3. **Dix métiers, 21 benchmarks.** Un seul est exécutable (`facture-fr`, `maturity: "pipeline"`) ; les vingt autres ont un protocole rédigé (`"maquette"`). ⚠️ La liste des métiers et des benchmarks est une proposition.
4. ⚠️ **Scores de démonstration sur des modèles réels.** Le dépôt interdisait jusqu'ici d'associer un score fabriqué à un vrai nom de modèle. La demande exige de vrais modèles ; aucune mesure n'existe. Compromis retenu : `status: "demo"` partout, scores déduits de deux faits publics (prix, date de sortie) plus un aléa déterministe — aucune opinion sur un labo —, bandeau ambre sur chaque page **et** pastille « Démo » dans chaque tableau et graphique. La marque tombe benchmark par benchmark à la première publication réelle.
5. **Évolution dans le temps** : `data/published/history/<benchmark>.json` archive chaque publication. `eval:publish` l'alimente ; une première mesure réelle purge les runs de démonstration. Le site en tire la frontière par date de sortie (accueil), l'état de l'art par run (benchmark) et la stabilité d'un modèle d'un run à l'autre (fiche modèle).
6. **Indice métier** : moyenne des exactitudes par métier, à poids égal par métier ; absent tant qu'un métier manque. Il ne moyenne que l'exactitude : les quatre mesures du hub restent séparées.

### Site

7. **Routage** `app/[lang]/…`, `fr` par défaut (`/` → `/fr`), anciennes adresses redirigées. Dictionnaires typés par espace de noms, deux langues côte à côte : une clé manquante est une erreur de compilation.
8. **Tout statique** : `getHub()` lit et calcule au build ; les composants client reçoivent des objets minimaux.
9. **Graphiques en SVG maison**, sans dépendance : histogramme, nuage avec frontière de Pareto, marches temporelles, radar, réglettes.
10. **Monogrammes colorés à la place des logos** des labos : pas de marque tierce embarquée, et l'identité ne dépend pas de la couleur seule.
11. **Coûts en dollars** : les tarifs publics le sont ; les convertir daterait le chiffre. (L'ancien site formatait ces dollars en euros.)
12. **Actualités** : articles de méthode rédigés à la main (`data/news.json`, aucun fait inventé) et comptes rendus de sortie de modèle générés depuis les classements.

### Design

Voir `DESIGN.md` : le grand livre comptable passé au vert ; panneaux arrondis, bandeaux vert profond, Archivo seule.

## Hors périmètre

Mesures réelles (clé AI Gateway et budget requis), construction des vingt jeux de test,
formulaire de contact, export PNG des comparaisons, plan de site et balises `hreflang`.
