# Calculus Lab — AI tutor proxy (Cloudflare Worker)

A tiny Cloudflare Worker that proxies the app's AI concept tutor to OpenAI.

**Why this exists:** OpenAI has no free tier and a browser-embedded key would be
extractable from the shipped bundle. Firebase Cloud Functions would hide the key
but require the **Blaze** billing plan. This Worker keeps the OpenAI key
server-side on Cloudflare's **free** plan, so the app can deploy publicly while
staying on Firebase's free **Spark** plan.

```
Browser (Firebase Hosting)  ──POST /  + Firebase ID token──▶  Worker  ──▶  OpenAI
                            ◀──────── streamed plain text ───────────────┘
```

The Worker:

- accepts a POST with the grounded step context the app builds,
- **verifies the caller's Firebase ID token** (only your signed-in users),
- locks **CORS** to your app's origins,
- optionally enforces **per-user rate limits** (Workers KV),
- builds the grounded prompt and **streams** OpenAI's reply back as plain text.

The deterministic grader in the app stays the only judge — this only explains.

## Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up).
- An OpenAI API key with a **monthly spend limit set** in the OpenAI dashboard
  (Settings → Limits). This is the hard backstop — set it even though the
  endpoint is authenticated.

## One-time setup

```bash
cd tutor-proxy
npm install
npx wrangler login          # opens the browser to authorize Wrangler
```

Confirm the values in `wrangler.toml`:

- `FIREBASE_PROJECT_ID` — your Firebase project (default `calculus-lab`).
- `ALLOWED_ORIGINS` — every origin that may call the proxy (your deployed site +
  local dev ports). Comma-separated, no trailing slash.

## Set the OpenAI key (server-side secret)

```bash
npx wrangler secret put OPENAI_API_KEY     # paste your key when prompted
```

The key is stored encrypted by Cloudflare and is never bundled into the app.

## Deploy

```bash
npx wrangler deploy
```

Wrangler prints the deployed URL, e.g.
`https://calculus-lab-tutor.<your-subdomain>.workers.dev`.

Put that URL in the **app's** `.env.local` (repo root), then rebuild + redeploy
hosting:

```bash
# repo root
echo "VITE_TUTOR_PROXY_URL=https://calculus-lab-tutor.<your-subdomain>.workers.dev" >> .env.local
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

The tutor button appears whenever `VITE_TUTOR_PROXY_URL` is set; without it the
app runs exactly as before (instant grading, no tutor).

## Optional: per-user rate limiting (Workers KV)

Without KV the tutor still works; your OpenAI spend cap is the safety net. To add
per-user daily + burst limits:

```bash
npx wrangler kv namespace create RATE_LIMIT
```

Paste the printed `id` into the `[[kv_namespaces]]` block in `wrangler.toml`
(uncomment it), then `npx wrangler deploy` again. Tune `TUTOR_DAILY_LIMIT` /
`TUTOR_BURST_LIMIT` in `wrangler.toml`.

## Local development

The app's `npm run dev` demo mode has no real Firebase user (so no ID token). To
exercise the tutor locally, run the Worker locally with auth disabled:

```bash
cp .dev.vars.example .dev.vars     # put your key in OPENAI_API_KEY
# in .dev.vars also set: ALLOW_UNAUTHENTICATED=true
npm run dev                        # Worker at http://localhost:8787
```

Then set `VITE_TUTOR_PROXY_URL=http://localhost:8787` in the app's `.env.local`.

> `ALLOW_UNAUTHENTICATED=true` bypasses token checks — use it **only** locally,
> never in a deployed Worker.

## How it stays safe

| Layer | What it stops |
|-------|---------------|
| OpenAI key as a Worker secret | Key never ships in the browser bundle |
| Firebase ID token verification | Anyone who isn't a signed-in app user |
| CORS allow-list | Other websites calling your proxy from a browser |
| KV per-user limits (optional) | A single user spamming requests |
| OpenAI dashboard spend cap | A hard ceiling on cost no matter what |
