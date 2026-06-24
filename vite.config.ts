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
