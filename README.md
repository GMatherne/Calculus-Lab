# Derivatives — Learn by Doing

**Subject:** Derivatives (AP Calculus BC Unit 2)  
**Audience:** High school AP Calc BC students  
**Stack:** React + TypeScript + Vite + Tailwind + Firebase

An interactive Brilliant-style app for learning derivatives through hands-on graph manipulation, instant feedback, and a sequential lesson path.

## Live demo

Deploy with Firebase Hosting (see [Deploy](#deploy)). Without Firebase config, the app runs in **demo mode** with localStorage persistence.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: add Firebase + OpenAI keys
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run validate:lessons` | Validate lesson JSON (4–6 steps, slider required) |

## Architecture

```
content/derivatives/     # Lesson JSON (version-controlled)
src/
  components/
    lesson/              # LessonPlayer, FeedbackPanel
    widgets/               # GraphWidget (SVG), MathBlock (KaTeX), AnswerInput
    roadmap/               # Lesson list, unlock logic
    habit/                 # Streaks, milestones
  contexts/                # Auth + Firestore progress
  lib/
    feedbackEngine.ts      # Client-side answer check (<100ms)
    progressService.ts     # Firestore + localStorage fallback
    aiService.ts           # Optional Phase 2 hints (feature-flagged)
  pages/                   # Landing, lessons, lesson player
```

### Four layers (Phase 1 MVP)

1. **Content model** — JSON steps with typed interactions and hand-written feedback  
2. **Step renderer** — React components per step type; instant client-side grading  
3. **Progress** — Firestore (or localStorage demo); sequential unlock; `complete` status  
4. **Persistence** — Auth + cross-session progress and streaks  

> **Phase 2 (AI)** and **Phase 3 (learning science)** are not implemented yet — see [BRAINLIFT.md](./BRAINLIFT.md) for planned scope.

## Firebase setup

1. Create a Firebase project at https://console.firebase.google.com  
2. Enable **Authentication** (Email/Password + Google)  
3. Create **Firestore** database  
4. Copy web app config into `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

5. Deploy rules: `firebase deploy --only firestore:rules`

## Deploy

```bash
npm run build
firebase login
firebase init hosting   # public directory: dist, SPA rewrite: yes
firebase deploy
```

## Lessons (5)

1. What Is a Derivative?  
2. Slope of a Curve  
3. The Difference Quotient  
4. The Power Rule  
5. Derivatives and Graph Shape  

Each lesson: **4–6 steps**, at least one **slider + graph** interaction.

## Mobile

Mobile-first UI; portrait and landscape layouts; 44px touch targets; safe-area insets; graph resizes via `ResizeObserver`.

## Submission artifacts

- **Brainlift:** [BRAINLIFT.md](./BRAINLIFT.md)  
- **Demo script:** [DEMO.md](./DEMO.md)  
