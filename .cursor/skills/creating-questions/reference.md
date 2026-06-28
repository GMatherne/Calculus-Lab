# Question Authoring Reference

Companion to [SKILL.md](SKILL.md). Field names and grading below mirror
[src/types/content.ts](src/types/content.ts) and
[src/lib/feedbackEngine.ts](src/lib/feedbackEngine.ts); the minimums are enforced by
[src/lib/validateLesson.ts](src/lib/validateLesson.ts). When in doubt, read those files — they
are the source of truth.

## Answer types

Each `Step` has `interaction.answer` of one `type`. A graph is required for some types and
forbidden for the self-drawing ones (they render their own plot).

### Choice, match, and ordering (free of a graph)

| type | Key fields | Minimums | Graded correct when | No-giveaway lever |
|---|---|---|---|---|
| `multiple_choice` | `options[]`, `correctIndex` | >= 4 options | chosen index == `correctIndex` | pair with `static` graph; strong distractors |
| `multi_choice` | `parts[{prompt, correctIndex, options?}]`, `options?` | >= 2 parts, each >= 2 options | every row correct | rows are short labels (max/min/neither) |
| `match` | `pairs[{prompt, match}]`, `distractors?` | >= 2 pairs | each prompt holds its `match` (by value) | add `distractors`; labels may duplicate to block elimination |
| `drag_drop` | `prefix?`, `blanks[{accept, connector?}]`, `bank[]` | >= 1 blank; unique bank; `bank` > `blanks` | multiset of signed terms matches (sums are order-free) | extra distractor tiles in the bank |
| `order_list` | `items[]` (correct order), `orderLabel?` | >= 2 unique items | exact order match | rendered shuffled |
| `sign_chart` | `points[]`, `options[]`, `regions[{correctIndex}]`, `variableLabel?` | >= 1 increasing point, >= 2 options, `regions` == `points` + 1 | every region labeled correctly | label `f`'s behavior from an `f'` you reason about |
| `select_region` | `fn`, `domain`, `bands[{from, to, correct?}]`, `multi?` | >= 2 non-overlapping bands; single = exactly 1 correct, multi >= 1 | chosen band(s) match `correct` | `static` curve, no slope labels (self-drawing: no `graph`) |

### Scalar (value and graph) answers

`slider`, `graph_point`, and `predict_point` require a `graph` config; `numeric` does not.

| type | Key fields | Default tolerance | Graded correct when | No-giveaway lever |
|---|---|---|---|---|
| `numeric` | `value`, `tolerance?` | 0.01 | `abs(x - value) <= tol` | no graph needed; prefer a widget; never print `value` |
| `slider` | `value`, `tolerance?` | 0.01 | `abs(x - value) <= tol` | `showValue: false`, `showSlopeValue: false` |
| `graph_point` | `x`, `acceptX?`, `tolerance?` | 0.25 | any target within tol | `pointChoices` / `pointSnap`; hide readouts |
| `predict_point` | `x`, `acceptX?`, `tolerance?`, `reveal{point?,tangent?,vertical?}` | 0.3 | any target within tol | truth is shown only on a correct commit |

### Builders and self-drawing widgets (no `graph` config)

| type | Key fields | Notes / grading |
|---|---|---|
| `power_term` | `coefficient`, `exponent`, `startCoefficient?`, `startExponent?`, `previewPrefix?` | exponent must be integer; `coefficient: 0` grades on the coefficient alone (a vanished term). Set `previewPrefix` to `"F(x) ="` for antiderivative builders |
| `riemann` | `fn`, `a`, `b`, `trueArea`, `targetWithin`, `maxRects?`, `domain?`, `yMax?`, `demo?` | `b > a`; correct when `abs(estimate - trueArea) <= targetWithin`. `demo: true` makes it an ungraded exploration that advances with Continue |
| `construct_graph` | `domain`, `yDomain`, `nodes[{x, tolerance?}]`, exactly one of `targetFn` / `targetY`, `referenceFn?`, `connect?`, `snap?`, tick/label opts | >= 2 nodes; per-node tolerance default 0.4; correct when every node within tol of target |
| `paint_intervals` | `fn`, `domain`, `breakpoints[]`, `correct[bool]`, `prompt?` | breakpoints strictly increasing and inside the domain; `correct` length == `breakpoints` + 1; exact-match grading |
| `tangent_line` | `fn`, `domain`, `x0`, `slope`, `tolerance?` | tolerance default 0.3; the authored `slope` must be within 0.5 of `f'(x0)` or validation fails |
| `integral_bounds` | `fn`, `domain`, `a`, `b`, `tolerance?`, `showAreaValue?` | `b > a`, both inside the domain; tolerance default 0.25; graded sorted. Set `showAreaValue: false` to hide the running area |
| `simulate` | `control: "velocity"`, `match: "control" \| "integral"`, `target` (in `t`), `duration`, `yDomain`, `tolerance?`, `coverage?`, `controlLabel?` | tolerance default 0.5, coverage default 0.85; passes when enough samples land in-band. `match: "integral"` grades the running accumulation |

