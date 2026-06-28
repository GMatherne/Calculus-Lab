---
name: creating-questions
description: >-
  Author and edit lesson and practice questions (Step objects in content/*.json) for this
  Brilliant-style calculus app, with prompts that never reveal the answer, many close
  misconception-based distractors, and meaningful (non-decorative) interaction, verified with
  npm run validate:lessons. Use when adding or editing a question, quiz item, practice-bank
  question, distractor, answer choices, lesson step, or interactive widget for course content.
---

# Creating Questions

A question is a `Step` object in a `content/*.json` lesson file, placed in the lesson's
`steps` (taught and graded; needs a worked solution) or its `practiceBank` (retrieval
practice; no solution). The schema is in [src/types/content.ts](src/types/content.ts), grading
in [src/lib/feedbackEngine.ts](src/lib/feedbackEngine.ts), and structural rules in
[src/lib/validateLesson.ts](src/lib/validateLesson.ts). Author against the schema only — never
invent fields.

The goal of every question is to make the learner *do the thinking the concept requires*. A
good question cannot be solved by reading a number off the screen, by eliminating silly
options, or by clicking around — only by understanding.

## Orientation

- **Edit or add inside an existing lesson:** drop a new `Step` into that file's `steps` or
  `practiceBank`. No code wiring needed.
- **A new lesson file** must also get a static import in
  [src/lib/contentLoader.ts](src/lib/contentLoader.ts) and an entry in `content/course.json`,
  or it will not load.
- **Always finish by running the gate** (see Validate).
- Copy patterns from the reference lesson
  [content/maxima-and-minima.json](content/maxima-and-minima.json).

Hard structural rules the validator enforces:

- 6-10 steps per lesson, including at least one `slider_graph` step.
- Every non-`read` step needs an `answer` and all three `feedback` fields
  (`correct` / `incorrect` / `hint`).
- Graded **lesson** steps need a worked `solution` (prose + display math); **practice**
  questions are exempt.
- A `practiceBank` needs at least 3 interactive questions with unique ids (no `read` steps).
- `multiple_choice` needs at least 4 options.
- Widgets that draw their own plot (`riemann`, `construct_graph`, `paint_intervals`,
  `tangent_line`, `integral_bounds`, `simulate`, `select_region`) must NOT define a `graph`.
  `slider`, `graph_point`, `predict_point`, and `slider_graph` MUST define one.

Full per-type fields, grading, and the misconception catalog: [reference.md](reference.md).

## The bar: four rules

### 1. Never give away the answer

Do not let the answer be readable, matchable, or eliminable.

- **Hide live readouts that equal the answer.** Use the `GraphConfig` flags `showValue: false`,
  `showSlopeValue: false`, `showAreaValue: false`. For a definite integral, pair
  `areaReadoutMath: true` with `showAreaValue: false` to show the live integral notation while
  withholding its number.
- **Use a static illustration when the answer is typed or picked:** `static: true` draws the
  curve with no slider and no readouts. Anchor a location with `markerX` (optionally with
  `showTangent`) without revealing its value.
- **Stop solving-by-matching on tap questions** with `pointChoices` (discrete dots) or
  `pointSnap`, so the learner commits to a real point instead of nudging a readout onto the
  target.
- **Keep the answer out of the stem.** Never restate the numeric or symbolic answer in
  `content`. The `hint` may be leading (it sits behind a button); the prompt may not.

**Optional concept sandbox.** Add `interaction.sandbox` to give "hints"-level learners an
ungraded explorer that opens beside the question, runs on a **different** example, and turns on
the readout the question hides — so they can experiment with the mechanic without seeing this
answer. Pick a `preset`: `slope_explorer` (drag a point on a different curve to read its slope),
`power_rule` (step through the rule in general form, a·xⁿ → a·n·xⁿ⁻¹), or `riemann` (pile
rectangles under a different curve to watch the area converge). A slope or Riemann sandbox's curve
MUST differ from the question's ([src/lib/validateLesson.ts](src/lib/validateLesson.ts) enforces
this); `power_rule` is purely symbolic, so it needs no fields.

```json
"sandbox": {
  "preset": "slope_explorer",
  "fn": "-x^2 + 4*x",
  "domain": [-1, 5],
  "caption": "Drag the point — the tangent goes flat at the peak. Now find that spot on the real curve."
}
```

The learner still has to transfer the idea to the real instance, so nothing read off the sandbox
gives the answer. Use it where a hands-on mechanic exists; the `power_rule` preset is for
differentiation (it drops exponents), not antiderivatives. Full field list in
[reference.md](reference.md).

### 2. Choice questions need many, close distractors

For any non-free-response answer (`multiple_choice`, `multi_choice`, `match`, `drag_drop`,
`order_list`, `sign_chart`, `select_region`), make the wrong options hard to dismiss.

- Use **4-5 options** for `multiple_choice` (4 is the floor).
- Distractors share the **same form and units** as the key and sit **numerically or
  structurally near** it. Use `3x^2` vs `3x^3` vs `2x`, never `3x^2` vs `"banana"`.
- For `drag_drop` and `match`, add **distractor tiles** so the answer cannot be reached by
  elimination (the bank must exceed the blanks; a `match` distractor may even duplicate a
  correct label).

### 3. Distractors are real mistakes

Every wrong option should be the output of one specific, nameable error a learner actually
makes — not noise.

- Map each distractor to a misconception: power-rule slip (`x^3 -> 3x^3` or `-> x^2`), sign
  error, off-by-one exponent, **confusing `f` with `f'`**, swapping max and min (`+ -> -`
  vs `- -> +`), forgetting `+C`, secant vs tangent, midpoint vs endpoint. The per-topic
  catalog is in [reference.md](reference.md).
- Grading shows **one shared** `feedback.incorrect`, no matter which wrong option was chosen
  (see [src/lib/feedbackEngine.ts](src/lib/feedbackEngine.ts)). Write `incorrect` and `hint` to
  name and correct the **single most likely** mistake, in process terms ("bring the exponent
  down, then reduce it"), not "Wrong." There is no per-option feedback field — do not add one.

### 4. Interaction by default, and it must matter

Favor questions the learner answers *by manipulating something*, and make the manipulation the
substance of the question.

- **Prefer widget-backed answers** (`graph_point`, `predict_point`, `slider`, `tangent_line`,
  `riemann`, `construct_graph`, `paint_intervals`, `select_region`, `sign_chart`, `drag_drop`,
  `match`, `power_term`) over plain `multiple_choice` and `numeric`. The session sampler favors
  interactive questions (`isInteractive` in
  [src/lib/contentLoader.ts](src/lib/contentLoader.ts)), so non-interactive ones appear less.
- **The interaction is the answer** (drag the dot to the maximum) or **directly supports** it.
  For "estimate, then commit", add `explore: true` so the learner can drag a point to
  investigate before committing a separate graded answer.
- **Never decorative.** A graph the learner does not use, or a slider unrelated to the
  question, fails this rule. If the widget does not change how the learner reasons, cut it or
  change the question.

## Pick the interaction

| To test... | Use | Keep it honest with |
|---|---|---|
| Where a feature is (max/min/root/inflection) | `predict_point` or `graph_point` | `pointChoices`; hidden readouts |
| Reading a slope or rate qualitatively | `slider_graph` + `multiple_choice` | `showSlopeValue: false` |
| Applying the power rule to one term | `power_term` | `startCoefficient` / `startExponent` |
| Building a derivative or antiderivative sum | `drag_drop` | distractor tiles in the bank |
| Increasing/decreasing/concavity over a line | `sign_chart` or `paint_intervals` | ask about `f` while showing `f'` |
| Which interval is steepest or flattest | `select_region` | `static` curve, no slope labels |
| Pairing functions with derivatives/antiderivatives | `match` | duplicate-label distractors |
| Convergence of area to the integral | `riemann` | (the widget hides nothing critical) |
| A specific numeric value | `numeric` (last resort) | do not print it in the stem |

## Authoring workflow

```
- [ ] 1. Pick the concept and the one mistake you most want to catch
- [ ] 2. Choose the interaction (table above); prefer hands-on
- [ ] 3. Write the stem with no answer leakage; set the no-giveaway lever
- [ ] 4. Build the answer key plus 4+ misconception distractors (choice questions)
- [ ] 5. Write feedback: correct (process praise), incorrect + hint (name the top mistake)
- [ ] 6. Lesson step? add a worked `solution`. Practice question? skip it
- [ ] 7. Unique id; place in `steps` or `practiceBank`; register a new lesson file if any
- [ ] 8. Run the gate (validate:lessons, then lint/build/test)
```

## Examples

### A. Choice question that cannot be matched (static graph, misconception distractors)

```json
{
  "id": "gs-practice-decreasing",
  "type": "multiple_choice",
  "conceptTag": "graph_shape",
  "content": [
    { "type": "text", "body": "The curve below is the DERIVATIVE $f'(x)$. On which interval is the original function $f$ decreasing?" }
  ],
  "interaction": {
    "graph": {
      "fn": "x^2 - 1",
      "domain": [-2.5, 2.5],
      "yDomain": [-2, 6],
      "xLabel": "x",
      "yLabel": "f'(x)",
      "static": true
    },
    "answer": {
      "type": "multiple_choice",
      "options": ["$-1 < x < 1$", "$x < -1$", "$x > 1$", "$x < -1$ or $x > 1$", "all $x$"],
      "correctIndex": 0
    }
  },
  "feedback": {
    "correct": "Right - f decreases exactly where f' < 0, the dip below the axis on (-1, 1).",
    "incorrect": "f decreases where f' is NEGATIVE, not where f' itself decreases. Read where this curve sits below the x-axis.",
    "hint": "f' < 0 means f is going down. Where is this graph below the x-axis?"
  }
}
```

Why it works: the graph is `static` (no slope readout to copy); every distractor is a real
error (where `f' > 0`, i.e. f increasing; reading `f'` as `f`); the feedback names the most
likely confusion.

### B. Interactive question with the readout hidden (`graph_point`)

```json
{
  "id": "soc-practice-flat-tangent",
  "type": "slider_graph",
  "conceptTag": "secant_tangent",
  "content": [
    { "type": "text", "body": "Tap the point on $f(x) = x^2$ where the tangent line is flat (slope 0)." }
  ],
  "interaction": {
    "graph": {
      "fn": "x^2",
      "domain": [-3, 3],
      "xLabel": "x",
      "yLabel": "f",
      "showTangent": true,
      "showSlopeValue": false,
      "pointChoices": [-2, -1, 0, 1, 2]
    },
    "answer": { "type": "graph_point", "x": 0, "tolerance": 0.25 }
  },
  "feedback": {
    "correct": "Yes - at x = 0 the parabola bottoms out and the tangent is horizontal (f'(0) = 0).",
    "incorrect": "A flat tangent has slope 0. The slope is f'(x) = 2x - find where THAT is zero, not where f is zero.",
    "hint": "The tangent is flat at the very bottom of the parabola."
  }
}
```

Why it works: the learner answers by manipulating the curve; `showSlopeValue: false` plus
`pointChoices` blocks reading-and-matching; the feedback targets the "f = 0 vs f' = 0"
confusion.

### C. Bad to good distractors (derivative of `x^2`, key `2x`)

Bad - only one tempting option:

```json
"options": ["$2x$", "$0$", "$100$", "$x$"]
```

Good - every distractor is a specific slip:

```json
"options": ["$2x$", "$x^2$", "$2x^2$", "$2$"]
```

`x^2` (did not differentiate), `2x^2` (brought the exponent down but did not reduce it), `2`
(reduced the power away entirely). Then `incorrect`: "Bring the 2 down as a factor AND reduce
the power by 1: 2 * x^(2-1) = 2x."

## Anti-patterns

- **Decorative interaction** - a graph or slider the learner never needs to touch.
- **Answer visible in a live readout** - forgetting `showValue` / `showSlopeValue` /
  `showAreaValue: false` on a question whose answer is that very number.
- **Eliminable distractors** - throwaway options (`100`, `banana`) that leave one obvious pick.
- **Restating the answer in the stem** - the prompt should pose the problem, not solve it.
- **Inventing schema fields** - if it is not in [src/types/content.ts](src/types/content.ts),
  it does not exist (there is no per-option feedback).
- **Fewer than 4 `multiple_choice` options, or duplicate step ids.**
- **Adding a `graph` to a self-drawing widget** (`riemann`, `construct_graph`,
  `paint_intervals`, `tangent_line`, `integral_bounds`, `simulate`, `select_region`).
- **Practice questions with a `read` type or a worked `solution`** - practice is interactive
  and solution-free.

## Validate

After authoring, run the gate and require it green:

```bash
npm run validate:lessons
npm run lint && npm run build && npm run test
```

`validate:lessons` runs [scripts/validate-lessons.ts](scripts/validate-lessons.ts) over every
`content/*.json` file. Fix any reported step id before moving on.
