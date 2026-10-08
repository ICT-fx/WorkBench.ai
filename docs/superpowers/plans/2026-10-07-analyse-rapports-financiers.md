# Analyse de rapports financiers — plan de construction

> **Pour l'exécutant :** suivre ce plan tâche par tâche (superpowers:executing-plans).
> Les étapes sont des cases à cocher.

**But :** rendre la tâche `analyse-financiere` jouable par le pipeline existant, sur 50
questions de FinanceBench, jusqu'au chiffrage — puis, après accord de Fantin, la mesurer
et la publier.

**Architecture :** une question est un « document » du pipeline : une ou deux pages en
image, plus le texte de la question joint au prompt. Le barème porte un critère par
sous-tâche et chaque question n'en déclare qu'un. La préparation FinanceBench est la
sœur de celle de DeepForm : elle télécharge, vérifie, rend les pages et écrit manifeste
et vérité terrain.

**Outils :** TypeScript strict, Vitest, zod, mupdf, sharp. Aucune dépendance nouvelle.

**Spec :** [docs/superpowers/specs/2026-10-07-analyse-rapports-financiers-design.md](../specs/2026-10-07-analyse-rapports-financiers-design.md)

## Contraintes globales

- Aucun appel de modèle avant l'accord de Fantin sur le montant de `--estimate`.
- Le run porte sur 50 documents exactement ; le compteur de la commande doit le dire.
- Aucune IA ne note une autre IA. Un écart trouvé dans une référence est soumis à Fantin.
- Une valeur illisible arrête la préparation ; elle ne devient jamais un `null`.
- La notation des runs de factures déjà publiés ne doit pas bouger d'un octet.
- Tolérance des nombres : 0,5 % de la référence, ou la moitié du dernier chiffre affiché, le plus large des deux.
- Question posée en anglais, mot pour mot. Mention de source : « FinanceBench, Patronus AI, CC BY-NC 4.0 ».
- Pas de commit sans demande de Fantin.

## Points de vigilance

1. Un modèle rend `"1.734"` en chaîne pour un ratio : sur un rapport américain c'est 1,734, pas 1 734. → tâche 2.
2. Un modèle rend `"1.9%"` ou `"$1,616"` malgré la consigne : la valeur est juste, l'écriture ne doit pas la faire tomber. → tâche 2.
3. Un modèle répond `"Corporate & Investment Bank"` quand l'attendu est `"Corporate"` : une comparaison par inclusion le compterait juste. → tâche 2.
4. Une question sans texte dans le manifeste : le run doit refuser de partir plutôt que d'envoyer le prompt sans question. → tâche 4.
5. Un critère non déclaré par la vérité terrain d'une question : ni juste, ni faux, ni halluciné — pas noté. → tâche 3.

---

## Phase 1 — construire, sans rien dépenser

### Tâche 1 : le critère apprend trois réglages

**Fichiers :** `packages/schema/src/criterion.ts`, test `packages/schema/src/schema.test.ts`.

**Produit :** `Criterion` gagne trois champs optionnels.
- `key?: string` — la clé JSON où lire la réponse quand elle diffère de l'identifiant.
- `toleranceRelative?: number` — 0.005 pour 0,5 %.
- `decimalSeparator?: "." | ","` — quand il est fixé, l'autre signe sépare les milliers.

- [x] Test : un critère portant les trois champs est accepté ; `decimalSeparator: ";"` et `toleranceRelative: -1` sont refusés.
- [x] Implémenter, lancer `npx vitest run packages/schema`.

### Tâche 2 : comparer un nombre arrondi, et un libellé parmi plusieurs formes

**Fichiers :** `packages/eval/src/compare.ts`, test `packages/eval/src/compare.test.ts`.

**Produit :** `parseNumber(v, decimalSeparator?)` ; `compareField` inchangé de signature.

Cas de test, avec `fin = { kind: "number", toleranceRelative: 0.005, decimalSeparator: "." }` :

