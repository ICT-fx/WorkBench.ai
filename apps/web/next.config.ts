import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Les paquets de l'atelier sont publiés en TypeScript source.
  transpilePackages: ["@hub/schema"],
  // fileURLToPath et non URL.pathname : le chemin du dépôt peut contenir un
  // espace, que pathname renverrait encodé en %20.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  redirects() {
    return [
      // Le français est la langue par défaut ; les anciennes adresses du site
      // monolingue continuent de mener quelque part.
      { source: "/", destination: "/fr", permanent: false },
      { source: "/taches/:id", destination: "/fr/benchmarks/:id", permanent: true },
      { source: "/methodologie", destination: "/fr/about/methodology", permanent: true },
    ];
  },
};

export default config;
