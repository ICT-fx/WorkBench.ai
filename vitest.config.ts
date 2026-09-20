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
  },
});
