import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Build output isn't source we author, so skip it. The Cloud Functions proxy
  // and the Cloudflare Worker proxy are separate codebases with their own
  // tsconfig/build (and runtime globals), so skip them here.
  { ignores: ["dist", "functions", "tutor-proxy"] },

  // Application + script source.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // Node-run tooling uses Node globals (process, etc.) rather than the browser.
  {
    files: ["vite.config.ts", "scripts/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
);
