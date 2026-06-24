---
name: removing-dead-code
description: >-
  Find and safely remove dead, unused, or unreachable code (unused files,
  exports, imports, variables, functions, types, and dependencies) in this
  React 19 + TypeScript + Vite + Vitest project, verifying every removal with
  lint, type-check/build, and tests. Use when the user asks to remove dead code,
  delete unused code, clean up, prune imports/exports, find unreferenced files,
  drop unused dependencies, or tree-shake the codebase.
---

# Removing Dead Code

Find and remove dead code in this project (`derivatives-learn`) without breaking
the build, the tests, or the env-driven runtime branches. The codebase already
fails the build on most in-file dead code, so the real work is (a) finding
cross-file dead code and (b) not deleting things that only *look* unused.

## Workflow

```
- [ ] 1. Establish a green baseline: npm run lint && npm run build && npm run test
- [ ] 2. Find dead code (built-in signals + knip)
- [ ] 3. Confirm each candidate is truly unused (check the Do-Not-Remove list)
- [ ] 4. Remove in small, related batches
- [ ] 5. Re-run the verification gate after every batch
- [ ] 6. Stop only when the gate is green and no candidates remain
```

## Step 1 — Baseline

Never start deleting against a red tree. Confirm everything passes first:

```bash
npm run lint && npm run build && npm run test
```

If the baseline is already failing, fix or report that before removing anything,
so failures can be attributed to your changes.

## Step 2 — Find dead code

### Built-in signals (already wired up)

- `npm run build` runs `tsc -b && vite build`. TypeScript is configured with
  `noUnusedLocals` and `noUnusedParameters` (see `tsconfig.app.json`), so unused
  locals, parameters, and imports in `src/` are **build errors**. Note
  `tsconfig.app.json` excludes `src/**/*.test.ts`, so test files are not covered
  here.
- `npm run lint` runs `eslint .` with `typescript-eslint` recommended
  (`@typescript-eslint/no-unused-vars`) and `react-hooks` across **all** `.ts`/
  `.tsx` files, including tests. Use this to catch what the build skips.
- `npm run test:coverage` reports V8 coverage scoped to `src/lib/**`. Use
  uncovered lines as a *hint* toward unreachable branches — never as proof (see
  the dual-mode warning below).

These catch in-file dead code but **not** unused files, unused exports, or
unused dependencies, because TypeScript only flags symbols unused *within* a
module. Use knip for the cross-file picture.

### Cross-file dead code with knip

Knip finds unused files, exports, types, and dependencies. It auto-detects this
stack's entry points from the Vite plugin (`index.html` → `src/main.tsx`,
`vite.config.ts`) and the Vitest plugin (`src/**/*.test.ts`). Run it without
installing anything:

```bash
npx -y knip
```

Useful focused runs:

```bash
npx -y knip --include files          # unused files only
npx -y knip --include exports,types  # unused exports and types only
npx -y knip --include dependencies   # unused / unlisted dependencies
```

If knip misreports entry points, drop this minimal `knip.json` at the repo root
**temporarily**, then delete it when finished (do not commit it unless the user
asks):

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.tsx", "scripts/validate-lessons.ts", "src/**/*.test.ts"],
  "project": ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
  "ignore": ["src/vite-env.d.ts", "src/react-katex.d.ts"]
}
```

## Step 3 — Do NOT remove these (project-specific false positives)

This codebase has several things that look unused but are load-bearing. Always
check a candidate against this list before deleting it.

- **The `mastered` status.** It is recognized by the unlock/completion logic in
  `src/lib/contentLoader.ts` for forward compatibility but is never written. This
  is an intentional placeholder — keep it.
- **Env-driven dual-mode branches.** `src/lib/progressService.ts` routes on
  `useLocalPersistence = isDevBypass || !isFirebaseConfigured`. In dev/demo
  (port 5173, localStorage) the Firestore branch never runs, and in production
  the localStorage branch never runs. Low coverage on either branch does **not**
  mean it is dead. The same applies to mode flags in `src/lib/firebase.ts` and
  the demo-only `src/components/dev/DevTools.tsx`.
- **Lesson content JSON.** Each lesson is wired by an explicit static import in
  `src/lib/contentLoader.ts` (e.g. `import lesson1 from ".../what-is-a-derivative.json"`).
  A JSON file under `content/` with no matching import there is
  genuinely orphaned, but confirm against both `contentLoader.ts` and
  `course.json` before deleting, and re-run `npm run validate:lessons`.
- **Ambient type declarations.** `src/vite-env.d.ts` and `src/react-katex.d.ts`
  have no importers and may be flagged — they are required for typing. Keep them.
- **Type-only exports.** `verbatimModuleSyntax` is enabled, so `import type` vs
  `import` matters. Domain types and tuning constants in `src/types/content.ts`
  (e.g. `MIN_STEPS`, `XP_PER_LESSON`, `PRACTICE_SESSION_SIZE`) are exported and
  consumed widely — verify with a search before assuming a type/constant is dead.
- **Knip "unused dependencies".** Cross-check against indirect usage:
  e.g. `katex` is pulled in via `react-katex` and a CSS import, `mathjs` is used
  in `src/lib/feedbackEngine.ts`, and Tailwind is a Vite plugin. Do not drop a
  dependency on knip's word alone.

Out of scope: unused Tailwind CSS classes (Tailwind 4 purges those at build).
This skill targets dead `.ts` / `.tsx` / `.js` and orphaned content/JSON.

## Step 4 — Remove safely

- Delete in small, logically-grouped batches (one file or one feature at a time),
  not one giant commit.
- Removing a symbol often makes its imports, helpers, or test cases dead too.
  Re-run the finder after a batch to surface the next layer.
- When deleting a module, also remove its co-located `*.test.ts` and any now-dead
  fixtures.
- Prefer deletion over commenting code out. Do not leave commented-out code
  behind — git history is the archive.

## Step 5 — Verification gate

After **every** removal batch, re-run the full gate and require all green:

```bash
npm run lint && npm run build && npm run test
```

If you touched lesson-loading or validation logic, also run:

```bash
npm run validate:lessons
```

If anything fails: the symbol was not dead, or its removal exposed a real
dependency. Revert that batch (or restore the specific reference) and reassess —
do not patch around the failure by deleting more.

## Step 6 — Finish

You are done when the verification gate is green, the finder reports no remaining
candidates (excluding the Do-Not-Remove items), and any temporary `knip.json` has
been removed. Summarize what was removed and why it was safe.
