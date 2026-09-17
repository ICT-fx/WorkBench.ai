import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Les paquets de l'atelier sont publiés en TypeScript source.
  transpilePackages: ["@hub/schema"],
  // fileURLToPath et non URL.pathname : le chemin du dépôt peut contenir un
  // espace, que pathname renverrait encodé en %20.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
};

export default config;
