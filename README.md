# Calculus Lab — Learn by Doing

**Live:** https://calculus-lab.web.app
**Subject:** AP Calculus BC — derivatives **and** integrals
**Audience:** High-school AP Calculus BC students
**Stack:** React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · Firebase 11 · KaTeX · math.js

A Brilliant-style, **learn-by-doing** web app for the foundations of calculus. Instead of
watching videos, you work through short interactive steps — drag a slider on a live graph,
tap a point on a curve, build a derivative term-by-term, drag tiles to assemble an answer —
and get **instant, hand-written feedback** on every attempt. All grading happens in the
browser; there is no custom backend.

> For a full tour of how everything works internally, see **[OVERVIEW.md](./OVERVIEW.md)**.

## Quick start

```bash
npm install

# Optional: real auth + cross-device persistence.
# Without it, the app runs in demo mode (localStorage, auto-login).
cp .env.sample .env.local   # then fill in your Firebase web config

npm run dev                 # http://localhost:5173  (demo user, no login)
```

## Run modes

| Mode | When | Auth | Storage |
|------|------|------|---------|
| **Demo / dev** | `npm run dev` (port **5173**) | Auto "Demo Student", no login | `localStorage` |
| **Production** | `npm run build` / `preview` (port **5174**) / deployed | Real Firebase login | Firestore |

