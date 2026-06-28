# Security

This document records the findings of a security review of the Calculus Lab
codebase (React/Vite front end, Firebase Hosting + Firestore + Auth, a Firebase
Cloud Functions tutor proxy, and a Cloudflare Worker tutor proxy), along with
what was fixed and what remains a documented, accepted risk.

Last reviewed: 2026-06-27.

## Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `mathjs` prototype pollution / unsafe property setter | High | Fixed |
| 2 | Missing HTTP security headers (CSP, clickjacking, MIME, referrer) | Medium | Fixed |
| 3 | Vulnerable Worker dev tooling (`esbuild`, `undici`, `ws` via `wrangler`) | Medium | Fixed |
| 4 | Untrusted LaTeX rendered by KaTeX without pinned `trust` | Low (defense‑in‑depth) | Fixed |
| 5 | Transitive `uuid`/`gaxios` advisory in `firebase-admin` (functions) | Low | Documented |
| 6 | Firestore lets a user write arbitrary/unbounded fields to their own doc | Low | Documented |
| 7 | Tutor proxy `ALLOW_UNAUTHENTICATED` + no‑Origin request handling | Low / Info | Documented |
| 8 | Public Firebase web API key & optional App Check | Info | Documented |

---

## Fixed

### 1. `mathjs` prototype pollution / unsafe object property setter (High)

