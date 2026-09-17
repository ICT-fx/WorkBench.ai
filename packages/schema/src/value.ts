import { z } from "zod";

/**
 * Une valeur extraite d'un document.
 *
 * `null` est admis à tout niveau, y compris imbriqué : une ligne de facture en
 * franchise de TVA porte légitimement un `taux_tva` nul. Au premier niveau d'un
 * champ de vérité terrain, `null` signifie « absent du document ».
 */
export type Value = string | number | boolean | null | Value[] | { [k: string]: Value };

export const ValueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(ValueSchema),
    z.record(z.string(), ValueSchema),
  ]),
);
