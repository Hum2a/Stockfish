import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "stockfish",
    compatibilityDate: "2026-10-06",
    domains: ["stockfish.humza.website"],
    observability: {
      enabled: true,
    },
  },
});
