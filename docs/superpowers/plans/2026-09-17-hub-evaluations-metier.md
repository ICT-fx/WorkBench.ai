# Hub d'évaluations métier — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un site statique qui publie le classement de six modèles d'IA sur l'extraction de factures françaises, alimenté par un pipeline d'évaluation rejouable dont toutes les données sont versionnées dans git.

**Architecture:** Monorepo npm workspaces. `data/` est la source de vérité (définition de tâche, documents, vérités terrain, runs horodatés, agrégats publiés). Trois paquets : `schema` (types + validation Zod partagés), `fixtures` (génération des documents de test), `eval` (les quatre commandes du pipeline). Le site Next.js lit `data/published/` au build et produit des pages statiques.

**Tech Stack:** TypeScript 5, Node 24, npm workspaces, Zod 4, Vitest, `@napi-rs/canvas` (rendu des factures), `sharp` (dégradations), AI SDK 6 + Vercel AI Gateway, Next.js 16 App Router, déploiement Vercel.

**Spec:** `docs/superpowers/specs/2026-09-17-hub-evaluations-metier-design.md`

## Global Constraints

- **Langue** : tout le contenu visible (site, CLI, messages de commit, noms de champs métier) est en français. Le code, les identifiants et les noms de fichiers sont en anglais, sauf les identifiants de critères qui reprennent le vocabulaire métier (`total_ttc`, `siret_emetteur`).
- **Node** : 24 ou supérieur. **npm workspaces**, jamais pnpm ni yarn.
- **Modules** : ESM partout (`"type": "module"`), imports avec extension `.js`.
- **Validation** : tout fichier de `data/` est validé par un schéma Zod à l'écriture **et** à la lecture. Un JSON malformé doit faire échouer le build, jamais produire une page incomplète.
- **Immutabilité** : `data/runs/<id>/raw/` n'est jamais réécrit après `eval run`. Toute correction passe par un nouveau run ou par `review.json`.
- **Verdicts** : exactement quatre valeurs, `"correct" | "faux" | "manquant" | "hallucine"`. Ne jamais en introduire une cinquième.
- **Montants** : comparés au centime, tolérance zéro. Stockés en nombre décimal, jamais en chaîne.
- **Dépôt public** : aucune donnée réelle d'un client ou d'un fournisseur. Les factures sont entièrement fabriquées. Aucune clé d'API commitée.
- **TDD** : pour `packages/eval` et `packages/schema`, le test échoue avant l'implémentation. Commit à chaque cycle.

---

### Task 1 : Socle du monorepo et paquet `schema`

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore` (modifier)
- Create: `packages/schema/package.json`, `packages/schema/tsconfig.json`
- Create: `packages/schema/src/index.ts`, `criterion.ts`, `task.ts`, `ground-truth.ts`, `run.ts`, `score.ts`, `leaderboard.ts`
- Test: `packages/schema/src/schema.test.ts`

**Interfaces:**
- Consumes: rien (première tâche)
- Produces: `CriterionSchema`, `TaskSchema`, `GroundTruthSchema`, `ModelResultSchema`, `DocScoreSchema`, `LeaderboardSchema`, et les types inférés `Criterion`, `Task`, `GroundTruth`, `ModelResult`, `DocScore`, `Leaderboard`, `FieldVerdict`, `Value`. Plus `parseFile<T>(schema, path): Promise<T>` qui lit un JSON, le valide, et lève une erreur nommant le fichier et le chemin du champ fautif.

- [ ] **Step 1 : Initialiser le workspace**

`package.json` racine :

```json
{
  "name": "hub-evals",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsx": "^4.19.0",
    "@types/node": "^24.0.0"
  }
}
```

`tsconfig.base.json` : `strict: true`, `module: "nodenext"`, `moduleResolution: "nodenext"`, `target: "es2023"`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`.

- [ ] **Step 2 : Écrire les tests de schéma qui échouent**

