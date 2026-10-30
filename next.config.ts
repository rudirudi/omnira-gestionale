import type { NextConfig } from "next";

// App interamente autenticata: ogni pagina dipende dall'utente, quindi
// lavoriamo in rendering dinamico (niente Cache Components per ora).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
