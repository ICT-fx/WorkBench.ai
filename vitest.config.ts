import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    // Les tests lisent data/ par chemin relatif : la racine du dépôt est le cwd.
    root: import.meta.dirname,
  },
});
