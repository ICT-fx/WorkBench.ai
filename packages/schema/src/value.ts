import { z } from "zod";

/**
 * Une valeur extraite d'un document. Récursive : un champ « lignes » contient
 * un tableau d'objets, un montant contient un nombre.
 */
export type Value = string | number | boolean | Value[] | { [k: string]: Value };

export const ValueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(ValueSchema),
    z.record(z.string(), ValueSchema),
  ]),
);