```ts
// packages/schema/src/schema.test.ts
import { describe, it, expect } from "vitest";
import { TaskSchema, GroundTruthSchema, LeaderboardSchema } from "./index.js";

describe("TaskSchema", () => {
  it("accepte une tâche minimale valide", () => {
    const task = {
      id: "facture-fr", label: "Facture française",
      question: "Extraire les champs d'une facture fournisseur française",
      criteria: [{ id: "total_ttc", label: "Montant TTC", kind: "number", weight: 3, critical: true, tolerance: 0 }],
    };
    expect(TaskSchema.parse(task).criteria[0]!.id).toBe("total_ttc");
  });

  it("refuse un poids hors de 1-3", () => {
    const task = { id: "t", label: "T", question: "q",
      criteria: [{ id: "c", label: "C", kind: "exact", weight: 7, critical: false }] };
    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it("refuse deux critères avec le même id", () => {
    const c = { id: "dup", label: "D", kind: "exact", weight: 1, critical: false };
    expect(() => TaskSchema.parse({ id: "t", label: "T", question: "q", criteria: [c, c] })).toThrow();
  });
});

describe("GroundTruthSchema", () => {
  it("accepte null comme valeur de champ (champ absent du document)", () => {
    const gt = { docId: "f-001", fields: { total_ttc: 120.5, taux_tva: null } };
    expect(GroundTruthSchema.parse(gt).fields.taux_tva).toBeNull();
  });
});

describe("LeaderboardSchema", () => {
  it("refuse un pourcentage supérieur à 100", () => {
    const lb = { taskId: "facture-fr", runDate: "2026-10-08", sampleSize: 25,
      rows: [{ model: "m", modelVersion: "v", sansRelecture: 101, exactitude: 90,
               hallucinations: 0, costPerDoc: 0.01, latencyP50: 1200 }] };
    expect(() => LeaderboardSchema.parse(lb)).toThrow();
  });
});
```

- [ ] **Step 3 : Lancer les tests et vérifier qu'ils échouent**

Run: `npm test -- packages/schema`
Expected: FAIL, `Cannot find module './index.js'`

- [ ] **Step 4 : Implémenter les schémas**

Points non négociables :
- `CriterionSchema` : `weight` est `z.union([z.literal(1), z.literal(2), z.literal(3)])`, `kind` est l'énumération `["exact","number","date","lines","text"]`, `tolerance` optionnel et positif.
- `TaskSchema.criteria` : `.refine()` vérifiant l'unicité des `id`.
- `ValueSchema` : récursif via `z.lazy()` — `string | number | boolean | Value[] | Record<string, Value>`.
- `GroundTruthSchema.fields` : `z.record(z.string(), ValueSchema.nullable())`. Le `null` est significatif, jamais un champ manquant.
- `LeaderboardSchema` : `sansRelecture`, `exactitude`, `hallucinations` bornés `min(0).max(100)`.
  Chaque ligne porte aussi `errorCount: number` (appels en échec, consommé par la Task 5) et
  `docCount: number` (documents réellement notés). Sans eux, un modèle ayant échoué sur la moitié
  du jeu afficherait un score flatteur calculé sur les seules factures faciles.
- `parseFile` enveloppe `ZodError` dans une erreur portant le chemin du fichier.

- [ ] **Step 5 : Lancer les tests et vérifier qu'ils passent**

Run: `npm test -- packages/schema` puis `npm run typecheck`
Expected: PASS, aucune erreur de type

- [ ] **Step 6 : Commit**

```bash
git add package.json tsconfig.base.json vitest.config.ts .gitignore packages/schema
git commit -m "Ajouter le socle du monorepo et les schémas de données"
```

---

### Task 2 : Définition de la tâche « facture française »

**Files:**
- Create: `data/tasks/facture-fr/task.json`
- Create: `data/tasks/facture-fr/prompt.md`
- Test: `packages/schema/src/facture-fr.test.ts`

**Interfaces:**
- Consumes: `TaskSchema`, `parseFile` (Task 1)
- Produces: les identifiants de critères que tout le reste du projet référence — `numero_facture`, `date_emission`, `siret_emetteur`, `tva_intracom`, `total_ht`, `total_tva`, `total_ttc`, `echeance`, `lignes`, `mentions_speciales`. Aucune autre tâche n'invente d'identifiant hors de cette liste.

- [ ] **Step 1 : Écrire le test de conformité du barème**

