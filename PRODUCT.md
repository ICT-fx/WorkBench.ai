# Product

<!-- impeccable:product-schema 1 -->

> Rédigé sans entretien, à partir du README, du code et de la demande de refonte du 20 septembre 2026.
> Les lignes marquées *(déduit)* sont des déductions à confirmer, pas des faits validés.

## Platform

web

## Users

- Dirigeants et responsables de fonction de PME françaises (finance, comptabilité, RH, juridique, service client…) qui doivent choisir un modèle d'IA pour une tâche précise, sans être spécialistes. *(déduit du README : « une PME qui doit choisir un outil »)*
- Leur question n'est pas « quel est le meilleur modèle » mais « lequel pour mon service, à quel prix, et avec quel risque qu'il invente ».
- Public secondaire : intégrateurs et équipes data qui veulent rejouer une évaluation. *(déduit)*

## Product Purpose

Classer les principaux modèles d'IA sur des tâches d'entreprise concrètes, métier par métier, et publier tout ce qui permet de recalculer chaque chiffre : prompt, documents, réponses brutes, barème, code de notation. Le succès : un visiteur repart avec un modèle recommandé pour son cas, et la raison.

## Positioning

Les classements publics mesurent des examens académiques ; le hub mesure le travail réel d'une entreprise (lire une facture française, résumer un contrat, répondre en SAV). Quatre mesures — exactitude, cas traités sans relecture, hallucinations, coût et temps — ne sont jamais fondues en une note unique. Un champ absent du document fait partie du test : inventer une valeur est compté à part, parce qu'un chiffre inventé passe la relecture.

## Operating Context

- Pipeline en quatre commandes séparées (`eval:run`, `eval:score`, `eval:review`, `eval:publish`) ; un run est un dossier horodaté et immuable.
- Le site est statique : il lit `data/` au build et ne fait aucun appel à un modèle.
- Catalogue des modèles : sélection éditoriale (`data/catalogue/models.seed.json`), prix et fenêtres de contexte synchronisés depuis le catalogue public d'OpenRouter, la passerelle par laquelle les appels sont facturés (`npm run catalogue:sync`).
- Structure du site calquée sur vals.ai à la demande du propriétaire : Accueil, Benchmarks (par métier), Modèles, Comparaison, Actualités, À propos.

## Capabilities and Constraints

- Dix métiers de l'entreprise, vingt-deux benchmarks. Un seul est mesuré aujourd'hui (lecture de factures publicitaires, sur de vraies factures publiques annotées) ; les vingt-et-un autres ont un protocole rédigé et un jeu de test à construire (`maturity`), et portent leur place dans la feuille de route et ce qui leur manque (`roadmap`).
- Un indice métier : moyenne des exactitudes par métier, chaque métier à poids égal ; il ne porte que sur les métiers mesurés, et le site affiche lesquels et combien. Un modèle absent d'un métier mesuré n'est pas classé.
- Historique des publications par benchmark (`data/published/history/`) pour suivre l'évolution dans le temps.
- Français par défaut, anglais en bascule (`/fr`, `/en`).
- **Intégrité** : le dépôt ne contient plus aucune donnée fabriquée — ni documents de synthèse, ni scores de démonstration, ni les générateurs qui les produisaient. Un classement porte `status: "reel" | "demo"` et le marquage « Démo » reste câblé dans le site comme garde-fou : un classement fabriqué ne pourrait pas être publié sans se signaler.
- Indécis : le calendrier des runs réels, et l'ordre dans lequel les benchmarks en préparation seront construits.

## Brand Commitments

- Nom : « Hub d'évaluations métier », publié par Flowera.
- Voix : directe, concrète, sans jargon marketing ; des exemples tirés de la vie d'une PME.
- Demande visuelle du propriétaire (contraignante) : très simple comme vals.ai, mais moins carré, dans des tons verts.

## Evidence on Hand

- Réel : le jeu de 19 factures publiques annotées (`data/tasks/facture-fcc`), les 513 notations et les réponses brutes des 27 modèles (`data/runs/2026-09-27_facture-fcc`), le classement publié, le pipeline et ses tests, les métadonnées des 27 modèles (prix, contexte, dates de sortie).
- Absent, à ne pas fabriquer : toute mesure réelle de modèle, toute couverture presse, tout témoignage, toute information sur l'équipe au-delà de « publié par Flowera ».

## Product Principles

1. Tout chiffre mesuré doit pouvoir être recalculé depuis le dépôt.
2. Une démonstration ne doit jamais pouvoir passer pour une mesure, même sur une capture d'écran.
3. Ne rien recommander est une réponse honnête quand aucun modèle n'est recommandable.
4. Deux modèles plus proches que la marge d'erreur ne sont pas départagés, et le site le dit.
5. Le métier d'abord : on entre par la fonction de l'entreprise, pas par le nom du modèle.

## Accessibility & Inclusion

Contraste AA, navigation au clavier, identité des séries jamais portée par la couleur seule (monogramme du labo, légende, tableau équivalent sous chaque graphique), respect de `prefers-reduced-motion`.
