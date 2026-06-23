import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev server (no login, demo user) is fixed to 5173.
  server: { port: 5173, strictPort: true },
  // Production preview (real login required) is fixed to 5174.
  preview: { port: 5174, strictPort: true },
});