```ts
// packages/schema/src/facture-fr.test.ts
import { describe, it, expect } from "vitest";
import { TaskSchema } from "./index.js";
import { readFileSync } from "node:fs";

const task = TaskSchema.parse(JSON.parse(readFileSync("data/tasks/facture-fr/task.json", "utf8")));

describe("barème facture-fr", () => {
  it("contient les dix critères du design, ni plus ni moins", () => {
    expect(task.criteria.map((c) => c.id).sort()).toEqual([
      "date_emission", "echeance", "lignes", "mentions_speciales", "numero_facture",
      "siret_emetteur", "total_ht", "total_ttc", "total_tva", "tva_intracom",
    ]);
  });

  it("marque comme critiques exactement les champs qui déclenchent une relecture", () => {
    expect(task.criteria.filter((c) => c.critical).map((c) => c.id).sort())
      .toEqual(["date_emission", "numero_facture", "siret_emetteur", "total_ht", "total_ttc", "total_tva"]);
  });

  it("donne une tolérance nulle aux montants", () => {
    for (const id of ["total_ht", "total_tva", "total_ttc"]) {
      expect(task.criteria.find((c) => c.id === id)!.tolerance).toBe(0);
    }
  });
});
```

- [ ] **Step 2 : Lancer et vérifier l'échec**

Run: `npm test -- facture-fr`
Expected: FAIL, fichier `task.json` introuvable

- [ ] **Step 3 : Écrire `task.json` et `prompt.md`**

`task.json` reprend le tableau §4.4 de la spec : poids 3 pour les trois montants et le SIRET, 2 pour le numéro, la date, la TVA intracom et les lignes, 1 pour l'échéance et les mentions spéciales. `critical: true` sur les six champs listés dans le test.

`prompt.md` est le prompt exact envoyé aux modèles. Exigences :
- demande une sortie JSON stricte avec exactement les dix clés ci-dessus ;
- **impose explicitement `null` quand l'information est absente du document**, et interdit de deviner — c'est ce qui rend la mesure des hallucinations honnête : on ne peut pas reprocher à un modèle une invention si on ne lui a pas dit de s'abstenir ;
- fixe le format : dates en `AAAA-MM-JJ`, montants en nombres décimaux sans symbole ni séparateur de milliers, SIRET en 14 chiffres sans espace ;
- décrit la structure d'une ligne : `{ designation, quantite, prix_unitaire_ht, taux_tva }`.

- [ ] **Step 4 : Lancer et vérifier le succès**

Run: `npm test -- facture-fr`
Expected: PASS (3 tests)

- [ ] **Step 5 : Commit**

```bash
git add data/tasks/facture-fr packages/schema/src/facture-fr.test.ts
git commit -m "Définir le barème et le prompt de la tâche facture française"
```

---

### Task 3 : Générateur du jeu de test

