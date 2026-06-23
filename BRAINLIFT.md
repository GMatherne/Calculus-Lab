# Brain Lift — How Brilliant-Style Learning Works

> A structured knowledge map for this project (`derivatives-learn`).  
> **DOK 4 is yours alone** — sections are left blank for your own connections, questions, and extensions.

---

## How to use this document

| Level | What belongs here | Your job |
|-------|-------------------|----------|
| **DOK 1 — Facts** | Names, definitions, file paths, data shapes | Memorize / reference |
| **DOK 2 — Summary** | How pieces connect; flows in plain language | Explain it back |
| **DOK 3 — Insights** | Why it works this way; tradeoffs; patterns | Argue, compare, design |
| **DOK 4 — Yours** | Personal synthesis, open questions, next experiments | Fill in yourself |

---

## Outline — sections to grow over time

Use this as a checklist. Star (★) marks areas already started below.

### A. Product & pedagogy (what “Brilliant-style” means)
- [ ] Learn-by-doing vs lecture-first
- [ ] Step granularity (bite-sized interactions)
- [ ] Instant feedback loop
- [ ] Sequential unlock / guided path
- [ ] Habit mechanics (streaks, milestones)
- [ ] Planned: mastery, spaced repetition, AI hints (Phase 2–3)

### B. Front end ★
- [ ] Tech stack (React, Vite, Tailwind, Router)
- [ ] Page map & routing
- [ ] Component layers (pages → feature components → widgets)
- [ ] State: Context vs local state
- [ ] Lesson player & step types
- [ ] Graph widget & math rendering
- [ ] Mobile / responsive patterns

### C. Back end & persistence ★
- [ ] No custom API — Firebase as BaaS
- [ ] Auth (email, Google, demo mode)
- [ ] Firestore schema
- [ ] Security rules
- [ ] Dual-path: Firestore vs localStorage
- [ ] Hosting & deploy

### D. Content system ★
- [ ] Course → lesson → step hierarchy
- [ ] JSON schema & step types
- [ ] Validation (build-time + CLI)
- [ ] Feedback copy & answer specs
- [ ] Concept tags (future spaced repetition)

### E. Core runtime flows ★
- [ ] App boot → auth → progress hydration
- [ ] Answer → grade → feedback → save
- [ ] Lesson complete → unlock next → milestones
- [ ] Resume mid-lesson

### F. What’s not built yet
- [ ] `aiService.ts` (Phase 2 hints)
- [ ] `mastered` status & review page (Phase 3)
- [ ] `MilestoneToast` (built, not wired)
- [ ] Automated tests

---

# DOK 1 — Facts

*Things you can look up or state without interpretation.*

## Product vocabulary

| Term | In this app | Notes |
|------|-------------|-------|
| Course | `derivatives` | One subject area; defined in `content/derivatives/course.json` |
| Lesson | 5 JSON files | 4–6 steps each, ~6–8 minutes |
| Step | Smallest interactive unit | Types: `read`, `multiple_choice`, `numeric`, `slider_graph` |
| Exercise | Not a separate entity | Interactive steps *are* the exercises |
| Roadmap | `/lessons` page | Shows lesson cards, unlock state, streak |
| Progress | Per-lesson document | Status, step index, attempts, answers |
| Milestone | Badge on profile | `first_lesson`, `three_lessons`, `five_day_streak`, `course_complete` |
| Streak | Consecutive active days | Stored on `UserProfile.streak` |

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript 5.8 |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| Routing | react-router-dom 7 |
| Math display | KaTeX (`react-katex`) |
| Math evaluation | mathjs |
| Auth & database | Firebase 11 (Auth + Firestore) |
| Hosting | Firebase Hosting (SPA rewrite) |

## Routes

| Path | Page file |
|------|-----------|
| `/` | `src/pages/LandingPage.tsx` |
| `/login` | `src/pages/LoginPage.tsx` |
| `/signup` | `src/pages/SignupPage.tsx` |
| `/lessons` | `src/pages/RoadmapPage.tsx` |
| `/lesson/:lessonId` | `src/pages/LessonPage.tsx` |
| `/lesson/:lessonId/complete` | `src/pages/LessonCompletePage.tsx` |

## Provider nesting (outer → inner)

```
AuthProvider → ProgressProvider → BrowserRouter → Routes
```

## Key directories

```
content/derivatives/          # Lesson JSON + course manifest
src/components/lesson/        # LessonPlayer, FeedbackPanel
src/components/widgets/       # GraphWidget, MathBlock, AnswerInput
src/components/roadmap/       # LessonCard
src/components/habit/         # StreakBadge
src/contexts/                 # AuthContext, ProgressContext
src/lib/                      # firebase, contentLoader, feedbackEngine, progressService
src/types/content.ts          # Domain TypeScript types
```

