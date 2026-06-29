# Calculus Lab — Product Requirements Document

| | |
|---|---|
| **Product** | Calculus Lab — a Brilliant-style, learn-by-doing calculus app |
| **Owner** | Grant |
| **Status** | Draft |
| **Version** | 1.0 |
| **Last updated** | 2026-06-25 |
| **Live** | https://calculus-lab.web.app |
| **Related docs** | [`instructions.md`](./instructions.md) (the brief / end goal) · [`OVERVIEW.md`](./OVERVIEW.md) (how it works) · [`LEARNING_SCIENCE.md`](./LEARNING_SCIENCE.md) (evidence base) · [`IDEAS.md`](./IDEAS.md) (backlog) · [`README.md`](./README.md) (setup) |

---

## 1. Summary

Calculus Lab teaches the foundations of **AP Calculus BC** — derivatives and
integrals — the way Brilliant does: drop the learner into a short sequence of
**interactive steps**, let them manipulate a live graph, and give **instant,
specific feedback** on every attempt. There is no video and no wall of text.

The app is deployed and **fully functional with no AI** (Phase 1 complete). The
end goal, per [`instructions.md`](./instructions.md), is a three-phase build:
**(1)** a hand-built learn-by-doing MVP, **(2)** AI features grounded in the
lesson's structured state, and **(3)** evidence-based learning-science
techniques layered on top — all while the core app keeps teaching with AI turned
off.

This PRD captures **what is built today** and specifies **the remaining work** to
reach that end goal.

---

## 2. Problem & context

Most learning apps hand you a video and a quiz; passive content does not stick.
Active problem-solving does — Freeman et al. (2014) found active learning raises
exam performance ~0.47 SD and makes students 1.5× less likely to fail. AP
Calculus BC is a high-stakes, concept-heavy course where students routinely
"watch and nod" but can't *do* the problems on the exam.

**The opportunity:** pick one subject (calculus) and go deep — a sequenced path
of touchable lessons where a learner can be wrong, get targeted feedback, and
figure the idea out themselves. Make it work without AI first, then make it
smarter, then make it stick.

**Why now:** this is a time-boxed build with a hard cadence (see §10). Phase 1
is a gate that is already passed; Phase 2 (AI) is the next deadline.

---

## 3. Goals & non-goals

### Goals
- **G1 — Teach without AI.** One subject, taught deeply; a learner who knows
  little can finish the course understanding something real. The app must teach
  fully with AI turned off.
- **G2 — Learn by doing.** Every lesson has ≥ 1 hands-on, manipulable visual and
  instant, specific feedback on every answer.
- **G3 — Bring learners back.** Progress persists across sessions/devices; a path
  with mastery tracking recommends a sensible next step; streaks/milestones make
  return visits rewarding (without dark patterns).
- **G4 — Make it smarter (Phase 2).** Add AI features that genuinely help —
  grounded in structured lesson state and gated by the deterministic engine so AI
  never emits a wrong answer.
- **G5 — Make it stick (Phase 3).** Layer evidence-based learning science
  (spaced repetition, retrieval, interleaving, mastery, faded scaffolding) that
  actually drives the learning loop, not just decorates it.

### Non-goals
- **NG1 — Breadth.** Not a multi-subject platform; calculus only. Five excellent
  lessons beat thirty thin ones.
- **NG2 — A generic chatbot tutor** bolted on "because everyone has one."
- **NG3 — AI as the grader.** AI never grades math on its own; the deterministic
  engine (`feedbackEngine`, math.js, lesson validators) is always the source of
  truth.
- **NG4 — High-stakes assessment.** Answer keys ship in the client bundle; this is
  a teaching tool, not a proctored exam.
- **NG5 — A custom backend / CMS.** Content stays version-controlled JSON;
  Firebase provides only auth + per-user storage.
- **NG6 — Native mobile apps.** Responsive web only.

---

## 4. Success metrics

### Product / assignment acceptance (the test scenarios from the brief)
- A learner completes one lesson end-to-end, gets some problems **wrong**, and
  uses the feedback to recover.
- A learner manipulates the interactive element and watches the visual respond in
  real time.