If the Firebase env vars are missing (or `VITE_FIREBASE_API_KEY=demo`), the app also falls
back to demo mode, so it runs with zero configuration.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on **5173** (demo user, no login) |
| `npm run build` | Type-check (`tsc -b`) + production bundle to `dist/` |
| `npm run preview` | Preview the production build on **5174** (real login) |
| `npm run lint` | ESLint |
| `npm run test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Watch-mode tests |
| `npm run test:coverage` | Tests with V8 coverage (`src/lib/**`) |
| `npm run validate:lessons` | Validate every lesson JSON (6–10 steps, ≥1 slider graph, etc.) |
| `npm run kill-ports` | Stop stray Vite servers (protects port **5173** unless overridden) |

## Question types

Eleven step types fit the concept being taught:

| Type | Learner action | Graded |
|------|----------------|:------:|
| `read` | Tap **Continue** | No |
| `multiple_choice` | Pick one option (≥ 4 choices) | Yes |
| `multi_choice` | Answer several classification rows at once (e.g. max/min/neither) | Yes |
| `numeric` | Type a number (tolerance-based) | Yes |
| `slider_graph` | Move a slider on a live SVG graph | Yes |
| `power_term` | Build a term `a·xⁿ` with steppers (power rule / reverse power rule) | Yes |
| `drag_drop` | Drag tiles into ordered blanks to assemble an expression | Yes |
| `match` | Pair each prompt with its match (e.g. function ↔ antiderivative) | Yes |
| `sign_chart` | Label each interval of a number line (e.g. increasing vs. decreasing) | Yes |
| `order_list` | Drag shuffled items into their correct order | Yes |
| `riemann` | Drag a slider to pile up rectangles until a Riemann sum converges | Yes |

Graph-backed steps can also carry a **slider** answer (drag to a target) or a **graph_point**
answer (tap the correct point on the curve).

## The course

**Introduction to Calculus** — 10 lessons across 5 sequential levels (each lesson unlocks the
next):

1. **What Is a Derivative?** — What Is a Derivative? · Slope of a Curve (introduces the limit definition)
2. **Finding Derivatives** — The Power Rule · Differentiating Polynomials
3. **Using Derivatives** — Derivatives and Graph Shape · Finding Maxima and Minima
4. **What Is an Integral?** — What Is an Integral? · Area Under a Curve
5. **The Big Picture** — The Fundamental Theorem of Calculus · Integrating Polynomials

Each lesson is ~6–8 minutes, has 6–10 steps, and includes at least one slider-graph
interaction. Finished lessons unlock **Practice** and **Review**; completed levels unlock a
**Level review**.

## Architecture

A layered, server-free design — version-controlled JSON content, browser logic, React state,
and Firebase only for identity + per-user storage.

```text
content/                 # course.json + 10 lesson JSON files (the entire course)
scripts/                 # validate-lessons.ts (CLI lesson validator) + kill-ports.mjs
src/
  lib/                   # contentLoader · feedbackEngine · progressService · masteryService ·
                         #   reviewPlanner · validateLesson · inlineMarkup · aiTutor · firebase  (+ *.test.ts)
  hooks/                 # useSessionExitGuard · useCountUp
  contexts/              # AuthContext/AuthProvider · ProgressContext/ProgressProvider
  components/
    auth/ common/ layout/ lesson/ widgets/ roadmap/ habit/ profile/ dev/
  pages/                 # Landing, Login, Signup, Roadmap, Lesson, Practice, CustomPractice,
                         #   Review, LevelReview, Profile, Settings
  types/content.ts       # domain types + tuning constants
firebase.json            # Hosting (SPA rewrite) + Firestore + Auth config
firestore.rules          # per-user access rules
vite.config.ts           # Vite + Tailwind + Vitest
```

Key features: instant client-side grading (math.js), interactive SVG graphs (secant/tangent,
area shading), sequential unlock, per-lesson practice, **targeted mixed review** + **custom
practice** + level review, XP, streaks, **achievements**, **per-concept mastery** with a
profile dashboard (stats, activity heatmap, weak areas), and account management. All
**grading is deterministic and AI-free** — every problem,
hint, and answer key is hand-authored and checked in the browser. An **optional AI concept
tutor** (Firebase AI Logic + Gemini) can layer on top to _explain_ a graded step; it never
grades, and the app runs unchanged when it is disabled (see **AI concept tutor** below).

## Firebase setup

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication** → Email/Password and Google sign-in
3. Create a **Firestore** database (production mode)
4. Copy the web app config into `.env.local`:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
# Optional — only needed for the AI concept tutor (see below):
VITE_FIREBASE_APPCHECK_SITE_KEY=...
```

## AI concept tutor (optional)

After a step is graded, learners can optionally ask an AI tutor to _explain_ why their answer
was right or wrong and walk through the concept. The deterministic engine stays the only judge:
the model is handed the verdict and the correct answer and is asked only to explain. When the
service below isn't provisioned (including the zero-config demo and offline use), the tutor
simply stays hidden and nothing else changes.

To enable it:

1. Provision **Firebase AI Logic** (enables the Gemini Developer API on your project):

```bash
npx -y firebase-tools@latest init ailogic
```

2. Set up **App Check** with **reCAPTCHA Enterprise** in the Firebase Console (it protects the
   Gemini quota from abuse), then add the site key to `.env.local` as
   `VITE_FIREBASE_APPCHECK_SITE_KEY`. In dev, a debug token is registered automatically.
3. Run with a real Firebase config — the tutor needs an initialized Firebase app, so it is
   automatically unavailable in the zero-config demo.

The Gemini model id is a single constant (`TUTOR_MODEL` in `src/lib/aiTutor.ts`), and follow-up
questions are capped per step (`MAX_FOLLOWUPS`).

## Deploy

This project deploys to **Firebase Hosting** (project `calculus-lab`, see `.firebaserc`) as a
static SPA, with Firestore rules deployed alongside.

```bash
npm run build
npx -y firebase-tools@latest deploy                      # hosting + firestore rules
# or scope it:
npx -y firebase-tools@latest deploy --only hosting
npx -y firebase-tools@latest deploy --only firestore:rules
```

Live at **https://calculus-lab.web.app**. Auth providers (Email/Password, Google) are enabled
in the Firebase Console; the deployed domains are authorized there by default.

## Testing

Unit tests (Vitest) live next to the code they cover under `src/lib/`, with coverage scoped to
`src/lib/**`:

| Test file | Covers |
|-----------|--------|
| `feedbackEngine.test.ts` | Answer grading + function/slope math |
| `progressService.test.ts` | Streaks, milestones, activity, step progression, persistence |
| `contentLoader.test.ts` | Loading, levels, sessions, unlock/completion logic |
| `masteryService.test.ts` | Concept catalog + mastery/weak-area scoring |
| `reviewPlanner.test.ts` | Targeted-review weakness/recency ranking + session draws |
| `validateLesson.test.ts` | Lesson-schema validation rules |
| `inlineMarkup.test.ts` | Math-delimiter normalization + inline tokenization |
| `aiTutor.test.ts` | Tutor context building + answer formatting + error classification |

```bash
npm run test            # run all
npm run test:coverage   # with coverage report (also written to /coverage)
```

## Mobile

Mobile-first UI: portrait and landscape layouts, 44px+ touch targets, safe-area insets, and
graphs that resize via `ResizeObserver`.
