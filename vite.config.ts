/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev server (no login, demo user) is fixed to 5173.
  server: { port: 5173, strictPort: true },
  // Production preview (real login required) is fixed to 5174.
  preview: { port: 5174, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Split the big, independently-cacheable vendors into their own chunks
        // so a content change doesn't bust them and they can load in parallel.
        // Route-level code-splitting (React.lazy in App.tsx) already keeps the
        // math.js/KaTeX-heavy lesson pages out of the initial download.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("mathjs")) return "mathjs";
          if (id.includes("katex")) return "katex";
          if (id.includes("firebase") || id.includes("@firebase")) {
            return "firebase";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    // Unit tests live next to the code they cover, as src/**/*.test.ts files.
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "html"],
    },
  },
});