- A learner leaves mid-lesson and returns — progress **and** streak persist.
- Finishing a lesson surfaces a **sensible next step** in the path.
- The whole flow works on a **phone-sized** screen, with **multiple concurrent
  learners** and no slowdown.
- The app still teaches with **AI turned off**.

### Performance targets (hard requirements)
| Metric | Target |
|---|---|
| Feedback latency on an answer | **< 100 ms** |
| Interactive visual frame rate | **60 FPS** while manipulating |
| Time to first interaction (lesson load) | **< 2 s** |
| Mobile + touch | Works on phone screen sizes |

### Engagement & learning (leading indicators)
- **Activation:** % of new accounts that complete ≥ 1 lesson.
- **Return:** D1/D7 return rate; median streak length; streak survival (how often
  a single miss ends a streak — should *fall* after humane-streak work).
- **Mastery:** distribution of concepts at `learning` / `proficient` / `mastered`;
  first-try accuracy trend on review items (retention signal).
- **Recovery:** share of initially-wrong steps eventually answered correctly in
  the same session (does feedback help?).

---

## 5. Target users

**Primary persona — "AP BC Student".** Taking AP Calculus BC, studies
on her phone in short bursts, wants to *practice* rather than re-watch lectures.
Needs: quick wins, clear feedback when she's wrong, and a path that tells her what
to do next.

**Secondary — "Returning self-learner" (adult brushing up on calculus).** Values
depth and being able to skip what they already know (see scaffolding/expert
notes in §8/§11).

---

## 6. Current state (what's shipped today)

Phase 1 is **complete and deployed**; a meaningful slice of Phase 3 exists.
Source of truth: [`OVERVIEW.md`](./OVERVIEW.md).

### Shipped — core experience
- **Course:** "Introduction to Calculus" — **10 lessons across 5 levels**, all
  hand-authored JSON, sequential unlock (lesson *N* opens after *N−1*).
- **12 step/answer types:** `read`, `multiple_choice`, `multi_choice`, `numeric`,
  `slider_graph`, `power_term`, `drag_drop`, `match`, `sign_chart`, `order_list`,
  `riemann`, and the `predict` drag-to-reveal step (plus `slider` and
  `graph_point` graph answers).
- **Live (continuous) feedback:** distance-based steps can set `liveCheck` to be
  graded as the learner manipulates — the target zone shades green with a
  warmer/colder proximity meter, and the step confirms the instant it's right
  (no Check Answer press). The flagship `predict` step adds direct-manipulation
  predict-then-reveal: drag a marker to a feature, lock it in, and the true
  point/tangent animates in.
- **Interactive SVG graph engine** (`GraphWidget`): function plotting,
  secant→tangent (`h→0`), area shading (integral visual) with live trapezoidal
  estimate, touch slider, tap-the-point, responsive via `ResizeObserver`.
- **Instant client-side grading** (`feedbackEngine` + math.js), synchronous,
  < 100 ms; authored correct/incorrect/hint per step; KaTeX math rendering.
- **Persistence & resume:** per-step progress to Firestore (or `localStorage`
  demo/offline fallback); resume exactly where you left off.
- **Auth:** email/password + Google; per-user Firestore security rules; account
  management (rename, change email/password, delete).
- **Habit loop:** XP (+50/lesson first completion, +10/first-try practice),
  day-streaks, milestones, celebration screens.
- **Mobile-first responsive UI**; deployed to Firebase Hosting; demo mode needs
  zero config.
- **Tooling:** lesson schema validator (`npm run validate:lessons`), Vitest unit
  tests over `src/lib/**`.

### Shipped — learning-science baseline (Phase 3, partial)
| Principle | State today |
|---|---|
| Active learning | **Strong** (the whole interaction model) |
| Immediate feedback | **Strong** (synchronous grading) |
| Retrieval practice | **Good** — per-lesson practice banks, sampled |
| Interleaving | **Good but random** — mixed review + level review |
| Mastery tracking | **Display-only** — concept tiers on the profile |
| Dual coding | **Good** — graph + math + prose together |
| Gamification | **Good** — XP / streaks / milestones / heatmap |

