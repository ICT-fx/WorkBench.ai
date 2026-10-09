import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // L'alias du site : ses tests importent comme son code.
    alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) },
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    // Les tests lisent data/ par chemin relatif : la racine du dépôt est le cwd.
    root: import.meta.dirname,
    // Plusieurs tests rejouent la chaîne sur les fichiers du dépôt — près de cinq
    // mille réponses à relire. Une seconde ici, bien plus sur une machine occupée :
    // le délai par défaut de cinq secondes a déjà expiré sans qu'aucun test soit faux.
    testTimeout: 30_000,
  },
});