## Step types

| Type | User action | Graded? |
|------|-------------|---------|
| `read` | Tap Continue | No |
| `multiple_choice` | Pick an option | Yes |
| `numeric` | Enter a number | Yes (tolerance default 0.01) |
| `slider_graph` | Move slider on SVG graph | Yes (often numeric answer tied to graph) |

## Lesson progress shape (`LessonProgress`)

```typescript
{
  status: "not_started" | "in_progress" | "complete",
  currentStepIndex: number,
  stepAttempts: Record<string, number>,
  stepAnswers: Record<string, unknown>,
  completedAt: string | null,
  updatedAt: string
}
```

## Firestore paths

```
users/{userId}                         → UserProfile
users/{userId}/progress/{lessonId}     → LessonProgress
```

## Five lessons (in order)

1. `what-is-a-derivative`
2. `slope-of-a-curve`
3. `difference-quotient`
4. `power-rule`
5. `graph-shape`

## Environment variables (Firebase)

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

## Demo mode trigger

If Firebase env vars are missing or `VITE_FIREBASE_API_KEY === "demo"`, the app uses localStorage instead of Firestore and auto-logs in a synthetic user.

## NPM scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (port 5173) |
| `npm run build` | Typecheck + production bundle |
| `npm run validate:lessons` | CLI validation of all lesson JSON |

---

# DOK 2 — Summary

*Explain how things work — connections and flows.*

## What this app is

A single-page React app that teaches AP Calculus derivatives through short, interactive lessons. There is **no custom backend server**. The browser handles rendering, answer checking, and most logic; Firebase (or localStorage in demo mode) stores user identity and progress.

## The four layers (Phase 1)

1. **Content model** — Lessons are JSON files describing steps, interactions, and hand-written feedback strings.
2. **Step renderer** — React components render each step type; `feedbackEngine.ts` grades answers in the browser.
3. **Progress layer** — `ProgressContext` tracks per-lesson state; `progressService.ts` syncs to Firestore or localStorage.
4. **Persistence** — Firebase Auth identifies the user; Firestore (or localStorage) survives across sessions.

## Front-end architecture (summary)

**Pages** are thin route shells: they load data, wire contexts, and navigate.

**Feature components** own behavior:
- `LessonPlayer` — step index, answer state, submit handler, auto-advance on correct answer
- `GraphWidget` — SVG plot of a mathjs function + slider; resizes via `ResizeObserver`
- `LessonCard` — shows lock/unlock and completion on the roadmap

**State split:**
- **Global** (Context): who is logged in, profile, all lesson progress
- **Local** (useState in LessonPlayer): current answer, feedback message, submitted flag

Lesson content never comes from an API call — it is **imported at build time** in `contentLoader.ts` and bundled into the JS.

## Back-end architecture (summary)

“Back end” here means **Firebase as a service**, not code you run on a server:

| Concern | Where it lives |
|---------|----------------|
| Sign up / log in | Firebase Auth (`AuthContext`) |
| User profile & streaks | Firestore `users/{uid}` |
| Lesson progress | Firestore `users/{uid}/progress/{lessonId}` |
| Access control | `firestore.rules` — users can only touch their own docs |
| Static app hosting | Firebase Hosting serves `dist/` with SPA fallback |

`progressService.ts` is the **single abstraction** over Firestore and localStorage so the rest of the app does not care which mode is active.

## Content → UI pipeline

```
content/derivatives/*.json
  → imported by contentLoader.ts
  → assertValidLesson() at import time
  → getLesson(id) / getPublishedLessons()
  → LessonPage passes Lesson into LessonPlayer
  → LessonPlayer renders step by step.type
```

## Answer → feedback → save flow

```
User taps "Check Answer"
  → feedbackEngine.checkAnswer(step, answer)     [sync, <100ms]
  → FeedbackPanel shows correct/incorrect (+ hint if enough wrong attempts)
  → ProgressContext.updateStepProgress()         [updates React state immediately]
  → progressService.saveLessonProgress()         [async write, not awaited for UI]
  → if last step correct → completeLesson() → navigate to /lesson/:id/complete
```

Hints appear after N wrong attempts (`hintAfterAttempts` on the step, default 2; lesson 1 uses 1).

## Unlock logic (summary)

Lessons are **sequential**. Lesson N is locked until lesson N−1 has status `complete` (or `mastered`, which is planned but not yet set anywhere). `isLessonUnlocked()` in `contentLoader.ts` enforces this on the roadmap.

## App startup flow

```
main.tsx mounts App
  → AuthProvider: Firebase onAuthStateChanged OR demo auto-login
  → ProgressProvider.refresh(): load profile + all lesson progress
  → Router renders current page with hydrated state
```