### Not yet built
- **All of Phase 2 (AI).** No model calls anywhere today.
- **Several high-leverage Phase 3 items** (see §8): scheduled spaced repetition,
  misconception-specific feedback, mastery that *drives* study + decays,
  self-explanation prompts, difficulty targeting, calibration, humane streaks.
  (Faded / tiered hints — **LS-4** — are now **done**: a three-state per-question
  assistance toggle, which supersedes the old `hintAfterAttempts` field.)

---

## 7. Requirements — Phase 2: AI features (next milestone)

> **Guardrails for every AI feature** (from [`IDEAS.md`](./IDEAS.md)):
> - **Truth oracle:** AI never grades math itself — output is gated by
>   `checkAnswer` / `verifyNumericWithMathJs` / `derivativeAt` / `assertValidLesson`.
> - **Offline-first & instant:** client-side grading keeps working with zero AI;
>   every AI call is async and **never blocks** the synchronous grade; degrade to
>   authored content when offline/over budget.
> - **Delivery:** OpenAI behind a **Cloud Functions proxy** (`functions/`) that
>   holds the API key server-side and enforces App Check, auth, and per-user rate
>   limiting. (The concept tutor shipped first and drove this: an OpenAI key
>   can't live in the browser, so the original "no new backend" plan was
>   deliberately replaced.)
> - **LS-first:** prefer features that create desirable difficulty, retrieval, and
>   self-explanation over ones that hand out answers.

The brief requires Phase 2 to be a **decide-then-build**: document what was
chosen, shipped, and deliberately left out (for the Brainlift). Recommended
ordering is lowest-risk first (author-time → runtime feedback → personalization →
multimodal).

| ID | Requirement | Priority | Notes |
|---|---|:--:|---|
| **AI-1** | **Schema-constrained generation + verifier loop.** The model's structured output emits a `Step` conforming to the existing `AnswerSpec`; before display, run `assertValidLesson` + `checkAnswer` and confirm math against the deterministic engine (e.g. `derivativeAt` must match a `power_term`; `trueArea` must match `riemannSum`). Reject & regenerate on mismatch. | **P0** | Backbone that makes "AI questions" safe. Solves the "might be wrong" + "widget compatibility" risks by construction. |
| **AI-2** | **Misconception diagnosis from the actual wrong answer.** Feed the literal wrong value (e.g. `power_term {coef:3, exp:3}`) to the model to name the specific slip ("you brought the 3 down but didn't reduce the exponent"). Authored `incorrect` text is the offline fallback. | **P0** | Highest perceived-quality runtime win; grounded because the engine already knows what's wrong. |
| **AI-3** | **Lesson-authoring copilot (author-time only, in DevTools).** From a `conceptTag` + objective, draft a full 6–10 step lesson, then auto-run `validate:lessons` + AI-1 verifier; human reviews before publish. | **P1** | Lowest-risk place to start — no live-learner exposure; preserves the hand-authored quality bar. |
| **AI-4** | **Progressive hint ladder calibrated to mastery.** Generate a sequence (nudge → strategy → worked partial) scaled to the learner's tier for the `conceptTag`; never reveal the final answer. | **P1** | Pairs with LS-4 (faded hints); respects the existing "hint never gives the answer" rule. |
| **AI-5** | **AI study plan / weekly coach.** Read `getConceptMastery` + `getWeakConcepts` + streak + `activityLog` → a personalized plan ("weakest: chain rule & area-under-curve; here's a 3-day set"). | **P1** | Builds on the existing mastery layer; "practice my weak topics" from `IDEAS.md`. |
| **AI-6** | **"Explain why" self-explanation checkpoint, graded by AI.** After a correct answer on a keystone step, optionally ask the learner to type *why* in one sentence; AI evaluates the reasoning (not the answer) against the concept. | **P1** | Generative self-explanation — a strong LS lever (overlaps LS-5). |
| **AI-7** | **Adaptive next-question selection (zero generation risk).** AI only *sequences/selects* from the existing vetted `practiceBank` / `getReviewSession` by mastery + recent errors + spacing — no new content. | **P2** | Correctness guaranteed; personalizes order only. |
| **AI-8** | **Worked-solution-on-demand, post-mastery only.** Unlock an AI step-by-step walkthrough **after** a correct answer or exhausted attempts; verify each line with math.js. | **P2** | Reinforces struggle rather than short-circuiting it. |
| **AI-9** | **Diagnostic distractor generator (author-time).** Generate wrong options that each encode a *named misconception*, stored as a tag so a wrong pick can trigger targeted feedback (feeds AI-2 / LS-2). | **P2** | Authoring aid. |
| **AI-10** | **Multimodal: snap-a-problem / show-your-work.** Photograph a problem → parsed into a verified interactive Step; or check an intermediate line for the *first* wrong step (anchored by math.js). | **P3** | Last, per the suggested rollout order. |

