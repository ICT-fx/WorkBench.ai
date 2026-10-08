import { z } from "zod";

export const CRITERION_KINDS = ["exact", "number", "date", "lines", "text"] as const;
export const CriterionKindSchema = z.enum(CRITERION_KINDS);
export type CriterionKind = z.infer<typeof CriterionKindSchema>;

export const CriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: CriterionKindSchema,
  /** Criticité métier, pas difficulté technique. */
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Un champ critique faux fait basculer le document en « à relire ». */
  critical: z.boolean(),
  /** Écart toléré pour les critères numériques. 0 = au centime près. */
  tolerance: z.number().min(0).optional(),
  /**
   * Écart toléré en proportion de la référence : 0.005 vaut 0,5 %.
   *
   * Sert aux références arrondies par leur annotateur — la page porte 1 615,9,
   * la référence dit 1 616. S'y ajoute alors la moitié du dernier chiffre que la
   * référence affiche (« 1.9 » → 0,05) ; le plus large des écarts s'applique.
   */
  toleranceRelative: z.number().min(0).optional(),
  /**
   * Le signe décimal du document, pour les critères de kind "number".
   * Quand il est fixé, l'autre signe sépare les milliers : sur un rapport
   * américain, « 1.734 » vaut 1,734 et non 1 734. Sans lui, la lecture devine,
   * ce qui suffit à des montants mais pas à des ratios.
   */
  decimalSeparator: z.enum([".", ","]).optional(),
  /**
   * La clé JSON où lire la réponse du modèle, quand elle diffère de `id`.
   *
   * Sert aux tâches où chaque document ne pose qu'une question : le modèle
   * répond toujours sous la même clé, sans avoir à savoir quel critère le note.
   */
  key: z.string().min(1).optional(),
  /**
   * Convention de lecture des dates chiffrées, pour les critères de kind "date".
   * "DMY" (défaut) : 02/03 = 2 mars, usage français.
   * "MDY" : 02/03 = 3 février, usage américain.
   * La convention suit le pays du document, pas celui du lecteur.
   */
  dateOrder: z.enum(["DMY", "MDY"]).optional(),
  /**
   * Raison pour laquelle ce critère est écarté de la note.
   *
   * La réponse des modèles reste enregistrée et consultable, mais elle ne
   * compte pas. Sert aux champs dont la question admet plusieurs réponses
   * défendables : on mesurerait alors si le modèle devine ce qu'on voulait,
   * pas s'il sait lire.
   */
  exclu: z.string().min(1).optional(),
  /** Mots-clés attendus, pour les critères de kind "text". */
  expectedKeywords: z.array(z.string()).optional(),
});
export type Criterion = z.infer<typeof CriterionSchema>;
