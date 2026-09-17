import { generateObject } from "ai";
import { z } from "zod";
import type { Task } from "@hub/schema";
import { computeCost, type Catalogue } from "./models";
import type { GenerateFn } from "./run";

const looseLine = z.object({
  designation: z.string().nullable(),
  quantite: z.union([z.number(), z.string()]).nullable(),
  prix_unitaire_ht: z.union([z.number(), z.string()]).nullable(),
  taux_tva: z.union([z.number(), z.string()]).nullable(),
});

/**
 * Le schéma de sortie demandé aux modèles.
 *
 * Les scalaires acceptent indifféremment nombre ou chaîne. Contraindre le type
 * ferait échouer la génération d'un modèle qui écrit « 1 234,56 » — ce qui
 * compterait comme une erreur d'appel alors que le modèle a parfaitement lu la
 * facture. La normalisation des formats est le travail des comparateurs, qui
 * sont faits et testés pour ça.
 */
export function schemaForTask(task: Task): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const criterion of task.criteria) {
    shape[criterion.id] = criterion.kind === "lines"
      ? z.array(looseLine).nullable()
      : z.union([z.string(), z.number()]).nullable();
  }
  return z.object(shape);
}

/**
 * Appelle un modèle via l'AI Gateway.
 *
 * Le coût est recalculé depuis les tarifs publiés du catalogue plutôt que lu
 * dans les métadonnées du fournisseur : c'est vérifiable par un lecteur du
 * dépôt, qui peut refaire la multiplication.
 */
export function createGatewayGenerate(catalogue: Catalogue): GenerateFn {
  return async ({ model, promptText, images, task }) => {
    const started = Date.now();

    const result = await generateObject({
      model,
      schema: schemaForTask(task),
      messages: [{
        role: "user",
        content: [
          { type: "text", text: promptText },
          ...images.map((data) => ({ type: "file" as const, mediaType: "image", data })),
        ],
      }],
    });

    const inputTokens = result.usage.inputTokens;
    const outputTokens = result.usage.outputTokens;

    return {
      object: result.object,
      modelVersion: result.response.modelId ?? model,
      latencyMs: Date.now() - started,
      costUsd: computeCost(catalogue.get(model), inputTokens, outputTokens),
      ...(inputTokens === undefined ? {} : { inputTokens }),
      ...(outputTokens === undefined ? {} : { outputTokens }),
    };
  };
}