| attendu | produit | verdict |
|---|---|---|
| `"1616.00"` | `1615.9` | correct |
| `"303.00"` | `302.578` | correct |
| `"303.00"` | `302578` | faux |
| `"1.9"` | `1.94` | correct |
| `"1.9"` | `2.0` | faux |
| `"0.66"` | `"0.664"` | correct |
| `"1.73"` | `"1.734"` | correct (point décimal, pas 1 734) |
| `"-0.02"` | `-0.019` | correct |
| `"-0.02"` | `0.02` | faux |
| `"1.9"` | `"1.9%"` | correct |
| `"1616.00"` | `"$1,616"` | correct |
| `"0"` | `0` | correct |
| `"0"` | `411` | faux |

Et pour `kind: "exact"` avec un attendu en liste :

| attendu | produit | verdict |
|---|---|---|
| `["Corporate", "Corporate segment"]` | `"corporate"` | correct |
| `["Corporate", "Corporate segment"]` | `"Corporate & Investment Bank"` | faux |
| `["operations", "operating activities"]` | `"Operating activities"` | correct |
| `"yes"` | `"Yes"` | correct |
| `"no"` | `"no"` | correct (« no » n'est pas une abstention) |
| `null` | `"None"` | correct |
| `null` | `"Class A notes"` | hallucine |

- [x] Écrire ces tests, constater l'échec.
- [x] Implémenter : la demi-unité se lit sur l'écriture de la référence (`"1.9"` → 0,05) ; le signe `%` final est retiré ; `exact` accepte une liste.
- [x] Vérifier que les tests existants des factures passent sans modification.

### Tâche 3 : ne noter que ce qui est posé

**Fichiers :** `packages/eval/src/score.ts`, `packages/eval/src/openrouter.ts`, tests `score.test.ts`.

**Produit :** `scoreDocument` saute un critère absent de `groundTruth.fields`, et lit la réponse dans `parsed[criterion.key ?? criterion.id]`. Le filtre de clés d'OpenRouter garde `key ?? id`.

- [x] Test : barème à deux critères `a` et `b` de clé commune `answer`, vérité terrain ne déclarant que `a` → `byCriterion` ne contient que `a`, lu dans `answer`.
- [x] Test : un champ déclaré `null` reste noté (absent du document), comme aujourd'hui.
- [x] Implémenter.
- [x] Non-régression : renoter les quatre runs de factures dans un dossier temporaire et comparer aux `scores.json` versionnés — identiques.

### Tâche 4 : la question voyage avec le document

**Fichiers :** `packages/eval/src/load.ts`, `run.ts`, `estimate.ts`, `cli.ts` ; tests `load.test.ts` (nouveau), `run.test.ts`, `estimate.test.ts`.

**Produit :**
- `composerPrompt(gabarit: string, question: string, forme: string): string` — remplace `{{question}}`, garde le bloc `<!-- forme: X -->` de la forme demandée, retire les autres ; lève une erreur si la forme n'a pas de bloc.
- `loadQuestions(taskId): Promise<Map<string, { question: string; forme: string }>>` — lit `manifest.csv` (colonnes `file_id`, `question`, `forme`) ; vide si le manifeste n'a pas de colonne `question`.
- `LoadedDocument.promptText?: string` ; `runTask` envoie `doc.promptText ?? opts.promptText`.
- `estimateRunCost` accepte `{ images, promptChars? }` par document.

- [x] Tests de `composerPrompt` : la question est insérée, un seul bloc de forme subsiste, forme inconnue → erreur.
- [x] Test de `runTask` : deux documents portant chacun leur prompt → `generate` les reçoit ; `prompt.md` du run garde le gabarit.
- [x] Implémenter ; dans `cmdRun`, si la tâche a des questions, tout document sans question fait échouer la commande avant le moindre appel.

### Tâche 5 : le périmètre, versionné et vérifiable

**Fichiers :** `data/tasks/analyse-financiere/{task.json,prompt.md,tri.csv}`, `packages/fixtures/src/financebench.ts` (fonction de tirage), tests `packages/fixtures/src/financebench.test.ts` et `packages/schema/src/analyse-financiere.test.ts`.

**Produit :**
- `tri.csv` : les 150 questions, avec `financebench_id, statut, motif, categorie, sous_tache, forme, attendu, societe, rapport`. C'est lui qui fixe le périmètre.
- `tirageParForme(eligibles, quotas, max = 2)` : ordre par SHA-256 de `workbench-finance-v1:` + identifiant, quota par catégorie, deux questions par société au plus.
- `task.json` : quatre critères `releve`, `calcul` (nombre, tolérance relative 0,005, point décimal), `verdict`, `libelle` (exact), tous de clé `answer`, poids 1, critiques.
- `prompt.md` : le gabarit de la spec, avec ses trois blocs de forme.

- [x] Test : `tirageParForme` appliqué aux 91 éligibles de `tri.csv` redonne exactement les 50 lignes « retenue ».
- [x] Test de données : barème à quatre critères ; le prompt porte `{{question}}` et les trois formes.

### Tâche 6 : la préparation FinanceBench

**Fichiers :** `packages/fixtures/src/financebench.ts`, `package.json` (script `financebench:prepare`), `.gitignore` (cache).

Pour chaque question retenue, dans l'ordre, et en s'arrêtant à la première anomalie :
1. télécharger les deux fichiers de données et le rapport dans `.cache/financebench/` ;
2. vérifier que le texte de la page du PDF recoupe celui du jeu (80 % des nombres) ;
3. nombres : l'unité est imprimée sur la page ; libellés : une forme acceptée y figure ;
4. écrire la vérité terrain — nombre gardé tel qu'affiché, sans `$` ni `%`, et relu par `parseNumber` ;
5. rendre la ou les pages en JPEG niveaux de gris, plafonnées à 2 millions de pixels ;
6. écrire la ligne du manifeste : `file_id, financebench_id, sous_tache, forme, societe, rapport, pages, question, attendu, formule, url`.

- [x] Lancer, vérifier : 50 vérités terrain, 60 images, chacune déclarant un seul critère.
- [x] Mesurer le poids des images ; regarder quatre pages à l'œil, dont une dense.
- [x] Test de données : 50 lignes, répartition 8 / 18 / 12 / 12, trois attendus `null`.

### Tâche 7 : relire les 18 calculs

- [x] Pour chaque question de calcul, refaire l'opération à partir de la formule de l'analyste et des chiffres de la page.
- [x] Lister les écarts pour Fantin. Ne rien corriger.

### Tâche 8 : la fiche et les textes

**Fichiers :** `data/catalogue/benchmarks.json`, `docs/2026-09-24-modeles-benchmarks-roadmap.md`.

- [x] Réécrire la fiche `analyse-financiere` (libellé, question, description, sous-tâches `releve` / `calcul` / `verdict` / `libelle`, 50 questions). Elle reste « à venir » tant que rien n'est publié.
- [x] Corriger la ligne FinanceBench de la feuille de route et la cible CFPB de `tri-tickets`.
- [x] `npx vitest run` et `npm run typecheck` : tout passe.

### Tâche 9 : chiffrer, et s'arrêter

- [x] `npm run key:check` — le solde réel.
- [x] `npm run eval:run -- --task analyse-financiere --estimate` — doit annoncer 50 documents × 27 modèles.
- [ ] Annoncer le montant à Fantin et attendre. *(annoncé le 07/10 : 9,87 $ estimés, plafond 25,81 $, solde 2,29 $)*

---

## Phase 2 — après l'accord de Fantin

### Tâche 10 : mesurer

- [x] `npm run eval:run -- --task analyse-financiere --run <date>_analyse-financiere`, deux appels à la fois.
- [x] Comparer le coût suivi au solde réel. `npm run eval:score`.

### Tâche 11 : vérifier avant de publier

- [x] Répartition des erreurs par sous-tâche et par question ; les questions que presque tout le panel rate sont relues une à une.
- [x] Classement sur les 26 nombres seuls contre les 50 ; tolérance à 0,1 % et à 1 % contre 0,5 %. Si l'ordre bouge, ne pas publier.
- [ ] `npm run eval:review` : Fantin arbitre les libellés non reconnus et les hallucinations.

### Tâche 12 : publier et montrer

**Fichiers :** `data/published/`, `data/catalogue/benchmarks.json`, `apps/web/src/app/[lang]/benchmarks/[id]/page.tsx`, `apps/web/src/components/about/content.ts`, `METHODOLOGIE.md`.

- [x] `npm run eval:publish`, fiche passée en « pipeline ».
- [x] Tableau « Les questions posées » et pages vues par le modèle ; hallucinations affichées comme un compte sur 3.
- [x] Partie « Protocole : analyse de rapports financiers » de la page Méthodologie, mention de source, limites.
- [x] Section du deuxième benchmark dans `METHODOLOGIE.md`, erreurs commises comprises.
- [x] Vérifier le site sur le serveur de dev ouvert par Fantin (port 4311).

---

## Journal du run du 07/10, à reporter dans METHODOLOGIE.md avant publication

À consigner comme erreurs commises, avec leur cause et la règle qui en découle.

- **Un extracteur trop étroit transforme des réponses justes en échecs.** Il prenait tout
  ce qui sépare la première `{` de la dernière `}` : une explication contenant des
  accolades, ou la réponse écrite deux fois, rendait l'extrait illisible. 7 appels
  payés sur 1 350, tous chez Mistral. Un document en échec chez un seul modèle sort du
  classement pour les 27 : ~20 questions sur 50 étaient touchées. Corrigé le 07/10 :
  objets parcourus un à un, réunis tant qu'ils ne se contredisent pas, rejetés sinon.
  Le texte rejeté est désormais gardé sur 2 000 caractères, contre 160.
- **Une consigne d'unité peut déplacer l'échelle d'une réponse.** « Un pourcentage de
  12,5 % s'écrit 12.5 » a poussé 21 modèles sur 23 à écrire le rendement des actifs de
  Coca-Cola en pourcentage (1,42) quand la référence est le ratio arrondi (0,01). La
  valeur lue était juste. Les deux questions ROA (fb-03473, fb-10420) mesurent le choix
  de l'échelle, pas le calcul. Mon tri les avait laissées passer : j'avais vérifié que
  l'unité des montants était imprimée sur la page, pas l'échelle des ratios.
  Une question dont la référence arrondie ne distingue pas 0,5 % de 1,5 % est de toute
  façon mal posée.
- **Un plafond de jetons commun coûte des questions entières.** 10 appels de 7 modèles
  ont réfléchi jusqu'à 8 000 jetons (20 000 pour Cohere) sans écrire de réponse : 0,61 $
  facturés pour rien.
- **`--resume --models` réécrit `run.json` avec les seuls modèles relancés.** Sauvegardé
  puis restauré à la main à chaque rejeu ; à corriger dans `runTask`.
- **Le coût suivi sous-estime la dépense réelle d'environ 2 %** : 8,49 $ suivis contre
  8,65 $ débités (solde 12,29 $ → 3,64 $).
- **Une liste de formes acceptées écrite avant le run peut être trop étroite.** Pour les
  trois questions « quelle activité a rapporté le plus de trésorerie », les pages
  impriment « Net cash provided by operating activities » (AMD), « Total cash provided by
  operating activities » (Best Buy), « Cash provided (used) by operations » (Nike) : 12
  réponses nommant la ligne imprimée ont été refusées, dont celles de Claude Fable 5.1
  et Opus 5.5. À corriger avec l'accord de Fantin, et à écrire dans le protocole.
- **Un échec propre au modèle sort la question du classement pour tous.** Après les
  rejeux, trois questions restent sans réponse d'un modèle : Kimi K3 a réfléchi 16 000
  jetons sans répondre (fb-04458), Mistral Large s'est contredit deux fois, la dernière
  réponse étant juste dans les deux cas (fb-04302, fb-06741). Règle gardée : une
  contradiction n'est pas tranchée. Classement sur 45 questions sur 50.
- **Mécanisme d'exclusion après coup** : `data/tasks/<tâche>/exclusions.json`, lu par le run
  et la notation. Les réponses restent enregistrées ; le motif s'affiche sur le site.
