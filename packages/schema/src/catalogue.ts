import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

/** Tout texte éditorial existe dans les deux langues du site, sans repli implicite. */
export const LocalizedSchema = z.object({ fr: z.string().min(1), en: z.string().min(1) });
export type Localized = z.infer<typeof LocalizedSchema>;

export const LabSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** ISO 3166-1 alpha-2. */
  country: z.string().regex(/^[A-Z]{2}$/),
  /**
   * Emplacement dans la palette catégorielle des graphiques (1 à 8). Absent :
   * le labo est tracé en gris neutre. Huit teintes est le maximum qu'un lecteur
   * daltonien distingue ; la couleur suit le labo, jamais son rang du jour.
   */
  slot: z.number().int().min(1).max(8).optional(),
  /** Une ou deux lettres portées par le marqueur : l'identité ne repose pas sur la couleur seule. */
  monogram: z.string().min(1).max(2),
  url: z.string().url(),
});
export type Lab = z.infer<typeof LabSchema>;

export const ModalitySchema = z.enum(["text", "image", "pdf", "video", "audio"]);
export type Modality = z.infer<typeof ModalitySchema>;

export const ModelSchema = z.object({
  /** Identifiant AI Gateway : c'est celui que le pipeline appelle. */
  id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9.\-]+$/),
  name: z.string().min(1),
  lab: z.string().min(1),
  released: isoDate,
  /** `null` : le statut des poids n'a pas pu être vérifié. */
  weights: z.enum(["ouverts", "fermes"]).nullable(),
  /**
   * Les champs ci-dessous viennent du catalogue public de l'AI Gateway
   * (`npm run catalogue:sync`). `null` : le modèle n'y figure pas — on
   * affiche « non communiqué » plutôt qu'un chiffre de mémoire.
   */
  contextWindow: z.number().int().positive().nullable(),
  maxOutput: z.number().int().positive().nullable(),
  /** Dollars par million de tokens, tarif public. */
  priceIn: z.number().min(0).nullable(),
  priceOut: z.number().min(0).nullable(),
  modalities: z.array(ModalitySchema).min(1),
  reasoning: z.boolean(),
});
export type Model = z.infer<typeof ModelSchema>;

export const ModelCatalogueSchema = z.object({
  /** Date de la dernière synchronisation des prix et fenêtres de contexte. */
  syncedAt: isoDate,
  source: z.string().url(),
  models: z.array(ModelSchema).min(1),
}).refine(
  (c) => new Set(c.models.map((m) => m.id)).size === c.models.length,
  { message: "Deux modèles portent le même id", path: ["models"] },
);
export type ModelCatalogue = z.infer<typeof ModelCatalogueSchema>;

export const DomainSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  label: LocalizedSchema,
  /** Ce que la fonction attend d'une IA, en une phrase. */
  summary: LocalizedSchema,
  icon: z.string().min(1),
});
export type Domain = z.infer<typeof DomainSchema>;

export const SubtaskSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: LocalizedSchema,
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const BenchmarkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  domain: z.string().min(1),
  label: LocalizedSchema,
  /** La question métier, telle qu'un dirigeant la poserait. */
  question: LocalizedSchema,
  description: LocalizedSchema,
  /** Ce que reçoit le modèle : conditionne quels modèles peuvent passer le test. */
  input: z.enum(["texte", "document"]),
  /** Unité d'un cas de test, pour libeller le coût : « par facture », « par ticket ». */
  unit: LocalizedSchema,
  sampleSize: z.number().int().positive(),
  subtasks: z.array(SubtaskSchema).min(2),
  /**
   * `pipeline` : la tâche est exécutable de bout en bout (data/tasks/<id>).
   * `maquette` : le protocole est rédigé, le jeu de test reste à construire.
   */
  maturity: z.enum(["pipeline", "maquette"]),
});
export type Benchmark = z.infer<typeof BenchmarkSchema>;

/** Une publication passée d'un benchmark, réduite à ce qu'il faut pour tracer une évolution. */
export const HistoryRunSchema = z.object({
  runId: z.string().min(1),
  runDate: isoDate,
  status: z.enum(["reel", "demo"]),
  rows: z.array(z.object({
    model: z.string().min(1),
    exactitude: z.number().min(0).max(100),
    costPerDoc: z.number().min(0),
    latencyP50: z.number().min(0),
  })),
});
export type HistoryRun = z.infer<typeof HistoryRunSchema>;

export const BenchmarkHistorySchema = z.object({
  benchmarkId: z.string().min(1),
  /** Du plus ancien au plus récent ; le dernier coïncide avec le classement publié. */
  runs: z.array(HistoryRunSchema),
});
export type BenchmarkHistory = z.infer<typeof BenchmarkHistorySchema>;

export const NewsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  date: isoDate,
  kind: z.enum(["modele", "benchmark", "analyse", "annonce"]),
  title: LocalizedSchema,
  summary: LocalizedSchema,
  /** Paragraphes ; une ligne commençant par « - » est une puce. */
  body: z.object({ fr: z.array(z.string().min(1)).min(1), en: z.array(z.string().min(1)).min(1) }),
  featured: z.boolean().default(false),
  /** Lie l'article à une fiche : il apparaît sous « Mises à jour » de ce modèle ou benchmark. */
  model: z.string().optional(),
  benchmark: z.string().optional(),
});
export type News = z.infer<typeof NewsSchema>;