- **Advisories:** [GHSA-29qv-4j9f-fjw5](https://github.com/advisories/GHSA-29qv-4j9f-fjw5),
  [GHSA-jvff-x2qm-6286](https://github.com/advisories/GHSA-jvff-x2qm-6286)
- **Where:** `package.json` depended on `mathjs@^14.4.0`. `mathjs` is bundled
  into the browser app and used by `src/lib/feedbackEngine.ts`
  (`evalFunction`, `evalAt`, `riemannSum`, …) to compile and evaluate math
  expressions for grading and graphing.
- **Risk:** Affected `mathjs` versions allow improperly controlled modification
  of dynamically-determined object attributes (prototype pollution), which can
  escalate to code execution when attacker-controlled strings reach
  `math.evaluate` / `math.compile`. In this app the compiled expressions come
  from **authored lesson JSON** (bundled at build time), not direct user input,
  so it is not trivially reachable today — but it is a high-severity flaw in a
  client-bundled dependency and warrants prompt patching (defense in depth, and
  protection against any future code path that evaluates less-trusted input).
- **Fix:** Upgraded to `mathjs@^15.2.0` (the patched line). All 237 unit tests
  (including `feedbackEngine.test.ts`, which exercises `evalFunction`) pass on
  the new version, and `npm audit` for the root project now reports
  **0 vulnerabilities**.

### 2. Missing HTTP security headers (Medium)

- **Where:** `firebase.json` (`hosting`) served no security response headers.
- **Risk:**
  - No `X-Frame-Options` / CSP `frame-ancestors` → the app could be framed by a
    malicious site (**clickjacking**).
  - No `Content-Security-Policy` → no defense-in-depth against XSS/data
    exfiltration. The app renders untrusted **AI tutor output** and authored
    content; while it does so safely via React + KaTeX (see #4), a CSP neuters
    any injection that might slip through a future change.
  - No `X-Content-Type-Options: nosniff`, `Referrer-Policy`, or
    `Permissions-Policy`.
- **Fix:** Added a `headers` block to `firebase.json` for all routes:
  - `Content-Security-Policy` with `default-src 'self'`, `frame-ancestors
    'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and
    explicit allow-lists for the Google/Firebase/Cloudflare origins the app
    actually needs (`script-src`, `connect-src`, `frame-src`).
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `Permissions-Policy` (disables geolocation/mic/camera/payment/usb), and
    `Strict-Transport-Security` (HSTS, 1 year + preload).
- **Validate after deploy:** Firebase Hosting headers only apply to the deployed
  site (not `vite dev`/`preview`). After `firebase deploy`, exercise these flows
  and watch the browser console for CSP violations, adjusting the allow-lists if
  needed:
  - Email/password **and** Google sign-in (`signInWithPopup`),
  - reCAPTCHA Enterprise / App Check (if a site key is configured),
  - Firestore reads/writes,
  - the AI tutor call to the Cloudflare Worker (`*.workers.dev`).

### 3. Vulnerable Cloudflare Worker dev tooling (Medium)

- **Advisories (via `wrangler`/`miniflare`):**
  [esbuild GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99),
  multiple `undici` advisories, `ws` GHSA-58qx-3vcg-4xpx / GHSA-96hv-2xvq-fx4p.
- **Where:** `tutor-proxy` depended on `wrangler@^3.90.0`, whose bundled
  `esbuild`, `undici`, and `ws` were flagged. These are **dev/deploy-time only**
  (the local dev server and bundler) and are **not shipped in the deployed
  Worker runtime**, so the production blast radius is limited (mainly: a
  malicious website could talk to a developer's local `wrangler dev` server).
- **Fix:** Upgraded `tutor-proxy` to `wrangler@^4.105.0`; `npm audit` for
  `tutor-proxy` now reports **0 vulnerabilities**. `tsc --noEmit` still passes.
- **Heads-up:** `wrangler@4` requires **Node.js >= 22**. The repo currently runs
  on Node 20, so `wrangler dev`/`deploy` will emit an `EBADENGINE` warning and
  may misbehave until you upgrade Node to 22+. If staying on Node 20 is
  required, you can instead pin the newest `wrangler@3.x` and accept the
  remaining dev-only advisories — but upgrading Node is recommended.

### 4. Untrusted LaTeX rendered by KaTeX (Low — defense in depth)

- **Where:** `src/components/widgets/MathBlock.tsx` renders math via
  `react-katex` for both authored content and **AI tutor output**.
- **Risk:** KaTeX can emit arbitrary URLs/markup (`\href`, `\url`,
  `\includegraphics`, …) **only when its `trust` option is enabled**. `trust`
  defaults to `false` (safe), but relying on a library default for an XSS-
  relevant setting is fragile.
- **Fix:** Pinned `settings={{ trust: false }}` on every `InlineMath`/
  `BlockMath` render and documented why. Also extended the local
  `src/react-katex.d.ts` typing to expose the `settings` prop. This is
  behavior-preserving (it matches the existing default) but makes the security
  property explicit and robust against future default changes.

---

## Documented / accepted risks

### 5. Transitive `uuid`/`gaxios` advisory in `firebase-admin` (Low)

- **Advisory:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
  (`uuid` < 11.1.1, missing buffer bounds check in v3/v5/v6 when an explicit
  `buf` is provided), pulled in transitively through
  `firebase-functions → firebase-admin → @google-cloud/firestore → google-gax → uuid`.
- **Why not auto-fixed:** `npm audit fix --force` "resolves" this by
  **downgrading `firebase-admin` to 10.x**, which is a destructive, breaking
  change worse than the issue. The vulnerable code path (passing a caller-
  supplied buffer to `uuid`) is not used by `firebase-admin` here, so the
  practical risk is negligible.
- **Recommendation:** Leave `firebase-admin@^13` / `firebase-functions@^7` as-is
  and re-run `npm audit` in `functions/` periodically; upgrade once a
  non-breaking upstream release ships a patched `uuid`. Do **not** run
  `npm audit fix --force` here.

### 6. Firestore allows arbitrary writes to a user's own document (Low)

- **Where:** `firestore.rules`:

  ```
  match /users/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
    match /progress/{lessonId} { allow read, write: if request.auth != null && request.auth.uid == userId; }
  }
  ```

- **Risk:** The access control is correct (a user can only touch their own
  documents, and `aiUsage/*` and `config/*` are denied to all clients). However,
  there is **no field/shape/size validation**, so an authenticated user can
  write arbitrary fields or large blobs to their own `users/{uid}` document —
  i.e. self-tamper gamification stats (XP, streak, milestones) or abuse storage.
  Because the app is already client-authoritative for progress, this is low
  impact, but worth tightening if these stats ever gain real value.
- **Recommendation (optional):** Add validation in the rules (constrain allowed
  keys, value types, and string/map sizes), or move authoritative stat updates
  behind a Cloud Function. Not implemented here to avoid breaking the evolving
  profile/progress schema; track as hardening.

### 7. Tutor proxy `ALLOW_UNAUTHENTICATED` and no-Origin requests (Low / Info)

- **Where:** `tutor-proxy/src/index.ts`, `tutor-proxy/wrangler.toml`.
- **Notes:**
  - CORS rejects browser callers whose `Origin` is not on the allow-list, but a
    request with **no `Origin` header** (e.g. `curl`, server-to-server) is
    allowed through. This is by design — CORS is browser-enforced and trivially
    spoofed by non-browsers, so the **real gate is the verified Firebase ID
    token** (`verifyFirebaseToken`), which is correctly required.
  - `ALLOW_UNAUTHENTICATED=true` disables that token check entirely (intended
    only for local `wrangler dev` against demo mode). If ever deployed, anyone
    could spend your OpenAI quota.
- **Recommendation:** Keep `ALLOW_UNAUTHENTICATED="false"` in every deployed
  environment (it already defaults to `false` with a warning), keep an OpenAI
  dashboard spend cap as the hard backstop, and enable the optional KV-based
  per-user rate limiting (`[[kv_namespaces]] RATE_LIMIT`) for production.

### 8. Public Firebase web API key & optional App Check (Info)

- **Where:** `.env.local` (`VITE_FIREBASE_API_KEY`, gitignored) is embedded in
  the client bundle.
- **Notes:** This is **expected** for Firebase web apps — the "API key" is a
  project identifier, not a secret. Access is gated by Firebase Auth and the
  Firestore security rules. App Check (reCAPTCHA Enterprise) is wired up in
  `src/lib/firebase.ts` but optional (skipped when no site key is set).
- **Recommendation:** For stronger guarantees against abuse of Auth/Firestore
  from outside the app, configure an App Check site key and **enforce** App Check
  in the Firebase console.

---

## Notes on what was reviewed and looks good

The following were checked and found to follow good practice — no change needed:

- **OpenAI API key is never in the client bundle.** It lives only as a Cloud
  Secret Manager secret (`functions/src/tutor.ts`) and a Worker secret
  (`tutor-proxy`), and there is deliberately no `VITE_OPENAI_*` variable.
- **No secrets are committed.** `git ls-files` shows only `.env.sample`
  (placeholders) and `wrangler.toml` (non-secret config); real `.env.local`
  files are gitignored and untracked.
- **The dev auth bypass cannot reach production.** `isDevBypass` is gated on
  `import.meta.env.DEV`, which is false in `vite build`. `DevTools` renders only
  under that bypass.
- **No dangerous DOM sinks.** No `dangerouslySetInnerHTML`, `eval`,
  `new Function`, or `document.write`; React escapes all rendered tutor/user
  text, and KaTeX runs with `trust: false` (see #4).
- **Tutor input is validated and clamped server-side** (`validateRequest` in
  both `functions/src/tutor.ts` and `tutor-proxy/src/prompt.ts`): string length
  caps, numeric coercion, follow-up limits — so a tampered client can't inflate
  prompt size/cost.
- **The Firebase ID token is verified properly at the edge**
  (`tutor-proxy/src/auth.ts`): RS256 signature against Google's JWKS, plus
  `aud`/`iss`/`exp`/`iat` checks.
- **Per-user rate limiting** exists for the tutor (Firestore-backed in
  `functions`, KV-backed in the Worker), with counters in server-only documents
  clients cannot read or reset.
- **Error responses don't leak internals** — upstream/OpenAI errors are logged
  server-side and mapped to generic client messages.

## Running the audits yourself

```bash
# Front-end app (root)
npm audit

# Firebase Cloud Functions
cd functions && npm audit

# Cloudflare Worker tutor proxy
cd tutor-proxy && npm audit
```