## Resume mid-lesson

`LessonPage` reads `progress[lessonId].currentStepIndex` and passes it as `initialStepIndex` to `LessonPlayer`, so a refresh returns the user to the same step.

## Brilliant.org vs this clone (summary)

| Brilliant.org (general product) | This clone (Phase 1) |
|--------------------------------|----------------------|
| Many courses & subjects | One course: derivatives |
| Large content library | 5 hand-authored JSON lessons |
| Proprietary interactive engine | Custom React widgets + mathjs |
| Full account & subscription platform | Firebase Auth + Firestore |
| Spaced repetition, paths, community | Streaks + milestones only; review page planned |

---

# DOK 3 — Insights

*Why things are shaped this way — patterns, tradeoffs, and design reasoning.*

## Why client-side grading?

Brilliant’s feel depends on **instant** feedback. Sending every answer to a server adds latency and complexity. Here, `feedbackEngine.ts` runs synchronously in the browser; only *progress* is persisted asynchronously. Tradeoff: answer keys live in the bundled JSON (fine for an educational MVP, not for high-stakes assessment).

## Why JSON content instead of a CMS?

Lessons are version-controlled files, validated at build time and via `npm run validate:lessons`. This keeps Phase 1 simple: no admin panel, no content API. Tradeoff: publishing a new lesson requires a code deploy, not a button click.

## Why Firebase instead of a custom API?

For an MVP with auth + per-user documents, Firebase removes an entire server tier. Security rules replace middleware. Tradeoff: complex queries, server-side logic, and content delivery at scale will eventually push toward a real backend or Cloud Functions.

## Why dual-mode (Firestore / localStorage)?

Developers and demos should work **without** Firebase credentials. `isFirebaseConfigured` in `firebase.ts` switches the persistence layer once; contexts and components stay unaware. Insight: always isolate “where data lives” behind a service module.

## Why Context instead of Redux or React Query?

State surface area is small: one user, one progress map, one profile. Context + optimistic updates are enough. If you add AI streaming, offline sync, or a content catalog API, reconsider.

## The graph widget is the pedagogical centerpiece

Most lessons require at least one `slider_graph` step. Moving a slider to see secant → tangent slope *is* the Brilliant-style “discovery” moment. The constraint (4–6 steps, ≥1 slider) forces every lesson to include manipulation, not just reading.

## Sequential unlock is a scaffolding choice

Linear unlock prevents students from skipping to the power rule before understanding the difference quotient. Tradeoff: no self-directed exploration within the course; advanced students cannot jump ahead without completing prior lessons.

## Optimistic UI on progress

`ProgressContext` updates React state before Firestore confirms. The UI feels snappy; rare write failures could desync (acceptable for Phase 1).

## Phase boundaries are intentional

| Phase | Focus | Rationale |
|-------|-------|-----------|
| 1 (shipped) | Content + instant feedback + progress | Prove the learning loop |
| 2 (planned) | AI hints on stuck steps | Add intelligence without replacing authored feedback |
| 3 (planned) | Mastery, recall steps, spaced repetition | Learning science layer on top of stable content |

Shipping Phase 1 completely before AI avoids building hints on a shaky player.

## Gaps worth noticing

- `MilestoneToast` exists but is not wired — milestones update in data but may not surface in UI.
- `mastered` appears in unlock checks but is never written — Phase 3 placeholder.
- `aiService.ts` is referenced in README but the file does not exist yet.
- No automated tests — regression risk grows as content and widgets expand.

## Content authoring insight

The hardest part of a Brilliant clone is not React — it is **well-designed steps**: clear prompts, wrong-answer feedback that diagnoses mistakes, and graph interactions that teach rather than decorate. The JSON schema encodes structure; pedagogy still lives in the prose.

---

# DOK 4 — Yours

*Do not skip this. This is where learning actually sticks.*

## Product & pedagogy

*(Your connections between Brilliant’s approach and how you’d teach derivatives.)*



## Front end



## Back end & persistence



## Content system



## Open questions



## Experiments I want to try



---

## Appendix — project notes (build log)

### Tools & workflow

- **Cursor** with AI-assisted coding for scaffolding, components, and lesson JSON
- **React + Vite + TypeScript**; **Firebase** for auth/progress when configured
- **Demo mode** (localStorage) when Firebase env vars are unset

### Prompting strategies that worked

1. JSON schema for 4–6 step lessons with `slider_graph`, MCQ, numeric, and read types
2. SVG graph widget with `ResizeObserver` for mobile rotation
3. Client-side `feedbackEngine.checkAnswer()` with async Firestore writes after
4. Firebase Auth with localStorage fallback for local development

### Rough code split

~75% AI-generated scaffolding, ~25% hand-written graph math, feedback copy, and validation.