**Files:**
- Create: `packages/fixtures/package.json`, `tsconfig.json`
- Create: `packages/fixtures/src/invoice-model.ts` (le modèle métier d'une facture et son calcul)
- Create: `packages/fixtures/src/scenarios.ts` (les 25 scénarios, cas pièges compris)
- Create: `packages/fixtures/src/render.ts` (rendu canvas, 3 gabarits)
- Create: `packages/fixtures/src/degrade.ts` (rotation, bruit, contraste)
- Create: `packages/fixtures/src/cli.ts` (`fixtures generate`)
- Test: `packages/fixtures/src/invoice-model.test.ts`, `scenarios.test.ts`
- Génère: `data/tasks/facture-fr/documents/*.png`, `data/tasks/facture-fr/ground-truth/*.json`

**Interfaces:**
- Consumes: `GroundTruthSchema` (Task 1), les identifiants de critères (Task 2)
- Produces: `buildInvoice(scenario): Invoice`, `toGroundTruth(invoice): GroundTruth`, `SCENARIOS: Scenario[]` de longueur 25.

- [ ] **Step 1 : Écrire les tests du modèle de facture**

```ts
// packages/fixtures/src/invoice-model.test.ts
import { describe, it, expect } from "vitest";
import { buildInvoice, toGroundTruth } from "./invoice-model.js";

describe("cohérence comptable", () => {
  it("calcule un TTC égal au HT plus la TVA, au centime", () => {
    const inv = buildInvoice({ id: "f-001", lines: [
      { designation: "Prestation", quantite: 3, prixUnitaireHT: 100, tauxTVA: 20 }] });
    expect(inv.totalHT).toBe(300);
    expect(inv.totalTVA).toBe(60);
    expect(inv.totalTTC).toBe(360);
  });

  it("additionne correctement deux taux de TVA différents", () => {
    const inv = buildInvoice({ id: "f-002", lines: [
      { designation: "Livre", quantite: 2, prixUnitaireHT: 10, tauxTVA: 5.5 },
      { designation: "Conseil", quantite: 1, prixUnitaireHT: 100, tauxTVA: 20 }] });
    expect(inv.totalHT).toBe(120);
    expect(inv.totalTVA).toBeCloseTo(21.1, 2);
    expect(inv.totalTTC).toBeCloseTo(141.1, 2);
  });

  it("produit des totaux négatifs pour un avoir", () => {
    const inv = buildInvoice({ id: "f-003", isCreditNote: true, lines: [
      { designation: "Retour", quantite: 1, prixUnitaireHT: 50, tauxTVA: 20 }] });
    expect(inv.totalTTC).toBeLessThan(0);
  });

  it("met la TVA à null en franchise en base, pas à zéro", () => {
    const inv = buildInvoice({ id: "f-004", vatExempt: "293B", lines: [
      { designation: "Prestation", quantite: 1, prixUnitaireHT: 500, tauxTVA: null }] });
    const gt = toGroundTruth(inv);
    expect(gt.fields.total_tva).toBeNull();
    expect(gt.fields.total_ttc).toBe(500);
    expect(gt.fields.mentions_speciales).toContain("293 B");
  });

  it("applique une remise en pied de facture avant la TVA", () => {
    const inv = buildInvoice({ id: "f-005", globalDiscountPct: 10, lines: [
      { designation: "Prestation", quantite: 1, prixUnitaireHT: 1000, tauxTVA: 20 }] });
    expect(inv.totalHT).toBe(900);
    expect(inv.totalTTC).toBe(1080);
  });

  it("génère un SIRET dont la clé de Luhn est valide", () => {
    const inv = buildInvoice({ id: "f-006", lines: [
      { designation: "X", quantite: 1, prixUnitaireHT: 1, tauxTVA: 20 }] });
    const digits = inv.emetteur.siret.split("").map(Number);
    const sum = digits.reduce((acc, d, i) => {
      const doubled = i % 2 === 0 ? d * 2 : d;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }, 0);
    expect(sum % 10).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer et vérifier l'échec**

Run: `npm test -- invoice-model`
Expected: FAIL, module introuvable

- [ ] **Step 3 : Implémenter `invoice-model.ts`**

Règles :
- tous les montants arrondis au centime avec `Math.round(x * 100) / 100` appliqué **par ligne puis au total**, jamais sur un cumul en virgule flottante brut ;
- `vatExempt: "293B"` ⇒ `total_tva` et `taux_tva` valent `null`, `total_ttc === total_ht`, et `mentions_speciales` porte la mention légale ;
- `isCreditNote` ⇒ tous les totaux négatifs et le libellé « AVOIR » ;
- `autoliquidation` ⇒ `total_tva: null`, mention « Autoliquidation — article 283-2 nonies du CGI » ;
- `deposit` (acompte) ⇒ champ `net_a_payer` distinct du `total_ttc` ; **le barème note `total_ttc`, pas le net à payer** : c'est précisément le piège ;
- le SIRET est généré puis corrigé pour satisfaire Luhn ;
- `toGroundTruth` ne produit que les dix clés du barème, et `null` pour tout champ absent.

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npm test -- invoice-model`
Expected: PASS (6 tests)

- [ ] **Step 5 : Écrire le test de couverture des scénarios**

```ts
// packages/fixtures/src/scenarios.test.ts
import { describe, it, expect } from "vitest";
import { SCENARIOS } from "./scenarios.js";

describe("jeu de test", () => {
  it("compte 25 documents aux identifiants uniques", () => {
    expect(SCENARIOS).toHaveLength(25);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(25);
  });

  it("couvre les neuf cas pièges du design", () => {
    const traps = SCENARIOS.flatMap((s) => s.traps ?? []);
    for (const trap of ["multi_tva", "avoir", "remise_pied", "acompte", "franchise_293b",
                        "autoliquidation", "scan_degrade", "devise_etrangere", "deux_pages"]) {
      expect(traps).toContain(trap);
    }
  });

  it("garde au moins huit factures nominales sans piège", () => {
    expect(SCENARIOS.filter((s) => !s.traps?.length).length).toBeGreaterThanOrEqual(8);
  });

  it("répartit les documents sur les trois gabarits visuels", () => {
    for (const t of ["sobre", "tableau", "colore"]) {
      expect(SCENARIOS.filter((s) => s.template === t).length).toBeGreaterThanOrEqual(5);
    }
  });
});
```

- [ ] **Step 6 : Lancer, vérifier l'échec, puis écrire `scenarios.ts`**

Run: `npm test -- scenarios` → FAIL, puis implémenter les 25 scénarios et relancer → PASS (4 tests)

- [ ] **Step 7 : Implémenter le rendu et la génération**

- `render.ts` : trois gabarits distincts au canvas (`sobre` : texte aligné à gauche, peu de cadres ; `tableau` : lignes en vraie grille bordée ; `colore` : bandeau d'en-tête coloré, police différente). Largeur 1240 px, hauteur variable. Le gabarit `deux_pages` produit deux images `-p1` et `-p2`.
- `degrade.ts` via `sharp` : rotation de 1,5 à 3°, bruit gaussien léger, baisse de contraste, export JPEG qualité 70 puis reconversion PNG — pour imiter une photo de scan.
- `cli.ts` : `npm run fixtures:generate` écrit les PNG dans `documents/` et les JSON dans `ground-truth/`, chacun validé par `GroundTruthSchema` avant écriture. Le générateur est **déterministe** : graine fixe, donc régénérer ne produit aucun diff git parasite.

- [ ] **Step 8 : Générer le jeu et l'inspecter**

Run: `npm run fixtures:generate`
Expected: 26 PNG (25 factures dont une sur deux pages) + 25 JSON. Ouvrir trois images au hasard, dont une dégradée, et vérifier qu'elles sont lisibles à l'œil.

- [ ] **Step 9 : Mettre à jour la spec et commit**

Ajouter à la section « ce que ce test ne mesure pas » de la spec : documents synthétiques et non factures réelles anonymisées, images et non PDF avec couche texte.

```bash
git add packages/fixtures data/tasks/facture-fr docs/superpowers/specs
git commit -m "Générer le jeu de 25 factures de test et leur vérité terrain"
```

---

### Task 4 : Moteur de scoring

**Files:**
- Create: `packages/eval/package.json`, `tsconfig.json`
- Create: `packages/eval/src/compare.ts` (un comparateur par `kind`)
- Create: `packages/eval/src/score.ts` (verdict et points par champ, puis par document)
- Test: `packages/eval/src/compare.test.ts`, `packages/eval/src/score.test.ts`

**Interfaces:**
- Consumes: `Criterion`, `Value`, `FieldVerdict`, `GroundTruth`, `DocScore` (Task 1), `task.json` (Task 2)
- Produces: `compareField(criterion, expected, got): FieldVerdict`, `scoreDocument(task, groundTruth, parsed): DocScore`

C'est le cœur du projet. Une erreur ici fausse silencieusement tout un classement sans jamais lever d'exception.

- [ ] **Step 1 : Écrire les tests de verdict**

```ts
// packages/eval/src/compare.test.ts
import { describe, it, expect } from "vitest";
import { compareField } from "./compare.js";

const num = { id: "total_ttc", label: "TTC", kind: "number", weight: 3, critical: true, tolerance: 0 } as const;
const date = { id: "date_emission", label: "Date", kind: "date", weight: 2, critical: true } as const;
const exact = { id: "siret_emetteur", label: "SIRET", kind: "exact", weight: 3, critical: true } as const;

describe("les trois verdicts face à un champ absent", () => {
  it("attendu null, rien produit → correct", () => {
    expect(compareField(num, null, null)).toBe("correct");
  });
  it("attendu null, une valeur produite → hallucine", () => {
    expect(compareField(num, null, 42)).toBe("hallucine");
  });
  it("attendu une valeur, rien produit → manquant", () => {
    expect(compareField(num, 42, null)).toBe("manquant");
  });
  it("une chaîne vide vaut une absence, pas une valeur inventée", () => {
    expect(compareField(exact, null, "")).toBe("correct");
  });
});

describe("montants", () => {
  it("accepte une valeur au centime près et refuse au-delà", () => {
    expect(compareField(num, 1234.56, 1234.56)).toBe("correct");
    expect(compareField(num, 1234.56, 1234.57)).toBe("faux");
  });
  it("lit un montant rendu en chaîne avec virgule et séparateur de milliers", () => {
    expect(compareField(num, 1234.56, "1 234,56")).toBe("correct");
    expect(compareField(num, 1234.56, "1.234,56 €")).toBe("correct");
  });
  it("distingue un avoir d'une facture de même montant", () => {
    expect(compareField(num, -120, 120)).toBe("faux");
  });
});

describe("dates", () => {
  it("normalise les formats courants vers la même date", () => {
    expect(compareField(date, "2026-03-04", "04/03/2026")).toBe("correct");
    expect(compareField(date, "2026-03-04", "4 mars 2026")).toBe("correct");
  });
  it("ne confond pas jour et mois sur une date ambiguë au format US", () => {
    expect(compareField(date, "2026-03-04", "03/04/2026")).toBe("faux");
  });
});

describe("champs exacts", () => {
  it("ignore les espaces et la casse mais pas les chiffres", () => {
    expect(compareField(exact, "40483304800022", "404 833 048 00022")).toBe("correct");
    expect(compareField(exact, "40483304800022", "40483304800023")).toBe("faux");
  });
});
```

- [ ] **Step 2 : Lancer et vérifier l'échec**

Run: `npm test -- compare`
Expected: FAIL, module introuvable

- [ ] **Step 3 : Implémenter `compare.ts`**

Ordre de décision imposé, à respecter tel quel :
1. normaliser la valeur produite : `undefined`, `""`, `"null"`, `"N/A"`, `"non trouvé"` deviennent `null` ;
2. `expected === null && got === null` → `correct` ;
3. `expected === null && got !== null` → `hallucine` ;
4. `expected !== null && got === null` → `manquant` ;
5. sinon, comparaison typée selon `kind`.

Pour `number` : accepter chaîne ou nombre, retirer symboles monétaires et espaces (y compris insécables), traiter le dernier séparateur comme décimal, comparer à `tolerance` près. Pour `date` : normaliser en `AAAA-MM-JJ`, accepter `JJ/MM/AAAA` et les mois écrits en français, **refuser** l'interprétation `MM/JJ/AAAA`. Pour `exact` : comparer après suppression des espaces et passage en minuscules. Pour `lines` : score F1 sur l'appariement des lignes, `correct` si F1 ≥ 0,9. Pour `text` : `correct` si tous les mots-clés attendus sont présents.

- [ ] **Step 4 : Vérifier que les tests passent**

Run: `npm test -- compare`
Expected: PASS (11 tests)

- [ ] **Step 5 : Écrire les tests d'agrégation par document**

```ts
// packages/eval/src/score.test.ts — extrait
it("bascule needsReview dès qu'un seul champ critique est faux", () => {
  const s = scoreDocument(task, gt, { ...parfait, total_ttc: 999 });
  expect(s.needsReview).toBe(true);
});
it("ne bascule pas needsReview pour un champ non critique faux", () => {
  const s = scoreDocument(task, gt, { ...parfait, echeance: "2099-01-01" });
  expect(s.needsReview).toBe(false);
});
it("compte zéro point pour une hallucination, comme pour un champ faux", () => {
  const s = scoreDocument(task, gt, { ...parfait, taux_tva_absent: 20 });
  expect(s.byCriterion.total_tva!.points).toBe(0);
});
it("attribue les points au prorata du poids du critère", () => {
  const s = scoreDocument(task, gt, parfait);
  expect(s.byCriterion.total_ttc!.points).toBe(3);
});
```

- [ ] **Step 6 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

Run: `npm test -- score` → FAIL → implémenter `score.ts` → PASS

- [ ] **Step 7 : Commit**

```bash
git add packages/eval
git commit -m "Implémenter le moteur de scoring et ses comparateurs"
```

---

### Task 5 : Agrégation, classement et `eval publish`

**Files:**
- Create: `packages/eval/src/aggregate.ts`, `packages/eval/src/publish.ts`
- Test: `packages/eval/src/aggregate.test.ts`

**Interfaces:**
- Consumes: `DocScore` (Task 4), `LeaderboardSchema` (Task 1)
- Produces: `aggregate(scores, results): LeaderboardRow[]`, `publish(runDir, outFile): Promise<void>`

- [ ] **Step 1 : Écrire les tests des quatre métriques**

```ts
it("compte le pourcentage de documents sans aucun champ critique faux", () => {
  const rows = aggregate([ok, ok, ok, needsReview], results);
  expect(rows[0]!.sansRelecture).toBe(75);
});
it("calcule l'exactitude comme un ratio de points pondérés", () => {
  expect(aggregate([demiPoints], results)[0]!.exactitude).toBe(50);
});
it("rapporte les hallucinations au nombre de champs réellement absents", () => {
  // 2 champs attendus null, 1 inventé → 50 %
  expect(aggregate([uneHallucination], results)[0]!.hallucinations).toBe(50);
});
it("prend la médiane des latences, pas la moyenne", () => {
  expect(aggregate(scores, [lat(100), lat(200), lat(5000)])[0]!.latencyP50).toBe(200);
});
it("classe par exactitude décroissante", () => {
  expect(aggregate(mixte, results).map((r) => r.model)).toEqual(["fort", "moyen", "faible"]);
});
it("exclut du calcul les documents en erreur d'appel, et le signale", () => {
  const rows = aggregate(scores, [...results, { error: "timeout" }]);
  expect(rows[0]!.errorCount).toBe(1);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

La médiane et non la moyenne : un seul appel lent fausserait la moyenne et donnerait une image trompeuse du modèle.

- [ ] **Step 3 : Implémenter `publish.ts`**

Lit `scores.json` et `review.json` du run, **applique les arbitrages humains par-dessus le score automatique**, agrège, valide par `LeaderboardSchema`, écrit `data/published/<tache>.json`. Refuse de publier si un run contient plus de 10 % d'erreurs d'appel pour un modèle : mieux vaut pas de classement qu'un classement faussé.

- [ ] **Step 4 : Commit**

```bash
git add packages/eval
git commit -m "Agréger les scores en classement publiable"
```

---

### Task 6 : `eval run` via l'AI Gateway

**Files:**
- Create: `packages/eval/src/run.ts`, `packages/eval/src/models.ts`, `packages/eval/src/cli.ts`
- Test: `packages/eval/src/run.test.ts`

**Interfaces:**
- Consumes: `task.json`, `prompt.md` (Task 2), les documents (Task 3)
- Produces: `runTask(opts): Promise<RunSummary>`, écrit `data/runs/<date>_<tache>/`

- [ ] **Step 1 : Écrire les tests avec un client factice**

Le test injecte un `generate` factice, sans aucun appel réseau :

```ts
it("écrit un fichier brut par modèle et par document", async () => { /* ... */ });
it("capture la version réelle du modèle retournée par l'API, pas l'alias demandé", async () => { /* ... */ });
it("enregistre l'erreur et poursuit les autres documents quand un appel échoue", async () => { /* ... */ });
it("n'écrase jamais un run existant", async () => {
  await expect(runTask({ runId: dejaExistant })).rejects.toThrow(/existe déjà/);
});
it("réutilise les réponses déjà présentes quand on relance avec --resume", async () => { /* ... */ });
```

`--resume` n'est pas du confort : une interruption au 20ᵉ document sur 150 appels ne doit pas coûter 20 appels payants de plus.

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter**

`run.ts` utilise `generateObject` de l'AI SDK avec un schéma Zod dérivé du barème, via l'AI Gateway (chaîne `"fournisseur/modele"`, une seule clé pour tous). Capture `usage`, coût, latence, et la version exacte renvoyée. Concurrence limitée à 4 appels simultanés. La liste des modèles vit dans `models.ts` et est résolue depuis le catalogue du Gateway au lancement.

- [ ] **Step 3 : Vérifier les tests puis commit**

```bash
git add packages/eval
git commit -m "Exécuter les appels modèles via l'AI Gateway"
```

---

### Task 7 : `eval review`, l'arbitrage humain

**Files:**
- Create: `packages/eval/src/review.ts`
- Test: `packages/eval/src/review.test.ts`

**Interfaces:**
- Consumes: `scores.json` (Task 4)
- Produces: `selectForReview(scores, seed): ReviewItem[]`, écrit `review.json`

- [ ] **Step 1 : Écrire les tests de sélection**

```ts
it("présente systématiquement toutes les hallucinations", () => { /* ... */ });
it("présente les écarts de format limites même jugés corrects", () => { /* ... */ });
it("échantillonne 10 % des champs corrects pour détecter un scoring trop indulgent", () => { /* ... */ });
it("produit la même sélection à graine égale", () => {
  expect(selectForReview(scores, 42)).toEqual(selectForReview(scores, 42));
});
it("n'écrase pas un arbitrage déjà rendu lors d'une relance", () => { /* ... */ });
```

- [ ] **Step 2 : Implémenter**

CLI en terminal : affiche le champ, l'attendu, le produit, le verdict automatique, et demande de confirmer ou corriger. Chaque arbitrage écrit verdict, auteur et horodatage dans `review.json`. L'arbitrage prime toujours sur l'automatique.

- [ ] **Step 3 : Commit**

```bash
git add packages/eval
git commit -m "Ajouter l'arbitrage humain des scores"
```

---

### Task 8 : Le site

**Files:**
- Create: `apps/web/` (Next.js 16, App Router, TypeScript, Tailwind)
- Create: `apps/web/src/app/page.tsx`, `src/app/taches/[taskId]/page.tsx`, `src/app/methodologie/page.tsx`
- Create: `apps/web/src/lib/data.ts` (lecture et validation de `data/published/`)
- Create: `apps/web/src/components/Leaderboard.tsx`, `Recommandations.tsx`, `CasPieges.tsx`
- Test: `apps/web/src/lib/data.test.ts`

**Interfaces:**
- Consumes: `data/published/facture-fr.json`, `LeaderboardSchema` (Task 1)
- Produces: un site statique

- [ ] **Step 1 : Écrire le test de lecture des données**

```ts
it("valide le classement publié et échoue bruyamment s'il est malformé", () => { /* ... */ });
it("calcule les trois recommandations à partir des quatre métriques", () => {
  const r = recommandations(rows);
  expect(r.precision.model).toBe("le plus exact");
  expect(r.rapport.model).toBe("le meilleur rapport coût/exactitude");
  expect(r.risque.model).toBe("le moins halluciné");
});
it("écarte des recommandations un modèle dépassant 1 % d'hallucinations", () => { /* ... */ });
```

Cette dernière règle est un choix éditorial assumé : un modèle qui invente ne peut pas être recommandé, même s'il est premier au score.

- [ ] **Step 2 : Implémenter la lecture puis les pages**

`generateStaticParams` depuis les fichiers de `data/published/`. Le build échoue si un JSON est invalide. Aucune donnée n'est récupérée à l'exécution.

- [ ] **Step 3 : Soigner la lisibilité du tableau**

L'enjeu de design est unique : rendre lisible un tableau dense. Chiffres alignés à droite en chasse fixe tabulaire, barres de proportion discrètes derrière les pourcentages, colonne « sans relecture » visuellement dominante, hallucinations en rouge dès qu'elles dépassent zéro. Lisible sur téléphone : le tableau se replie en cartes empilées sous 768 px.

- [ ] **Step 4 : Vérifier le build et commit**

Run: `npm run build -w apps/web`

```bash
git add apps/web
git commit -m "Construire le site de publication des classements"
```

---

### Task 9 : Mise en ligne

**Files:**
- Create: `vercel.ts`, `README.md`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1 : CI** — `npm test` et `npm run build` à chaque push. Le build valide les données : une publication corrompue ne peut pas atteindre la production.
- [ ] **Step 2 : `README.md`** — le protocole, comment rejouer un run, comment ajouter un modèle ou une tâche. C'est la porte d'entrée d'un visiteur venu vérifier.
- [ ] **Step 3 : Déployer** — `vercel` en préversion, relecture, puis production après validation de Fantin.
- [ ] **Step 4 : Commit**

---

## Ordre d'exécution et dépendances

Tasks 1 → 2 → 3 sont séquentielles. Task 4 dépend de 1 et 2 seulement, pas de 3 : le moteur de scoring se teste sur des données inventées dans les tests. Task 5 dépend de 4. Task 6 dépend de 2 et 3. Tasks 7, 8 dépendent de 5. Task 9 clôt.

**Sans clé AI Gateway**, les tâches 1 à 5, 7 et 8 sont intégralement réalisables et testables. Seule la tâche 6 exige une clé pour produire un vrai run — son code et ses tests, eux, s'écrivent hors ligne.
