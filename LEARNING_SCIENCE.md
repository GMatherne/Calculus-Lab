# Learning Science for the Calculus App — Research & Application Notes

A compiled, source-backed guide to the learning science most relevant to this
app (a Brilliant-style, learn-by-doing calculus course), plus concrete,
file-level ideas for putting each principle into practice.

> Companion to [`OVERVIEW.md`](./OVERVIEW.md) (what the app does and how it works
> internally). This document is the *why* — the evidence behind the learning
> design, and where the biggest improvement opportunities are.

**How to read this:** Section 1 is a quick audit of what the app already does.
Section 2 is the prioritized to-do list (the actionable part). Section 3 is the
reference library. Section 4 lists traps to avoid. Section 5 is a suggested
sequencing.

---

## Table of contents

1. [What the app already does well (baseline)](#1-what-the-app-already-does-well-baseline)
2. [Biggest opportunities (prioritized)](#2-biggest-opportunities-prioritized)
   - [Tier 1 — Highest leverage](#tier-1--highest-leverage-strong-evidence)
   - [Tier 2 — Strong, low–moderate effort](#tier-2--strong-evidence-lowmoderate-effort)
   - [Tier 3 — Worthwhile polish](#tier-3--worthwhile-polish-handle-with-care)
3. [Resource library](#3-resource-library)
4. [Anti-patterns to avoid](#4-anti-patterns-to-avoid)
5. [Suggested sequencing](#5-suggested-sequencing)
6. [Principle → app cheat sheet](#6-principle--app-cheat-sheet)

---

## 1. What the app already does well (baseline)

The app is built on the single most evidence-backed idea in education —
**active learning**. Freeman et al. (2014), a meta-analysis of 225 STEM studies,
found active learning raises exam performance by ~0.47 SD and makes students
**1.5× less likely to fail** than traditional lecturing. The app's "drop the
learner into an interactive step and grade instantly" model *is* active learning.

Several other principles are already present, at least in a basic form:

| Principle | How the app does it today | Primary code |
|---|---|---|
| Active learning / learn-by-doing | Interactive graphs, drag-drop, power-term builder, tap-the-point | `GraphWidget.tsx`, `AnswerInput.tsx` |
| Immediate feedback | Synchronous client-side grading (<100 ms) | `feedbackEngine.ts`, `FeedbackPanel.tsx` |
| Retrieval practice (testing effect) | Per-lesson practice banks, randomly sampled | `contentLoader.ts` → `getPracticeSession` |
| Interleaving | Mixed review + level review across lessons | `getReviewSession`, `getLevelReviewSession` |
| Mastery tracking | Concept tiers from first-try accuracy | `masteryService.ts` |
| Dual coding | Graphs + KaTeX math + prose shown together | `GraphWidget` + `MathBlock` |
| Gamification | XP, day-streaks, milestones, activity heatmap | `progressService.ts`, `ActivityHeatmap.tsx` |

**The opportunity is depth, not novelty.** The highest-value gaps are places
where a principle is implemented as *display-only*, *on-demand*, or *stubbed
out* rather than actually driving the learning loop. Those are Section 2.

---

## 2. Biggest opportunities (prioritized)

Each item lists the **evidence**, the **current state** in the code, and a
concrete **do** with file references.

### Tier 1 — Highest leverage, strong evidence

#### ① Scheduled spaced repetition (turn on-demand review into a "due today" queue)

- **Evidence:** The spacing effect is "one of the largest and most robust
  effects in the learning literature" (Cepeda et al. 2006 meta-analysis, 839
  comparisons). Optimal gap ≈ 10–20% of the desired retention interval
  (Cepeda/Pashler). Duolingo's move from on-demand review to a trained
  forgetting-curve model (half-life regression) lifted daily engagement 12%
  (Settles & Meeder 2016).
- **Current state:** Review is random sampling triggered by a click. The streak
  tracks *days active* but never schedules *what* to review. There is no
  forgetting curve, no due dates, and no `lastReviewed` timestamp anywhere
  (`contentLoader.ts`, `progressService.ts`).
- **Do:**
  - Add a per-concept (or per-step) memory record to persisted progress, e.g.
    `{ lastReviewed, intervalDays, stability, lapses }`.
  - Compute which concepts are "due" and surface a **"N concepts due for review"**
    card on the roadmap (`RoadmapPage`).
  - Weight `getReviewSession` toward overdue + weak items instead of pure random.
  - Start simple (Leitner box / SM-2 interval ladder), then optionally graduate
    to FSRS (difficulty / stability / retrievability with a target retention,
    typically ~90%).
  - Reference implementations: Duolingo HLR (open-source), FSRS
    (open-spaced-repetition), Anki's SM-2.

#### ② Elaborated, misconception-specific feedback

- **Evidence:** Feedback is among the most powerful influences on achievement —
  *but only certain kinds*. Elaborated/explanatory feedback beats simple
  right/wrong verification (Hattie & Timperley 2007; Shute 2008: feedback should
  be specific, task-focused, supportive, and elaborated).
- **Current state:** Every wrong answer to a step shows the **same**
  `feedback.incorrect`, regardless of *which* wrong option or value was chosen
  (`feedbackEngine.ts`). A student who answers the derivative of x³ as "3x³" gets
  the identical message as one who answers "x²".
- **Do:**
  - Extend `AnswerSpec` so distractors can carry targeted feedback — e.g. add an
    optional `optionFeedback: string[]` to `MultipleChoiceAnswer`, or a
    `misconceptions` map keyed by common wrong values for `numeric` / `power_term`.
  - Have `checkAnswer` select the matching message when present, falling back to
    the generic `feedback.incorrect`.
  - The content schema is already feedback-rich, so this is mostly additive —
    high impact, low risk.

#### ③ Make mastery *drive* the experience (and let it decay)

- **Evidence:** Mastery learning is the core of Bloom's "2 sigma" result (1984);
  modern estimates put mastery-with-feedback near ~1.1 SD. Khan Academy's data
  shows the share of skills taken **to proficient/mastered** predicts external
  test growth, independent of time on platform.
- **Current state:** `masteryService.getWeakConcepts` already computes weak areas
  well — but it is **display-only on the profile**. `getContinueLessonId` ignores
  mastery, the review sampler ignores mastery, and the `"mastered"` lesson status
  is recognized by unlock logic but **never written**. Mastery also never decays.
- **Do:**
  - Feed `getWeakConcepts` into the roadmap's "Continue" recommendation and the
    review sampler so the app steers practice toward weak concepts.
  - Actually write `"mastered"` status when a concept clears its threshold
    (`MASTERY_MASTERED = 0.9`), and let mastery **decay** over time (ties into ①)
    so "mastered" stays honest — Khan's familiar → proficient → mastered ladder.

### Tier 2 — Strong evidence, low–moderate effort

#### ④ Tiered / faded hints — **Implemented** as a learner-controlled assistance toggle

- **Evidence:** Worked-example and guidance-fading effects + cognitive load
  theory: novices benefit from scaffolding; fade it as expertise grows or it
  backfires (the *expertise reversal effect*, Kalyuga et al.; Sweller on guidance
  fading).
- **Current state:** Each question carries a three-state assistance toggle
  (`AssistanceToggle.tsx`): **Solve it** (shows the interactive question first, then
  a "Work through it" walkthrough that animates the widget to the answer while the
  concept-to-answer `Step.solution` reveals step by step, via `solutionService.ts`
  + `SolutionPanel.tsx`),
  **Hints** (live "warmer/colder" proximity feedback while interacting on
  value-tuning questions, plus the authored hint offered proactively and the AI
  tutor), and
  **No help** (no proactive hints or sandbox — a missed answer shows only a brief
  verification, with the AI tutor available on demand). The level is a sticky per-learner
  preference (`useAssistancePreference.ts`, default Hints) and the learner can
  override it on any question. "Solve it" is a worked example, not a test, so it
  advances the lesson but is excluded from concept mastery (`markStepSolved` +
  `solvedSteps`, honored in `masteryService.ts`); it is offered on lesson
  questions only — practice questions get just Hints / No help. The legacy
  `Interaction.hintAfterAttempts` field is superseded by this toggle.
- **Possible follow-ups:**
  - Auto-fade the default level by mastery (start new concepts on "Solve it",
    fade to Hints, then None) instead of a single sticky preference.
  - **Progressive hints** (nudge → strategy → near-worked step) within the Hints
    level instead of a single hint string (pairs with AI-4).

#### ⑤ Self-explanation prompts

- **Evidence:** Students who explain *why* a step works learn far more — 82% vs
  46% post-test in Chi et al. (1989); eliciting self-explanations improves
  understanding (Chi et al. 1994).
- **Do:** After a correct answer, occasionally ask a gradable
  **"Why did that work?"** multiple-choice (pick the best explanation). This
  captures most of the self-explanation benefit without free-text grading and
  reuses the existing `multiple_choice` widget.

#### ⑥ Difficulty targeting toward ~80% success (flow / Zone of Proximal Development)

- **Evidence:** Learning and engagement peak when challenge matches skill — flow
  theory (Csikszentmihalyi) and the Zone of Proximal Development (Vygotsky).
  Duolingo's "Birdbrain" serves items at ~80% predicted success and even models
  the probability the learner disengages.
- **Do:** Tag practice-bank questions with a difficulty level and bias session
  sampling toward the learner's edge (mostly can-do, a few stretch items) rather
  than uniform random in `sampleSession`.

### Tier 3 — Worthwhile polish (handle with care)

#### ⑦ Confidence calibration (metacognition)

- **Evidence:** Overconfidence leads to premature stopping and worse retention
  (Dunlosky & Rawson 2012); low performers are the most overconfident
  (Dunning–Kruger, replicated in STEM).
- **Do:** Add a one-tap "sure / not sure" on submit; show a simple calibration
  stat on the profile (how often "sure" answers were actually correct).

#### ⑧ Concreteness fading as a content pattern

- **Evidence:** Concrete → abstract beats either alone for *transfer* in math
  (Fyfe, McNeil, Son & Goldstone 2014; McNeil & Fyfe 2012). Pair with multimedia
  principles (Mayer): keep labels next to graphics, avoid redundant text.
- **Do:** Formalize a graph → table/numbers → symbols progression in the lesson
  authoring guidelines, so abstract notation is always grounded in a manipulable
  visual first.

#### ⑨ Daily goals + humane streaks

- **Evidence:** Autonomy, competence, and relatedness drive intrinsic motivation
  (Self-Determination Theory, Ryan & Deci). Process praise beats person praise
  (Dweck), though mindset effects are small.
- **Do:** Let users *choose* a daily goal (autonomy); add a **streak freeze** so a
  single missed day doesn't trigger a quit; use **process praise** wording in
  feedback ("nice — you applied the power rule correctly") over person praise
  ("you're a genius").

---

## 3. Resource library

Grouped by theme. Prefer the primary sources; the summaries are good entry
points.

### Foundations / "what works" overviews
- Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), *Improving Students'
  Learning With Effective Learning Techniques* — ranks practice testing &
  distributed practice as the top two of ten common techniques.
  https://journals.sagepub.com/doi/abs/10.1177/1529100612453266
  (free summary: https://www.aft.org/sites/default/files/media/2014/dunlosky.pdf)
- Freeman et al. (2014, PNAS), *Active learning increases student performance in
  science, engineering, and mathematics.*
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4060654/
- Deans for Impact, *The Science of Learning* (practitioner summary).
  https://www.learningscientists.org/ (ongoing practitioner resource)

### Retrieval practice & spacing
- Roediger & Karpicke (2006), *Test-Enhanced Learning.*
  http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Karpicke-2006_PPS.pdf
- Cepeda, Pashler, Vul, Wixted & Rohrer (2006), distributed-practice
  meta-analysis.
  http://uweb.cas.usf.edu/~drohrer/pdfs/Cepeda_et_al_2006PsychBull.pdf
- Cepeda/Pashler (optimal spacing ≈ 10–20% of retention interval).
  https://gwern.net/doc/psychology/spaced-repetition/2007-pashler.pdf

### Interleaving (math-specific — directly relevant)
- Rohrer & Taylor (2007), *The shuffling of mathematics problems improves
  learning.*
  http://uweb.cas.usf.edu/~drohrer/pdfs/Rohrer%26Taylor2007IS.pdf
- Rohrer, Dedrick, Hartwig & Cheung (2020), RCT of interleaved math practice
  (61% vs 38%, d = 0.83).
  http://uweb.cas.usf.edu/%7Edrohrer/pdfs/Rohrer_et_al_2020JEdPsych.pdf

### Mastery, worked examples, cognitive load
- Bloom (1984), *The 2 Sigma Problem.*
  https://files.ascd.org/staticfiles/ascd/pdf/journals/ed_lead/el_198405_bloom.pdf
  (critical context: https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/)
- Kalyuga et al., *Expertise Reversal Effect.*
  https://link.springer.com/article/10.1007/s10648-007-9054-3
- Sweller, *The guidance fading effect.*
  https://cogscisci.wordpress.com/wp-content/uploads/2019/08/sweller-guidance-fading.pdf

### Feedback, self-explanation, metacognition
- Hattie & Timperley (2007), *The Power of Feedback.*
  https://blackburn.edu/wp-content/uploads/2024/09/99064620_the_power_of_feedback_-_hattie_and_timperley-1.pdf
- Shute (2008), *Focus on Formative Feedback.*
  https://myweb.fsu.edu/vshute/pdf/shute%202007_f.pdf
- Chi, Bassok, Lewis, Reimann & Glaser (1989), *Self-Explanations.*
  https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1302_1
- Dunlosky & Rawson (2012), *Overconfidence produces underachievement.*
  https://www.sciencedirect.com/science/article/abs/pii/S0959475211000685

### Representation, transfer, difficulty
- Mayer, *Cognitive Theory of Multimedia Learning.*
  https://www.cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/cognitive-theory-of-multimedia-learning/A49922ACB5BC6A37DDCCE4131AC217E5
- Fyfe, McNeil, Son & Goldstone (2014), *Concreteness Fading in Mathematics and
  Science Instruction.*
  https://eric.ed.gov/?id=EJ1036777
- Bjork & Bjork (2020), *Desirable difficulties in theory and practice.*
  https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2021/01/RABjorkELBjorkJARMAC2020ForPostingSingleSpaced.pdf
- Csikszentmihalyi, *Flow* (excerpt).
  https://files.blogs.baruch.cuny.edu/wp-content/blogs.dir/2418/files/2013/04/Mihaly-Csikszentmihalyi-Flow.pdf

### Motivation & engagement
- Ryan & Deci (2000), *Self-Determination Theory.*
  https://www.selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf
- Lepper, Greene & Nisbett (1973), the overjustification effect.
  https://bingschool.stanford.edu/sites/bingschool/files/1973_lepperetal.pdf
- Sisk et al. (2018), growth-mindset meta-analyses (small effects; adopt cheaply,
  don't over-claim).
  https://englelab.gatech.edu/articles/2018/Sisk,%20Burgoyne%20et%20al.%20(2018)%20-%20Mindset%20and%20Academic%20Achievement.pdf
- Sailer & Homner (2019), *The Gamification of Learning: A Meta-analysis*
  (small, heterogeneous effects — implementation matters).
  https://link.springer.com/article/10.1007/s10648-019-09498-w

### How leading apps implement this (engineering references)
- Duolingo — *A Trainable Spaced Repetition Model for Language Learning*
  (Settles & Meeder 2016): https://research.duolingo.com/papers/settles.acl16.pdf
  · code: https://github.com/duolingo/halflife-regression
- Anki — SM-2 vs FSRS scheduling:
  https://faqs.ankiweb.net/what-spaced-repetition-algorithm
  · FSRS project: https://github.com/open-spaced-repetition
- Khan Academy — mastery system (familiar → proficient → mastered):
  https://support.khanacademy.org/hc/en-us/articles/360007253831-What-is-self-paced-Mastery
  · efficacy: https://blog.khanacademy.org/why-khan-academy-will-be-using-skills-to-proficient-to-measure-learning-outcomes/
- Brilliant — learn-by-doing pedagogy:
  https://blog.brilliant.org/solving-equations/

---

## 4. Anti-patterns to avoid

- **Overjustification.** Don't escalate XP for intrinsically interesting
  problem-solving; task-contingent tangible rewards can *undermine* intrinsic
  motivation (Lepper 1973; Deci, Koestner & Ryan 1999). Keep rewards
  **informational** (a signal of competence/progress), not controlling.
- **Dark-pattern streaks.** Pure loss-aversion streaks cause "streak anxiety" and
  one-miss quitting. Add streak freezes and frame progress around mastery, not
  punishment.
- **Cargo-cult gamification.** Points/badges/leaderboards have only small,
  inconsistent effects (Sailer & Homner). Tie them to *meaningful progress and
  mastery*, not vanity counters.
- **Forcing scaffolds on experts.** Worked examples and heavy hints that help
  novices can *hurt* advanced learners (expertise reversal). Fade them (see ④).
- **Mindset over-claim.** Process-praise wording is a cheap, sensible default,
  but effect sizes are small — don't expect it to move outcomes on its own.

---

## 5. Suggested sequencing

A pragmatic order by evidence-to-effort, given the current architecture:

1. **② Misconception-specific feedback** — additive to a feedback-rich schema;
   immediate perceived-quality win.
2. **① Scheduled spaced repetition** — the biggest retention win; reuses the
   existing review infrastructure. Start with a simple interval ladder.
3. **③ Mastery actually drives study** — `getWeakConcepts` already exists; wire it
   into "Continue" + review sampling, then add decay.
4. **④ Faded/tiered hints** — **done** (three-state assistance toggle); optional
   follow-ups: auto-fade by mastery and progressive hints.
5. **⑤ Self-explanation** and **⑥ difficulty targeting** — content + sampling
   changes.
6. **⑦–⑨** — calibration, concreteness-fading authoring guidelines, humane
   streaks/daily goals.

---

## 6. Principle → app cheat sheet

| Principle | Status | Where it lives / would live |
|---|---|---|
| Active learning | Strong | widgets, `GraphWidget.tsx` |
| Immediate feedback | Strong | `feedbackEngine.ts`, `FeedbackPanel.tsx` |
| Retrieval practice | Good | `getPracticeSession` |
| Interleaving | Good (random) | `getReviewSession`, `getLevelReviewSession` |
| Spacing (scheduled) | **Missing** | new memory record + due queue |
| Elaborated/misconception feedback | **Missing** | `AnswerSpec`, `feedbackEngine.ts` |
| Mastery-driven study | Partial (display-only) | `masteryService.ts`, roadmap, sampler |
| Mastery decay + `"mastered"` write | **Missing** | `progressService.ts`, `masteryService.ts` |
| Faded scaffolding / tiered hints | **Done** (3-state assistance toggle: solve / hints / none) | `AssistanceToggle.tsx`, `LessonPlayer.tsx`, `solutionService.ts` |
| Self-explanation | **Missing** | new prompt via `multiple_choice` |
| Difficulty / flow targeting | **Missing** | difficulty tags + `sampleSession` |
| Metacognition / calibration | **Missing** | submit UI + profile |
| Concreteness fading | Partial (ad hoc) | authoring guidelines |
| Dual coding / multimedia | Good | graphs + math + prose |
| Gamification (XP/streaks/milestones) | Good (watch anti-patterns) | `progressService.ts` |
| Daily goals / humane streaks | **Missing** | settings + `progressService.ts` |

---

*Compiled from the cognitive-science and education-research literature and from
published descriptions of Duolingo, Khan Academy, Anki, and Brilliant. Effect
sizes and claims are summarized; follow the links in Section 3 for primary
sources and caveats.*
