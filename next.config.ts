import type { NextConfig } from "next";

// App interamente autenticata: ogni pagina dipende dall'utente, quindi
// lavoriamo in rendering dinamico (niente Cache Components per ora).
const nextConfig: NextConfig = {
  experimental: {
    // Cache di navigazione nel browser: le pagine del menu, precaricate per intero,
    // si aprono all'istante per 2 minuti; rivisitare una pagina appena vista è immediato.
    // Ogni modifica (Server Action con revalidatePath) svuota comunque la cache.
    staleTimes: { dynamic: 30, static: 120 },
  },
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