### Multi-part questions

A `Step` may carry `parts[]` (follow-ups revealed one at a time after Part 1 is cleared). Each
part needs its own `id`, `content`, `interaction.answer`, and `feedback`; a part requires a
`graph` only when its own answer does. The whole chain grades as one question. Parts cannot
nest, and `read` / Riemann-demo steps cannot have parts.

### Concept sandbox (hints-only, ungraded)

`interaction.sandbox` adds a collapsible explorer shown only at the "hints" assistance level. It
is never graded and shares no state with the question, so it teaches the mechanic on a DIFFERENT
example without revealing this answer. Pick one `preset` (or a `graph` escape hatch):

| preset | Renders | Required fields | Different-instance rule |
|---|---|---|---|
| `slope_explorer` | draggable point + tangent + live slope; best for **curves**, where the slope varies | `fn` (opt. `domain`, `xLabel`/`yLabel`) | `fn` != the graded `fn` |
| `rate_explorer` | draggable point on a **straight line** drawing the rise/run (Δy over Δx) triangle + a live "rate of change = Δy / Δx" readout, no tangent; best for line questions | `fn` (a non-flat line; opt. `domain`, `xLabel`/`yLabel`) | `fn` != the graded `fn` |
| `power_rule` | the power rule in general form, a·xⁿ → n(a·xⁿ⁻¹) → a·n·xⁿ⁻¹ | (none) | n/a — purely symbolic, no concrete term |
| `riemann` | drag rectangles under a curve; the estimate converges | `fn`, `a`, `b` (`b > a`) | `fn` != the graded `fn` |

Shared: `caption?` (one-line instruction, inline `$…$` ok). The `graph?` escape hatch takes a full
`GraphConfig` instead of a preset (keep `showSlopeValue` on) and is mutually exclusive with
`preset` — use exactly one source. The `riemann` true area is computed for you. The `power_rule`
preset is for differentiation questions (it drops exponents), not antiderivatives.

## Misconception to distractor catalog

Pick the wrong options (and the targeted `incorrect` / `hint`) from the mistakes learners
actually make for the concept. These map to the course's lessons.

### Derivative meaning and slope of a curve
- Average rate (secant) used where the instantaneous rate (tangent) is asked, or vice versa.
- Reading the function value `f(x)` instead of the slope `f'(x)`.
- Slope sign wrong on a falling stretch (calling a negative slope positive).
- Thinking the derivative at a point equals the y-value at that point.

### Power rule (single term)
- Forgetting to multiply by the exponent: `x^3 -> x^2` (should be `3x^2`).
- Not reducing the exponent: `x^3 -> 3x^3`.
- Dropping the coefficient: `(4x^3)' -> 3x^2` (should be `12x^2`).
- Constant rule: `(7)' -> 7` (should be `0`); `(x)' -> x` (should be `1`).

### Differentiating polynomials
- Differentiating most terms but leaving the constant in.
- Sign slips on negative terms.
- Dropping a term entirely from a sum.

### Graph shape (increasing/decreasing, concavity, inflection)
- Confusing `f`, `f'`, and `f''` (e.g. "f increasing" read off where `f` is high, not where
  `f' > 0`).
- Concave up vs down: wrong sign of `f''`.
- Calling a point where `f' = 0` an inflection point (inflection is a sign change of `f''`).

### Maxima and minima (extrema)
- Assuming `f'(x) = 0` always means an extremum (it can be neither, e.g. `x^3` at 0).
- Swapping max and min: `+ -> -` is a maximum, `- -> +` is a minimum.
- Choosing where `f'` is largest instead of where `f` is largest.
- Reading the graph of `f'` as if it were `f`.

### Integral meaning and area under a curve
- Treating area as the height `f(x)` rather than accumulated area.
- Summing rectangle heights but forgetting the width factor.
- Ignoring sign: net area vs total area for a curve that dips below the axis.

### Riemann sums
- Using endpoints where midpoints are specified (or vice versa).
- Expecting an exact answer from finitely many rectangles instead of an approximation.
- Thinking more rectangles always overshoot (or always undershoot).

### Antiderivatives and integrating polynomials (reverse power rule)
- Forgetting `+C`.
- Not dividing by the new exponent: `x^2 -> x^3` (should be `x^3/3`).
- Off-by-one on the new exponent, or decreasing it (treating the integral like a derivative).

### Fundamental theorem of calculus
- Reversing the order: computing `F(a) - F(b)`.
- Mishandling `d/dx integral_a^x f(t) dt = f(x)` (the derivative undoes the integral).
- Forgetting that the definite integral needs an antiderivative evaluated at both limits.