**Cross-cutting (P0 for any AI surface):** deterministic gate on everything
generative; graceful degradation to authored content; App Check + per-user rate
limits enforced server-side by the Cloud Functions proxy (with OpenAI + GCP
budget caps as a financial backstop); prompt-injection hardening and calculus-only
scoping for free-text surfaces; send anonymized mastery vectors (no PII) with a
per-user opt-out; log AI outputs for human review.

---

## 8. Requirements — Phase 3: Learning science (make it stick)

Prioritized by evidence-to-effort from [`LEARNING_SCIENCE.md`](./LEARNING_SCIENCE.md).

| ID | Requirement | Priority | Evidence / current state |
|---|---|:--:|---|
| **LS-1** | **Scheduled spaced repetition.** Add a per-concept memory record (`lastReviewed`, `intervalDays`, `stability`, `lapses`); compute "due" concepts; show a **"N concepts due"** card on the roadmap; weight `getReviewSession` toward overdue + weak. Start with a Leitner/SM-2 ladder, optionally graduate to FSRS. | **P0** | Spacing is one of the largest effects in the literature (Cepeda 2006). Today review is on-demand random with no schedule. |
| **LS-2** | **Misconception-specific feedback.** Extend `AnswerSpec` so distractors carry targeted feedback (e.g. `optionFeedback[]`, or a `misconceptions` map for `numeric`/`power_term`); `checkAnswer` selects the matching message, else falls back to authored `incorrect`. | **P0** | Elaborated feedback beats right/wrong (Hattie & Timperley; Shute). Today all wrong answers show the same message. Mostly additive. |
| **LS-3** | **Make mastery drive the experience + let it decay.** Feed `getWeakConcepts` into the roadmap "Continue" recommendation and the review sampler; actually **write** `"mastered"` at `MASTERY_MASTERED = 0.9`; decay mastery over time (ties to LS-1). | **P0** | Mastery learning ≈ Bloom's 2-sigma. Today `getWeakConcepts` is display-only; `"mastered"` status is never written; no decay. |
| **LS-4** | **Tiered / faded hints — DONE.** Each question has a three-state assistance toggle: **Solve it** (shows the interactive question first, then a "Work through it" walkthrough that animates the widget to the answer while the concept-to-answer solution reveals step by step; lesson questions only — excluded from mastery), **Hints** (live "warmer/colder" feedback while interacting on value-tuning questions + proactive authored hint + AI tutor), and **No help** (no proactive hints/sandbox; a miss shows only a brief verification, with the AI tutor available on demand). Sticky per-learner default (`useAssistancePreference`). `AssistanceToggle.tsx`, `SolutionPanel.tsx`, `solutionService.ts`, `Step.solution`. | **Done** | Guidance-fading / expertise-reversal. Supersedes the old (dead) `hintAfterAttempts`. Optional follow-ups: auto-fade by mastery; progressive hint ladder (AI-4). |
| **LS-5** | **Self-explanation prompts.** After a correct answer, occasionally ask a gradable "Why did that work?" multiple-choice (reuses the existing widget; no free-text grading needed). | **P1** | Chi et al. (1989): 82% vs 46% post-test. Overlaps AI-6 (AI is the richer version). |
| **LS-6** | **Difficulty targeting (~80% success).** Tag practice-bank questions with difficulty; bias `sampleSession` toward the learner's edge (mostly can-do + a few stretch) instead of uniform random. | **P1** | Flow / ZPD; Duolingo "Birdbrain" ~80% target. |
| **LS-7** | **Comprehensive "test out" to skip levels.** Let experts skip a lesson/level by passing a cumulative test (required # of questions per lesson, all topics represented). | **P1** | From [`IDEAS.md`](./IDEAS.md): "forcing scaffolds on experts is bad" (expertise reversal). |
| **LS-8** | **Humane streaks + daily goals.** User-chosen daily goal (autonomy), **streak freezes**, "streak sympathy" for newcomers that tightens over time, process-praise wording in feedback. | **P2** | Avoids dark-pattern streaks (also in `IDEAS.md`); SDT (Ryan & Deci). |
| **LS-9** | **"Things to memorize" reference layer.** Per-lesson/level concise key-facts (derivatives of sin/cos/eˣ, power rule, product/chain/quotient rules) with an expandable explanation; grows as levels unlock. | **P2** | From `IDEAS.md`. Supports retrieval + quick reference. |
| **LS-10** | **Confidence calibration.** One-tap "sure / not sure" on submit; show a calibration stat on the profile. | **P3** | Dunlosky & Rawson (2012): overconfidence → underachievement. |
| **LS-11** | **Concreteness-fading authoring guideline.** Formalize graph → table/numbers → symbols progression in lesson-authoring guidelines. | **P3** | Fyfe et al. (2014); content-pattern, not code. |

---

## 9. Content roadmap (subject depth)

From [`IDEAS.md`](./IDEAS.md) — extend the calculus path while keeping depth:
- **Differentiation rules:** product rule, quotient rule, chain rule (currently
  the course stops at polynomials).
- **Non-polynomial functions:** derivatives/integrals of sin, cos, eˣ, ln, etc.
- **Targeted weak-topic practice** entry point (e.g. next to "Continue learning").

Priority: **P1**, sequenced so each new lesson has ≥ 1 hands-on graph interaction
and passes `validate:lessons`.

---

## 10. Non-functional requirements

- **Performance:** meet the §4 targets (<100 ms grade, 60 FPS, <2 s load).
- **Offline / degradation:** core grading + lessons work with no network and no
  AI; AI is strictly additive and async.
- **Compatibility:** modern mobile + desktop browsers; touch and pointer input;
  portrait + landscape.
- **Accessibility:** 44px+ touch targets, safe-area insets, legible math (KaTeX),
  keyboard-operable inputs (target WCAG AA where feasible).
- **Security & privacy:** per-user Firestore rules; App Check + per-user rate
  limits enforced by the Cloud Functions proxy on the AI endpoint, with the
  OpenAI key held in Secret Manager (never client-side); no PII sent to the
  model; per-user AI opt-out.
- **Cost:** AI features must stay within a per-user budget and degrade gracefully
  when exceeded.
- **Maintainability:** content stays version-controlled JSON validated at build
  time and via CLI; `src/lib/**` stays unit-tested.

---

## 11. UX / design notes

- **Lesson player** is the heart: one step at a time, big touch slider, live graph
  readouts, a feedback panel that turns green (correct, reveals Continue) or amber
  (incorrect, offers an authored hint behind a button — never auto-reveals the
  answer or highlights the correct option).
- **Roadmap** shows levels, progress %, streak, and the "Continue learning" CTA;
  add the **"N due for review"** card (LS-1) and a weak-topic practice entry point.
- **Profile** shows stats, an activity heatmap, weak areas, and concept mastery;
  extend with calibration (LS-10) and a natural-language progress summary (AI-5).
- **House voice for feedback:** concise, specific, process-praise; hints nudge,
  they don't solve.

---

## 12. Milestones & timeline

The brief mandates a strict order — **build the app, then make it smart, then
make it stick** — with these gates:

| Phase | Deadline | Scope | Status |
|---|---|---|:--:|
| **Phase 1 — MVP** | Wednesday | Hand-built learn-by-doing app, **no AI** (lessons, interaction, instant feedback, persistence, path + mastery, streaks, auth, mobile, deployed) | ✅ **Complete** |
| **Phase 2 — AI** | Friday | Decide + build AI features grounded in lesson state (see §7); MVP must still work with AI off | ⏳ **Next** |
| **Phase 3 — Learning science** | Sunday | Evidence-based techniques layered on top (see §8) | ◐ **Partially done** |
| **Submission** | **Sunday 10:59 PM CT** | GitHub repo (subject up front, setup, architecture, link), 3–5 min demo video, 1-page Brainlift, public deployed app (auth, mobile, concurrent, teaches with AI off) | ☐ Pending |

**Suggested execution order for the remaining work** (evidence-to-effort):
1. **LS-2** misconception feedback (additive, immediate quality win).
2. **AI-1 + AI-3** verified generation behind an author-time copilot (no learner
   risk) → unblocks safe content scaling.
3. **AI-2** runtime misconception diagnosis.
4. **LS-1** scheduled spaced repetition; **LS-3** mastery-driven study + decay.
5. **LS-4** faded hints — **done** (assistance toggle); next **AI-4** hint ladder; **LS-5/AI-6** self-explanation.
6. **AI-5/AI-7** personalization; **LS-6/LS-8** difficulty targeting + humane
   streaks; remainder as polish.

---

## 13. Assumptions, dependencies & constraints

- **Assumptions:** the deterministic engine is correct enough to serve as the
  truth oracle for AI; learners study primarily on mobile in short sessions.
- **Dependencies:** Firebase (Auth, Firestore, Hosting, App Check, **Cloud
  Functions**) and **OpenAI** (called only via the functions proxy) for Phase 2;
  math.js for ground-truth checks; KaTeX for display.
- **Constraints:** mostly server-free architecture (browser + BaaS), with a single
  Cloud Functions proxy required for AI so the OpenAI key stays off the client;
  content is JSON, so publishing a lesson is a code deploy; answer keys ship
  client-side (acceptable for a teaching tool, not assessment).

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI emits an incorrect math problem or hint | **AI-1 verifier loop** + deterministic gate on everything generative; reject & regenerate on mismatch. |
| AI latency/outage degrades the experience | AI is async and never blocks the grade; always fall back to authored content. |
| AI cost / abuse | App Check + per-user rate limits (Firestore `aiUsage`, enforced by the proxy) + OpenAI/GCP budget caps + a `config/ai` kill switch + opt-out. |
| Prompt injection via free-text surfaces | Calculus-only scoping, input hardening, log + review outputs. |
| Gamification backfires (streak anxiety, overjustification) | Humane streaks (LS-8), informational rewards, mastery-framed progress. |
| Scope creep beyond calculus | Enforce NG1 (depth over breadth); content roadmap stays within the subject. |
| "Mastered" becomes dishonest over time | Mastery decay (LS-3) tied to spaced repetition (LS-1). |

---

## 15. Open questions

1. **Spaced-repetition algorithm:** start with SM-2/Leitner and graduate to FSRS,
   or go straight to FSRS? (Affects LS-1 data model.)
2. **AI scope for submission:** which 2–3 AI features are the "headline" demo
   features vs. deliberately deferred (must be documented in the Brainlift)?
3. **Generated content exposure:** keep AI generation **author-time only** for
   submission (safest), or allow verified live generation for learners?
4. **Mastery as a gate:** should `"mastered"` (not just lesson `complete`) become
   a prerequisite to unlock later levels, or stay a recommendation signal?
5. **Test-out (LS-7) rigor:** how many questions / what coverage qualifies as
   "skip this level"?

---

## 16. Appendix

**Glossary**
- **Step** — one interactive unit (content + optional interaction + feedback).
- **AnswerSpec** — the typed shape describing how a step is answered/graded.
- **Concept tier** — `not_started → learning → proficient (≥60% first-try) →
  mastered (≥90%)`, computed per `conceptTag`.
- **Truth oracle** — the deterministic grading engine that gates all AI output.
- **Practice / Review / Level review** — retrieval sessions sampled from banks
  (per-lesson / cross-lesson / per-level).

**Key tuning constants** (`src/types/content.ts`): `MIN/MAX_STEPS` 6/10 ·
`MIN_MC_OPTIONS` 4 · `XP_PER_LESSON` 50 · `XP_PER_PRACTICE_CORRECT` 10 ·
`PRACTICE_SESSION_SIZE` 3 · `REVIEW_SESSION_SIZE` 5 · `MASTERY_PROFICIENT/MASTERED`
0.6/0.9.

**References:** see [`LEARNING_SCIENCE.md`](./LEARNING_SCIENCE.md) §3 for the
primary-source library behind every LS requirement, and [`IDEAS.md`](./IDEAS.md)
for the full AI/LS idea backlog.
