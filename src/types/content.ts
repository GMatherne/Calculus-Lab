type StepType =
  | "read"
  | "multiple_choice"
  | "multi_choice"
  | "numeric"
  | "slider_graph"
  | "power_term"
  | "drag_drop"
  | "match"
  | "sign_chart"
  | "order_list"
  | "riemann"
  | "predict"
  | "construct_graph"
  | "paint_intervals"
  | "tangent_line"
  | "integral_bounds"
  | "simulate"
  | "select_region";

type LessonStatus =
  | "not_started"
  | "in_progress"
  | "complete";

interface TextBlock {
  type: "text";
  body: string;
}

interface MathBlock {
  type: "math";
  latex: string;
  display?: boolean;
}

export type ContentBlock = TextBlock | MathBlock;

export interface GraphConfig {
  fn: string;
  domain: [number, number];
  /** Explicit y-axis range. When omitted, the range is derived from the data. */
  yDomain?: [number, number];
  /**
   * Overlay the derivative f'(x) as a second curve on the same axes, so the
   * learner can see how the sign and height of f' line up with where f rises,
   * falls, and turns. Drawn in a distinct color with a small legend. The
   * derivative is computed numerically, so this works for any `fn`. Pair with an
   * explicit `yDomain` when f' grows much faster than f (e.g. a cubic), so f
   * stays readable while the steep parts of f' are clipped to the plot box.
   */
  showDerivative?: boolean;
  fixedPoint?: number;
  sliderLabel?: string;
  showSecant?: boolean;
  showTangent?: boolean;
  /**
   * Draw the tangent at the FIXED point (`fixedPoint`) as a static reference
   * line while the secant slides. Pair with `showSecant` and an `h` slider so
   * the learner can watch the secant converge onto the tangent as h → 0.
   */
  tangentAtFixedPoint?: boolean;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  initialSlider?: number;
  xLabel?: string;
  yLabel?: string;
  /** Override the slope readout label (e.g. "Rate of change"). */
  slopeLabel?: string;
  /**
   * Show the live slope/secant readout. Defaults to on whenever a tangent or
   * secant is drawn. Set false to keep the line visible but hide the number, so
   * a "find the x where the slope is …" question can't be solved by matching.
   */
  showSlopeValue?: boolean;
  /**
   * Draw a rise/run triangle between the secant's two points (the Δy and Δx
   * legs, with labels) and a "Δy / Δx = rate" readout. Set programmatically by
   * the "solve" secant walkthrough after the moving point reaches its target; not
   * authored in lesson content.
   */
  showSecantRiseRun?: boolean;
  /** Show a live "f(x) = value" readout for the current slider position. Defaults to on. */
  showValue?: boolean;
  /**
   * Let the learner drag the moving point directly along the curve (on top of
   * the slider) to explore how the tangent/secant slope changes — an exploratory
   * aid that does NOT grade. Pair it with a separate `multiple_choice`/`numeric`
   * answer for the "estimate, then commit" pattern: the point is a manipulable
   * tool and the authored answer is what's graded. Ignored for
   * slider/graph_point/predict_point answers, which already own the gesture.
   */
  explore?: boolean;
  /**
   * Render the graph as a static, non-interactive illustration: no slider and
   * no live readouts, just the curve (plus any marker/area below). Used to give
   * a relevant visual to questions whose answer is typed, picked, or built
   * rather than read off the graph.
   */
  static?: boolean;
  /**
   * For static illustrations, mark this x on the curve with a dot and a dashed
   * guide down to the x-axis. When `showTangent` is also set, the tangent line
   * is drawn there too. Anchors a question like "the slope at x = 3" without
   * revealing the numeric answer.
   */
  markerX?: number;
  /**
   * For tap-the-point questions, snap the tapped x to the nearest multiple of
   * this value (e.g. 0.5) so the learner can't pick arbitrarily precise points.
   */
  pointSnap?: number;
  /**
   * For tap-the-point questions, render these x-values as discrete, visible dots
   * on the curve. A tap snaps to the nearest dot, so the submitted x is always
   * exactly one of these values (no fuzzy decimals like 2.02). Takes precedence
   * over `pointSnap` when both are set.
   */
  pointChoices?: number[];
  /**
   * Shade the area between the curve and the x-axis, from `areaStart` to the
   * slider's current x. This is the visual for an integral (accumulated area).
   */
  showArea?: boolean;
  /** Left edge of the shaded area. Defaults to the domain minimum. */
  areaStart?: number;
  /** Show a live "area ≈ value" readout. Defaults to on when `showArea` is set. */
  showAreaValue?: boolean;
  /** Override the area readout label (e.g. "Shaded area"). */
  areaLabel?: string;
  /**
   * Render the area readout as a live definite integral instead of the plain
   * "Shaded area ≈ value" text. It typesets ∫ from `areaStart` to the slider's
   * current value of `integrand` dx, so the learner watches the integral
   * notation (with a moving upper limit) update as they drag. The running area
   * is appended as "= value" only when `showAreaValue` isn't false; on "find t"
   * questions, set `showAreaValue: false` to show the live integral while
   * withholding its value, so the readout never gives away the answer. Requires
   * `integrand`; falls back to the plain readout without it.
   */
  areaReadoutMath?: boolean;
  /**
   * LaTeX of the integrand for the `areaReadoutMath` readout, e.g. "x" or
   * "x - 2". The variable of integration is x and the upper limit is the
   * slider's current value.
   */
  integrand?: string;
}

export interface MultipleChoiceAnswer {
  type: "multiple_choice";
  options: string[];
  correctIndex: number;
}

/**
 * One row inside a {@link MultiChoiceAnswer}: a short prompt (e.g. an x-value)
 * plus the index of its correct option. Options come from this row's own
 * `options`, falling back to the answer's shared `options` when omitted.
 */
export interface MultiChoicePart {
  /** Short label for this row, e.g. "x = 0". Rendered with inline math ($…$). */
  prompt: string;
  /** Index (into the row's effective options) of the correct choice. */
  correctIndex: number;
  /** Options for this row; defaults to the answer's shared `options`. */
  options?: string[];
}

/**
 * A stack of independent multiple-choice rows graded as a single question: each
 * row (e.g. one x-value) is answered on its own, and the step is correct only
 * when every row is correct. Set the shared `options` for the common case where
 * every row picks from the same labels (e.g. "Maximum" / "Minimum" / "Neither");
 * a row may override them with its own `options`. The submitted answer is an
 * array of chosen option indices, one per row (null where a row is unanswered).
 */
export interface MultiChoiceAnswer {
  type: "multi_choice";
  /** Default options shared by every row that doesn't define its own. */
  options?: string[];
  /** The independent rows, in display order. */
  parts: MultiChoicePart[];
}

interface NumericAnswer {
  type: "numeric";
  value: number;
  tolerance?: number;
}

/**
 * Drag-the-slider question: the learner moves the graph slider until a
 * condition is met. The submitted answer is the slider's value.
 */
interface SliderAnswer {
  type: "slider";
  value: number;
  tolerance?: number;
}

/**
 * Tap-the-point question: the learner clicks a location on the curve. The
 * submitted answer is the x-coordinate of the tap.
 */
interface GraphPointAnswer {
  type: "graph_point";
  x: number;
  /**
   * Extra x-values that also count as correct, each judged with the same
   * `tolerance` as `x`. Use when several points satisfy the prompt — e.g. for
   * f′(x) = 3x² = 12 both x = 2 and x = -2 have a tangent slope of 12.
   */
  acceptX?: number[];
  tolerance?: number;
}

/**
 * What a {@link PredictPointAnswer} draws once the learner commits a guess. The
 * truth is rendered at the correct x, so a committed prediction — right or wrong
 * — is followed by seeing the actual feature. At minimum the point is shown.
 */
export interface PredictReveal {
  /** Draw a dot at the true point (x, f(x)). Defaults to true. */
  point?: boolean;
  /** Draw the tangent line at the true x (e.g. the flat tangent at a peak/valley). */
  tangent?: boolean;
  /** Draw a dashed vertical guide at the true x down to the axis. */
  vertical?: boolean;
}

/**
 * "Predict, then reveal" question: the learner DRAGS a marker along the curve to
 * predict where a feature occurs (a maximum, a minimum, an inflection, or where
 * the slope hits a target), then commits. On a correct commit the true location
 * is drawn with a short reveal animation, confirming the guess. The submitted
 * answer is the marker's x-coordinate, graded exactly like {@link GraphPointAnswer}:
 * any listed x within tolerance counts. Unlike `graph_point` (a single discrete
 * tap), the marker is dragged continuously and the answer is genuinely predicted
 * before the reveal. A `predict` step needs a graph config.
 */
export interface PredictPointAnswer {
  type: "predict_point";
  /** Correct x-coordinate of the predicted feature. */
  x: number;
  /** Extra x-values that also count as correct, judged with the same tolerance. */
  acceptX?: number[];
  /** Half-width of the accepted window around each target (default 0.3). */
  tolerance?: number;
  /** What to draw when a correct prediction is revealed. */
  reveal: PredictReveal;
}

/**
 * "Derivative builder" question: the learner assembles a single power term
 * a·xⁿ with a coefficient stepper and an exponent stepper, applying the power
 * rule by hand instead of typing or picking the answer. The submitted answer is
 * the `{ coefficient, exponent }` pair. A coefficient of 0 collapses the whole
 * term to 0 (e.g. the derivative of a constant), so the exponent is ignored when
 * grading that case.
 *
 * Setting {@link denominator} switches the builder into a fraction mode for the
 * reverse power rule: the coefficient becomes the numerator of a fraction over
 * {@link denominator}, the builder shows three steppers (numerator, denominator,
 * exponent), and the preview renders a/b·xⁿ. The antiderivative of a·xⁿ is
 * (a)/(n+1)·xⁿ⁺¹, so the denominator and the new exponent are both n+1 — a nice
 * structural cue. In fraction mode the submitted answer is the
 * `{ coefficient, denominator, exponent }` triple and all three must match.
 */
interface PowerTermAnswer {
  type: "power_term";
  coefficient: number;
  exponent: number;
  /**
   * Denominator of the fraction coefficient. When set, the builder runs in
   * fraction mode (numerator/denominator/exponent), e.g. ∫5x² dx = 5/3·x³ is
   * `{ coefficient: 5, denominator: 3, exponent: 3 }`. Must be a positive
   * integer. Omit for the plain integer-coefficient derivative/antiderivative
   * builder.
   */
  denominator?: number;
  /** Coefficient (numerator in fraction mode) shown before editing — usually the original term's. */
  startCoefficient?: number;
  /** Exponent shown in the builder before editing — usually the original power. */
  startExponent?: number;
  /** Denominator shown before editing in fraction mode (defaults to 1, i.e. the bare term). */
  startDenominator?: number;
  /**
   * LaTeX prefix for the live preview of the term being built. Defaults to
   * "f'(x) =" for a derivative builder; set to "F(x) =" when the learner is
   * building an antiderivative via the reverse power rule.
   */
  previewPrefix?: string;
  /**
   * Append a static "+ C" (the constant of integration) to the preview, marking
   * the built term as the full indefinite integral. Display only — the learner
   * never edits or grades it. Set on antiderivative builders; omit (or false)
   * for derivative builders.
   */
  plusC?: boolean;
}

/** One blank in a {@link DragDropAnswer}, filled by dragging a tile from the bank. */
interface DragDropBlank {
  /**
   * LaTeX of the tile that correctly fills this blank. Must appear verbatim in
   * the answer's `bank`.
   */
  accept: string;
  /**
   * Operator rendered just before this blank, e.g. "+" or "-". Ignored on the
   * first blank. Defaults to "+", so a sum of positive terms needs no connectors.
   */
  connector?: string;
}

/**
 * Drag-and-drop "assemble the answer" question: the learner drags term tiles
 * from a shared bank into ordered blanks to build an expression — e.g. the
 * derivative of a polynomial, one term per blank. Tiles are LaTeX strings, and
 * the bank holds every correct tile plus distractors (shuffled when rendered).
 * The submitted answer is the array of placed tile values, one entry per blank
 * (null where a blank is still empty).
 *
 * Grading compares the multiset of *signed* terms, not their positions, so a sum
 * can be built in any order (addition is commutative). Each blank's sign is the
 * operator fixed in front of it, so a term in a "-" slot is treated as negative
 * — keeping subtraction order-sensitive while pure sums are order-free.
 */
export interface DragDropAnswer {
  type: "drag_drop";
  /** LaTeX shown to the left of the blanks, e.g. "f'(x) =". Optional. */
  prefix?: string;
  /** The ordered blanks the learner fills, left to right. */
  blanks: DragDropBlank[];
  /**
   * Full pool of draggable tiles (LaTeX). Must include each blank's `accept`
   * value plus at least one distractor, with no duplicate entries.
   */
  bank: string[];
}

/**
 * One row in a {@link MatchAnswer}: a fixed left-hand prompt and the LaTeX of
 * the right-hand option that correctly matches it (e.g. a function paired with
 * its antiderivative).
 */
interface MatchPair {
  /** Left-hand item shown in fixed order, e.g. "$x^2$". Rendered with inline math ($…$). */
  prompt: string;
  /**
   * LaTeX of the right-hand option that matches this prompt. Values may repeat
   * across pairs — two prompts can legitimately share the same correct answer.
   * Grading is positional (by value), so each prompt is checked against its own
   * `match` regardless of any duplicates in the bank.
   */
  match: string;
}

/**
 * "Match the pairs" question: the learner pairs each fixed left-hand prompt with
 * one right-hand option (e.g. each function with its antiderivative). The option
 * bank holds one tile per pair's `match` plus one per distractor, shuffled when
 * rendered, and each tile can be used at most once. Tiles may share a label
 * (the widget tracks them by id), so the bank can offer plausible duplicate
 * answers. The submitted answer is an array of chosen option values, one per
 * prompt by position (null where a prompt is still unmatched). Graded by
 * position: every prompt must hold its own `match`.
 */
export interface MatchAnswer {
  type: "match";
  /** The pairs to match, with prompts shown in this order. */
  pairs: MatchPair[];
  /**
   * Extra options (LaTeX) mixed into the bank as distractors, so the answer
   * can't be reached purely by elimination. Labels may repeat and may even
   * mirror a pair's `match` (e.g. a second "2" alongside the correct "2" so a
   * sibling prompt can't be solved by process of elimination); each distractor
   * still adds exactly one extra tile to the bank.
   */
  distractors?: string[];
}

/** One interval in a {@link SignChartAnswer}. */
interface SignChartRegion {
  /** Index into the answer's shared `options` that correctly labels this interval. */
  correctIndex: number;
}

/**
 * "Sign chart" question: the learner reads the behavior of a quantity (usually
 * f') across a number line split by its critical points and labels every
 * interval — e.g. tagging each stretch "Increasing" or "Decreasing". This is the
 * standard hands-on tool for analyzing where a function rises and falls. The
 * critical x-values in `points` are shown as labeled ticks, and the intervals
 * between and beyond them are the regions, so there is always exactly one more
 * region than there are points. The submitted answer is an array of chosen
 * option indices, one per region in left-to-right order (null where a region is
 * still unlabeled); graded by position, every region must hold its correct label.
 */
export interface SignChartAnswer {
  type: "sign_chart";
  /** Critical x-values dividing the line, in increasing order (display only). */
  points: number[];
  /** Labels every region picks from, e.g. ["Increasing", "Decreasing"]. */
  options: string[];
  /** One entry per region (points.length + 1), left to right. */
  regions: SignChartRegion[];
  /** Optional caption for what's being analyzed, e.g. "Sign of f'(x)". */
  variableLabel?: string;
}

/**
 * "Put in order" question: the learner drags shuffled items into the right
 * sequence — the steps of a computation, or values sorted least-to-greatest, for
 * example. The authored `items` are listed in their CORRECT order and rendered
 * shuffled; the submitted answer is the current ordering (the item strings),
 * graded by an exact match against the authored order.
 */
export interface OrderListAnswer {
  type: "order_list";
  /** Items in their correct order; rendered shuffled. Each supports inline $…$ math. */
  items: string[];
  /** Optional instruction, e.g. "Order the steps from first to last". */
  orderLabel?: string;
}

/**
 * Interactive Riemann-sum question: the learner drags a slider to pile more
 * rectangles under a curve and watches the running estimate close in on the true
 * area, feeling the limit that defines the integral. The submitted answer is the
 * rectangle count n; it grades correct once the midpoint estimate lands within
 * `targetWithin` of `trueArea`, so the learner has to refine the approximation by
 * hand. The widget draws the curve, the rectangles, and the live readouts itself,
 * so a Riemann step needs no separate `graph` config.
 */
export interface RiemannAnswer {
  type: "riemann";
  /**
   * Present this Riemann widget as an ungraded demonstration rather than a graded
   * question: the learner still drags to pile on rectangles and watch the estimate
   * converge, but the step advances with a "Continue" button (like a read step) and
   * never counts toward concept mastery. Pair it with a follow-up question that
   * checks comprehension. See {@link isRiemannDemo}.
   */
  demo?: boolean;
  /** Curve to integrate, a math.js expression in x (e.g. "x^2"). */
  fn: string;
  /** Left endpoint of the integration interval. */
  a: number;
  /** Right endpoint of the integration interval (must exceed `a`). */
  b: number;
  /** Exact area over [a, b], used for the readout and to grade convergence. */
  trueArea: number;
  /** Correct once |estimate − trueArea| ≤ this (must be positive). */
  targetWithin: number;
  /** Largest rectangle count the slider allows (default 40). */
  maxRects?: number;
  /** Plot window; defaults to [a, b]. Widen it to leave margin around the interval. */
  domain?: [number, number];
  /** Explicit y-axis maximum; defaults to the curve's peak across the domain. */
  yMax?: number;
}

/** One draggable node in a {@link ConstructGraphAnswer}: fixed in x, free in y. */
export interface ConstructGraphNode {
  /** Fixed x-position of this node on the plot. */
  x: number;
  /** Half-width of the accepted y-window when grading this node (default 0.4). */
  tolerance?: number;
}

/**
 * "Construct the graph" question: the learner drags a row of points — each
 * pinned at a fixed x, free to move in y — to build a curve, e.g. plotting the
 * derivative f'(x) at several sample x-values. The points connect into a
 * polyline preview so the shape emerges as they drag. The submitted answer is
 * the array of chosen y-values (one per node, null until first moved); it grades
 * correct when every node sits within its tolerance of the target y. The target
 * comes from `targetFn` evaluated at the node's x (e.g. "2*x" for the derivative
 * of x^2) or, failing that, from the matching entry in `targetY`. The widget
 * draws its own axes, so a construct_graph step needs no separate `graph` config.
 */
export interface ConstructGraphAnswer {
  type: "construct_graph";
  /** Plot domain [x-min, x-max]. */
  domain: [number, number];
  /** Plot range [y-min, y-max]; also the bounds each node can be dragged within. */
  yDomain: [number, number];
  /** Draggable nodes in display order, each fixed in x. */
  nodes: ConstructGraphNode[];
  /**
   * Target curve evaluated at each node's x to grade it (a math.js expression in
   * x). Mutually exclusive with {@link targetY}; provide exactly one.
   */
  targetFn?: string;
  /** Explicit target y per node, in the same order as {@link nodes}. */
  targetY?: number[];
  /** Faint reference curve drawn behind the nodes, e.g. the original f. */
  referenceFn?: string;
  /** Connect the placed nodes with a polyline. Defaults to true. */
  connect?: boolean;
  /** Snap each dragged y to this grid step (e.g. 0.5). Free drag when omitted. */
  snap?: number;
  /**
   * Gridline/label spacing on the x-axis. Overrides the auto "nice" step so the
   * plot can show more specific ticks (e.g. every 1 unit). Auto when omitted.
   */
  xTickStep?: number;
  /** Gridline/label spacing on the y-axis. Auto "nice" step when omitted. */
  yTickStep?: number;
  /** Axis labels. Default to "x" and "y". */
  xLabel?: string;
  yLabel?: string;
}

/**
 * "Paint the intervals" question: the learner drags across the plot to shade the
 * segments where some condition holds — e.g. where f is increasing, or concave
 * up. The domain is split into contiguous segments by `breakpoints` (so there is
 * always one more segment than there are breakpoints), and the learner brushes
 * segments on or off with a pointer drag. The submitted answer is a boolean per
 * segment in left-to-right order; it grades correct on an exact match against
 * `correct`. The widget draws its own curve and axis, so a paint_intervals step
 * needs no separate `graph` config.
 */
export interface PaintIntervalsAnswer {
  type: "paint_intervals";
  /** Curve drawn behind the segments (a math.js expression in x). */
  fn: string;
  /** Plot domain [x-min, x-max]. */
  domain: [number, number];
  /** Explicit y-range; auto-fit to the curve when omitted. */
  yDomain?: [number, number];
  /** Interior x-values dividing the domain; segments = breakpoints.length + 1. */
  breakpoints: number[];
  /** Which segments should be shaded (true), one per segment, left to right. */
  correct: boolean[];
  /** Short instruction shown under the plot, e.g. "Shade where f is increasing". */
  prompt?: string;
  /** Axis labels. Default to "x" and "y". */
  xLabel?: string;
  yLabel?: string;
}

/** One selectable vertical band in a {@link SelectRegionAnswer}. */
export interface SelectRegionBand {
  /** Left x-edge of the band. */
  from: number;
  /** Right x-edge of the band (must exceed `from`). */
  to: number;
  /**
   * Whether tapping this band is a correct choice. A single-select question has
   * exactly one correct band; a multi-select question grades an exact match of
   * every band's selected state against its `correct` flag.
   */
  correct?: boolean;
}

/**
 * "Select the region" question: vertical bands are overlaid on a static curve
 * and the learner taps the one — or, with `multi`, the several — that satisfy a
 * property, e.g. the stretch where the curve is steepest, flattest, or concave
 * up. It's visual multiple-choice over intervals of the plot, distinct from
 * {@link PaintIntervalsAnswer} (brush every segment on/off to an exact pattern)
 * and {@link SignChartAnswer} (label every region). The submitted answer is the
 * chosen band index for single-select, or a boolean per band for multi-select.
 * The widget draws its own curve, so a select_region step needs no `graph`.
 */
export interface SelectRegionAnswer {
  type: "select_region";
  /** Curve drawn behind the bands (a math.js expression in x). */
  fn: string;
  /** Plot domain [x-min, x-max]. */
  domain: [number, number];
  /** Explicit y-range; auto-fit to the curve when omitted. */
  yDomain?: [number, number];
  /** Selectable bands, left to right; they should tile the plot without overlapping. */
  bands: SelectRegionBand[];
  /** Allow choosing several bands, graded as an exact set match. Default false (single-select). */
  multi?: boolean;
  /** Short instruction shown under the plot, e.g. "Tap the steepest stretch". */
  prompt?: string;
  /** Axis labels. Default to "x" and "y". */
  xLabel?: string;
  yLabel?: string;
}

/**
 * "Rotate the tangent" question: a line is pinned to the curve at a fixed point
 * (x0, f(x0)) and the learner drags to rotate it about that pivot until its slope
 * matches the curve's slope there. The submitted answer is the line's slope; it
 * grades correct when |slope - spec.slope| <= tolerance. Unlike a slider (one
 * value on a track), this is a genuine rotate-about-a-pivot gesture. The widget
 * draws its own curve, so a tangent_line step needs no separate `graph` config.
 */
export interface TangentLineAnswer {
  type: "tangent_line";
  /** Curve (a math.js expression in x). */
  fn: string;
  /** Plot domain [x-min, x-max]. */
  domain: [number, number];
  /** Explicit y-range; auto-fit to the curve when omitted. */
  yDomain?: [number, number];
  /** Fixed x the tangent line pivots through. */
  x0: number;
  /** Correct slope at x0 (i.e. f'(x0)). */
  slope: number;
  /** Half-width of the accepted slope window (default 0.3). */
  tolerance?: number;
  xLabel?: string;
  yLabel?: string;
}

/**
 * "Set the bounds" question: the learner drags two vertical handles to place the
 * lower and upper limits a, b of a definite integral, shading the area between
 * them as they go. The submitted answer is `{ a, b }` (graded sorted, so the
 * handles may be dragged in either order); it grades correct when each bound is
 * within tolerance of its target. The widget draws its own curve and the live
 * shaded area, so an integral_bounds step needs no separate `graph` config.
 */
export interface IntegralBoundsAnswer {
  type: "integral_bounds";
  /** Curve to integrate (a math.js expression in x). */
  fn: string;
  /** Plot domain [x-min, x-max]. */
  domain: [number, number];
  /** Explicit y-range; auto-fit to the curve when omitted. */
  yDomain?: [number, number];
  /** Correct lower limit. */
  a: number;
  /** Correct upper limit (must exceed a). */
  b: number;
  /** Half-width of the accepted window for each bound (default 0.25). */
  tolerance?: number;
  /** Show the live "area ≈ value" readout. Defaults to true. */
  showAreaValue?: boolean;
  xLabel?: string;
  yLabel?: string;
}

/**
 * "Drive the value" question: a playhead sweeps left-to-right across [0, duration]
 * while the learner moves the pointer up and down to set a "pen" height at the
 * playhead, tracing a curve in real time. With match: "control" the trace itself
 * is graded against the target; with match: "integral" the graded (and plotted)
 * curve is the running accumulation of the pen value — e.g. holding a velocity to
 * trace out position, the core calculus payoff. With match: "derivative" the
 * learner instead reads the slope of a shown {@link referenceFn} f(t) and drives
 * their rate estimate to match its derivative — a "speedometer" for f. The driven
 * value is graded directly against `target` (the true f'), and the dashed target
 * is hidden until the run ends so it can't simply be traced. The submitted answer
 * is the trace resampled to evenly spaced points (an array of y-values); it grades
 * correct when the fraction of samples landing within `tolerance` of the target is
 * at least `coverage`. The widget draws its own plot, so a simulate step needs no
 * separate `graph` config.
 */
export interface SimulateAnswer {
  type: "simulate";
  /** What the learner's hand feeds (currently a single driven value). */
  control: "velocity";
  /**
   * How the pen input becomes the graded/plotted curve: `control` grades the pen
   * trace itself, `integral` grades its running accumulation (drive a rate, watch
   * the quantity build), and `derivative` grades the pen as a rate estimate read
   * off {@link referenceFn} (drive the slope of a shown curve).
   */
  match: "control" | "integral" | "derivative";
  /** Target curve as a function of t (a math.js expression in t). */
  target: string;
  /** Run length in seconds (must be positive). */
  duration: number;
  /** Plot y-range, which is also the pen's reachable range. */
  yDomain: [number, number];
  /** Vertical band half-width for "in-band" credit (default 0.5). */
  tolerance?: number;
  /** Fraction of samples that must be in-band to pass, in (0, 1] (default 0.85). */
  coverage?: number;
  /** Label for the driven value, e.g. "Throttle". */
  controlLabel?: string;
  xLabel?: string;
  yLabel?: string;
  /**
   * Source curve f(t) drawn faintly for context in `derivative` mode — the curve
   * whose slope the learner reads while driving the rate. A math.js expression in
   * t. Ignored by the other modes.
   */
  referenceFn?: string;
  /** Legend label for {@link referenceFn} (default "the curve"). */
  referenceLabel?: string;
}

export type AnswerSpec =
  | MultipleChoiceAnswer
  | MultiChoiceAnswer
  | NumericAnswer
  | SliderAnswer
  | GraphPointAnswer
  | PredictPointAnswer
  | PowerTermAnswer
  | DragDropAnswer
  | MatchAnswer
  | SignChartAnswer
  | OrderListAnswer
  | RiemannAnswer
  | ConstructGraphAnswer
  | PaintIntervalsAnswer
  | TangentLineAnswer
  | IntegralBoundsAnswer
  | SimulateAnswer
  | SelectRegionAnswer;

/**
 * An ungraded "concept sandbox": a hints-only teaching aid that lets the learner
 * experiment with the mechanic behind a question on a DIFFERENT example, with
 * the readout the real question hides (e.g. the slope) switched on. It is never
 * graded and shares no state with the graded widget, so it teaches the move
 * without revealing this question's answer — the learner must still transfer
 * what they see back to the real instance. Author it with a {@link Sandbox.preset}
 * (the cheap path) or a full {@link Sandbox.graph} (the escape hatch).
 */
export interface Sandbox {
  /** Short instruction, e.g. "Drag the point — where does the slope go flat?" Supports inline `$…$` math. */
  caption?: string;
  /**
   * Ready-made explorer, each expanding to a self-contained widget with the
   * relevant readout switched on:
   * - `slope_explorer` — a draggable point + tangent + live slope; needs
   *   {@link Sandbox.fn} (and optional {@link Sandbox.domain}).
   * - `shape_explorer` — a draggable point on a curve with its derivative f′
   *   overlaid and the tangent slope shown live, so the learner feels how the
   *   sign of f′ (and the bend of the curve) tracks where f rises, falls, and
   *   turns; needs {@link Sandbox.fn} (and optional {@link Sandbox.domain}).
   * - `power_rule` — steps through the power rule in general form,
   *   a·xⁿ → n(a·xⁿ⁻¹) → a·n·xⁿ⁻¹, with no concrete term (so it can't reveal an answer).
   * - `reverse_power_rule` — steps through the reverse power rule in general form,
   *   ∫a·xⁿ dx → a·xⁿ⁺¹/(n+1) + C, again with no concrete term; the antiderivative
   *   mirror of `power_rule`.
   * - `riemann` — drag rectangles under a curve to watch the estimate converge;
   *   needs {@link Sandbox.fn} and the interval {@link Sandbox.a}/{@link Sandbox.b}.
   * - `area_explorer` — drag the upper limit of a shaded region and watch the
   *   accumulated area grow as a live integral, so "the integral is accumulated
   *   area" is something you sweep out by hand; needs {@link Sandbox.fn} and the
   *   interval {@link Sandbox.a}/{@link Sandbox.b}.
   * - `ftc_explorer` — drag the two limits a, b of a definite integral and watch
   *   the signed area between them update, the geometry behind F(b) − F(a); needs
   *   {@link Sandbox.fn} and the interval {@link Sandbox.a}/{@link Sandbox.b}.
   */
  preset?:
    | "slope_explorer"
    | "shape_explorer"
    | "power_rule"
    | "reverse_power_rule"
    | "riemann"
    | "area_explorer"
    | "ftc_explorer";
  /**
   * Curve for the curve-based presets (`slope_explorer`, `shape_explorer`,
   * `riemann`, `area_explorer`, `ftc_explorer`) — a math.js expression in x. MUST
   * differ from the graded graph's `fn`, so nothing read off the sandbox
   * transfers as the answer.
   */
  fn?: string;
  /** Plot domain for the curve-based presets; a sensible default window is used when omitted. */
  domain?: [number, number];
  /** Axis labels for the curve-based presets. Default to "x" and "y". */
  xLabel?: string;
  yLabel?: string;
  /**
   * Interval [a, b] the interval presets use: the slice for `riemann`, the area
   * span (lower fixed at `a`, upper dragged toward `b`) for `area_explorer`, and
   * the starting bounds for `ftc_explorer` (the curve comes from {@link Sandbox.fn}).
   */
  a?: number;
  b?: number;
  /**
   * LaTeX integrand shown in the `area_explorer` live integral readout, e.g. "x"
   * or "x + 1". Defaults to {@link Sandbox.fn} with `*` stripped when omitted.
   */
  integrand?: string;
  /**
   * Escape hatch: a fully-specified explorer plot used instead of a {@link Sandbox.preset}.
   * Turn on the readout the question hides (e.g. `showSlopeValue: true`) and set
   * `explore: true` so the point can be scrubbed.
   */
  graph?: GraphConfig;
}

interface Interaction {
  graph?: GraphConfig;
  answer?: AnswerSpec;
  /**
   * Optional hints-only {@link Sandbox}: an ungraded explorer on a DIFFERENT
   * example, shown collapsed beside the question when the learner has the
   * "hints" assistance level on. Never graded and never shares state with the
   * graded widget.
   */
  sandbox?: Sandbox;
  /** Hints shown after this many wrong attempts (default 2; lesson 1 uses 1) */
  hintAfterAttempts?: number;
  /**
   * Opt into continuous ("live") grading: the step is judged by the same
   * {@link checkAnswer} on every manipulation and confirms the instant the
   * answer is satisfied — no separate "Check Answer" press. Supported for the
   * distance-based answers (`slider`, `numeric`, `graph_point`); other types
   * fall back to the classic submit flow. Off by default, so existing content is
   * unchanged.
   */
  liveCheck?: boolean;
  /**
   * Short instruction shown for a live or predict step, e.g. "Drag x until the
   * tangent is flat" or "Drag the dot to the maximum". Purely presentational.
   */
  goalLabel?: string;
}

export interface StepFeedback {
  correct: string;
  incorrect: string;
  hint: string;
}

/**
 * How much help a learner wants on a question, chosen per question via the
 * assistance toggle (guidance fading / expertise reversal):
 * - `solve` — we work the problem and explain *why*, pre-filling the answer.
 *   Offered on lesson questions only and never counts toward first-try mastery.
 * - `hints` — visual/text hints are available to guide the learner.
 * - `none` — no hints at all; the learner is on their own.
 */
export type AssistanceLevel = "solve" | "hints" | "none";

/**
 * "Rate of change between two points" walkthrough animation: in the "solve"
 * level, draw a secant between a fixed point at `a` and a second point at `b`,
 * sliding the second point out so the learner sees the rate of change (the
 * secant's slope) — which equals the derivative for a line.
 */
export interface SecantSolveAnimation {
  kind: "secant";
  /** x of the first (fixed) point. */
  a: number;
  /** x of the second point the secant is drawn to. */
  b: number;
  /** Readout label; defaults to "Rate of change". */
  label?: string;
  /**
   * Caption beats the learner steps through manually. Beat 0 draws the secant
   * between the two points; later beats add the rise/run (Δy / Δx) breakdown.
   * Defaults to a two-beat intro + rise/run when omitted.
   */
  captions?: string[];
}

/** One captioned beat of a {@link NarratedSolveAnimation}. */
export interface NarratedPhase {
  /** Caption banner shown during this phase (supports inline `$…$` math). */
  text: string;
  /**
   * Animate the graph's slider value to this over the phase. For tangent graphs
   * it's the x-position; for secant graphs (sliderLabel "h") it's h. Omit to
   * hold the graph still and just show the caption.
   */
  to?: number;
  /** Phase length in ms (default 1900). */
  ms?: number;
}

/**
 * A narrated walkthrough: a sequence of captioned phases that may drive the
 * graph's slider (rotating a tangent, shrinking a secant, …), explaining what to
 * look at, then reveals the answer and the full worked solution. Used for the
 * Slope of a Curve graph questions.
 */
export interface NarratedSolveAnimation {
  kind: "narrated";
  phases: NarratedPhase[];
  /**
   * Force the slope readout on during the walkthrough even when the question
   * hides it (e.g. a "find x where the slope is …" step).
   */
  showSlopeValue?: boolean;
  /**
   * Force the accumulated-area (integral) readout on during the walkthrough, so
   * the learner watches the integral's value climb to its target as the slider
   * tweens — used for the area-accumulation steps in lessons 7-10.
   */
  showAreaValue?: boolean;
  /**
   * Draw this feature once the narration finishes — e.g. the flat tangent at the
   * answer for a tap-the-point question that has no slider to animate.
   */
  reveal?: { x: number; point?: boolean; tangent?: boolean; vertical?: boolean };
  /**
   * Optionally play the compact power-rule "exponent drop" animation alongside
   * the narration — e.g. x³ → 3x² above the graph — so the symbolic rule and the
   * geometric slope resolve together. The term is a·xⁿ.
   */
  powerTerm?: PowerRuleTerm;
  /**
   * Optionally play the term-by-term polynomial "sum" animation, advanced one
   * term per beat in sync with {@link phases}: beat i drops `terms[i]`
   * (a·xⁿ → a·n·xⁿ⁻¹), and the final beat shows the assembled f'(x). Author one
   * phase per term plus a final "add the pieces" phase, so `phases.length` is
   * `terms.length + 1`.
   */
  terms?: PowerRuleTerm[];
}

/**
 * "Power rule" walkthrough animation: dramatize differentiating a single power
 * term, a·xⁿ → (a·n)·xⁿ⁻¹. The exponent visibly drops down in front, multiplies
 * the coefficient, and the power reduces by one; a constant (xⁿ with n = 0)
 * collapses to 0. The source and result term are read from the step's
 * `power_term` answer (`startCoefficient`/`startExponent` → `coefficient`/
 * `exponent`), so a graded step opts in with just `{ kind: "power_rule" }`.
 */
export interface PowerRuleSolveAnimation {
  kind: "power_rule";
  /**
   * Optional caption overrides shown in the solve caption banner as the beats
   * play, indexed by beat: 0 bring-down, 1 multiply, 2 product, 3 reduce,
   * 4 settle. Supports inline `$…$` math. Sensible defaults fill any gaps.
   */
  captions?: string[];
}

/**
 * "Differentiate a polynomial" walkthrough: the sum rule and power rule together.
 * The source polynomial f(x) is shown on top, and f'(x) is assembled below one
 * term at a time — each source term a·xⁿ drops to (a·n)·xⁿ⁻¹ on its own beat, and
 * a constant fades away. Authored on a step (e.g. a drag_drop derivative builder)
 * with the source `terms` in display order; one beat per term plus a final
 * "add the pieces" beat, so the walkthrough has `terms.length + 1` beats.
 */
export interface PolynomialSolveAnimation {
  kind: "polynomial";
  /** Source terms of f(x), in display order (a·xⁿ each). */
  terms: PowerRuleTerm[];
  /**
   * Optional caption overrides shown in the solve caption banner, indexed by
   * beat: one per term, then a final assembly beat. Supports inline `$…$` math.
   */
  captions?: string[];
}

/**
 * "Integrate a polynomial" walkthrough: the reverse power rule, term by term. The
 * source polynomial f(x) is shown on top, and the antiderivative F(x) is
 * assembled below one term at a time — each source term a·xⁿ becomes
 * a/(n+1)·xⁿ⁺¹ on its own beat (a constant c becomes c·x). Authored with the
 * source `terms`; one beat per term plus a final "add the pieces" beat, so the
 * walkthrough has `terms.length + 1` beats. Shares its component with
 * {@link PolynomialSolveAnimation} via a direction flag.
 */
export interface AntiderivativeSolveAnimation {
  kind: "antiderivative";
  /** Source terms of f(x), in display order (a·xⁿ each); the animation builds F(x). */
  terms: PowerRuleTerm[];
  /**
   * Optional caption overrides shown in the solve caption banner, indexed by
   * beat: one per term, then a final assembly beat. Supports inline `$…$` math.
   */
  captions?: string[];
}

/**
 * "Riemann sum refinement" walkthrough: slice the region under a curve into
 * rectangles and multiply them beat by beat (a few wide ones → many thin ones),
 * watching the running estimate close in on the true area — the integral as a
 * limit of sums. Used for the limit-concept multiple-choice steps in lessons
 * 7-8, which carry no graph of their own, so the curve/interval live here.
 */
export interface RiemannRefineSolveAnimation {
  kind: "riemann_refine";
  /** Curve to slice, as an expression in x (e.g. "x^2"). */
  fn: string;
  /** Lower and upper limits of the region. */
  a: number;
  b: number;
  /** The exact area, shown alongside the converging estimate. */
  trueArea: number;
  /** Plot domain; defaults to [a, b]. */
  domain?: [number, number];
  /** Rectangle counts shown per beat; defaults to a sensible refining sequence. */
  counts?: number[];
  /** Optional caption overrides shown in the solve caption banner, indexed by beat. */
  captions?: string[];
}

/**
 * "Evaluate a definite integral" walkthrough: first build the antiderivative
 * F(x) from the integrand's terms (the same term-by-term reverse-power-rule drop
 * as {@link AntiderivativeSolveAnimation}), then plug in the limits and compute
 * F(b) − F(a). Lets a definite-integral question show both halves of the
 * Fundamental Theorem play out — find F, then subtract its endpoint values —
 * instead of a plain slider sweep. The `terms` are the integrand a·xⁿ in display
 * order; `a`/`b` are the lower/upper limits.
 */
export interface FtcEvaluateSolveAnimation {
  kind: "ftc_evaluate";
  /** Integrand terms a·xⁿ, in display order; the animation builds F(x) from them. */
  terms: PowerRuleTerm[];
  /** Lower limit of the definite integral. */
  a: number;
  /** Upper limit of the definite integral (the area runs a → b). */
  b: number;
  /** Optional caption overrides for the term-build beats, indexed by term. */
  captions?: string[];
}

/**
 * An optional, hand-authored animation played during the "solve" walkthrough,
 * specific to a problem rather than the generic slider sweep. Extensible: more
 * recipes can join this union.
 */
export type SolveAnimation =
  | SecantSolveAnimation
  | NarratedSolveAnimation
  | PowerRuleSolveAnimation
  | PolynomialSolveAnimation
  | AntiderivativeSolveAnimation
  | RiemannRefineSolveAnimation
  | FtcEvaluateSolveAnimation;

/**
 * One source term in a {@link Step.montage} (and the optional term drop on a
 * {@link NarratedSolveAnimation}): the coefficient a and exponent n of a·xⁿ,
 * animated through the power-rule drop to (a·n)·xⁿ⁻¹.
 */
export interface PowerRuleTerm {
  coefficient: number;
  exponent: number;
}

/**
 * One follow-up part of a multi-part question (see {@link Step.parts}). A part is
 * the gradeable core of a step — its own prompt, interaction, and feedback —
 * revealed only after the previous part is cleared. It can carry its own graph,
 * live grading, and goal label via {@link Interaction}, and falls back to the
 * step's {@link Step.conceptTag} when it doesn't set its own.
 */
export interface StepPart {
  /** Unique within the step (and ideally the lesson); must not equal the step id. */
  id: string;
  /** Concept this part exercises; defaults to the step's `conceptTag`. */
  conceptTag?: string;
  content: ContentBlock[];
  /** Must include an `answer`; may also define its own `graph`/`liveCheck`/`goalLabel`. */
  interaction: Interaction;
  feedback: StepFeedback;
}

export interface Step {
  id: string;
  type: StepType;
  conceptTag?: string;
  content: ContentBlock[];
  interaction?: Interaction;
  /**
   * Hand-authored, step-by-step worked solution shown in the "solve" assistance
   * level — prose + display math explaining *why* each move is made. Required on
   * graded lesson steps (enforced by {@link validateLesson}); practice questions
   * omit it since they don't offer the "solve" level.
   */
  solution?: ContentBlock[];
  /**
   * Optional problem-specific animation played in the "solve" walkthrough (see
   * {@link SolveAnimation}). Falls back to a generic slider sweep when absent.
   */
  solveAnimation?: SolveAnimation;
  /**
   * Auto-playing, looping power-rule montage shown on a `read` step: each term
   * a·xⁿ animates through the drop to (a·n)·xⁿ⁻¹, so a recap shows the pattern as
   * motion rather than static text. Ignored on graded steps. Respects
   * `prefers-reduced-motion` (renders the first term's result statically).
   */
  montage?: PowerRuleTerm[];
  feedback: StepFeedback;
  /**
   * Optional follow-up parts, revealed one at a time after the step's own
   * interaction (Part 1) is cleared. The whole chain is graded as a single
   * question — one nav square, one mastery question — but earns a flat XP bonus
   * for being multi-part (see {@link XP_PER_MULTIPART_BONUS}). Only graded steps
   * may have parts (never `read`/Riemann demos).
   */
  parts?: StepPart[];
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  conceptTags: string[];
  published: boolean;
  steps: Step[];
  /**
   * Pool of practice questions for this lesson. Each practice session draws a
   * random subset so repeated practice stays varied.
   */
  practiceBank?: Step[];
}

/** Outcome of a practice session: how many questions were correct on the first try. */
/** First-try tally for one concept within a single practice/review session. */
export interface ConceptSessionResult {
  /** Questions for this concept answered in the session (first submission only). */
  seen: number;
  /** Of those, how many were correct on the first try. */
  firstTryCorrect: number;
}

export interface PracticeResult {
  correct: number;
  total: number;
  /**
   * Extra XP earned this session beyond the per-correct base — currently the
   * flat {@link XP_PER_MULTIPART_BONUS} for each multi-part question cleared on
   * the first try. Optional; treated as 0 when absent.
   */
  bonusXp?: number;
  /**
   * First-try results grouped by concept tag, folded into the learner's
   * lifetime `conceptStats` on the results screen so practice/review updates
   * mastery. Absent for plain lesson completions (which score per step instead).
   */
  conceptResults?: Record<string, ConceptSessionResult>;
}

export interface LessonMeta {
  id: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  published: boolean;
}

/**
 * A level groups several lessons into a stage of the course that builds on the
 * previous one (e.g. "What Is a Derivative?" → "Finding Derivatives"). Lessons
 * are referenced by id and rendered in the listed order.
 */
interface CourseLevel {
  id: string;
  title: string;
  /** One-line summary of what this level builds toward. */
  description: string;
  lessonIds: string[];
}

export interface Course {
  id: "derivatives";
  title: string;
  subject: string;
  description: string;
  /** Ordered learning stages. When omitted, all lessons fall under one level. */
  levels?: CourseLevel[];
  lessons: LessonMeta[];
}

/**
 * One must-know fact in the Reference cheat sheet — a foundational rule or
 * definition the learner is expected to know (e.g. the power rule), not an
 * application to work through. Facts are hand-authored in
 * `content/reference.json`, grouped for display by the level that contains their
 * teaching {@link lessonId}, and unlock once that lesson is complete. At least
 * one of {@link formula} or {@link summary} must be present so the card always
 * has something to show.
 */
export interface ReferenceFact {
  /** Stable, unique slug, e.g. "power-rule". */
  id: string;
  /** Short plain-text heading, e.g. "Power Rule". */
  title: string;
  /**
   * Published lesson that teaches this fact: completing it unlocks the fact, and
   * it is the "Learn more" target.
   */
  lessonId: string;
  /** Concept tag, matching the teaching lesson's tags. For future linking. */
  conceptTag?: string;
  /** The headline formula in LaTeX, rendered centered. Omit for purely verbal facts. */
  formula?: string;
  /**
   * One-line plain-language statement, rendered with inline math (`$…$`) support.
   * Required when there is no {@link formula}; otherwise an optional caption
   * shown beneath the formula.
   */
  summary?: string;
  /**
   * Expanded explanation revealed on demand, reusing the lesson content renderer
   * so it supports prose and display math.
   */
  detail?: ContentBlock[];
}

export interface LessonProgress {
  status: LessonStatus;
  currentStepIndex: number;
  stepAttempts: Record<string, number>;
  stepAnswers: Record<string, unknown>;
  /**
   * Step ids the learner cleared via the "solve" assistance level (worked
   * examples). These advance the lesson but are excluded from concept mastery,
   * so seeing the solution never inflates first-try accuracy. Absent on progress
   * saved before this field existed.
   */
  solvedSteps?: string[];
  completedAt: string | null;
  updatedAt: string;
}

export interface StreakData {
  count: number;
  lastActiveDate: string;
}

/**
 * Lifetime practice/review performance for a single concept tag, accumulated
 * across sessions. Lets mastery keep moving after the one-shot lesson
 * questions: practicing a concept well lifts its mastery, practicing it poorly
 * lets it slip. Only the first submission of each question in a session counts
 * (mirrors the XP / first-try rule), so retries can't inflate it.
 */
export interface ConceptStat {
  /** Practice/review questions answered for this concept (first submission only). */
  seen: number;
  /** Of those, how many were correct on the first try. */
  firstTryCorrect: number;
  /** ISO timestamp of the most recent practice/review touching this concept. */
  lastReviewed: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  streak: StreakData;
  milestones: string[];
  /** Total experience points earned, primarily by completing lessons. */
  xp: number;
  /**
   * Lifetime count of practice/review questions cleared on the first try.
   * Lesson-walkthrough questions and questions that needed more than one attempt
   * are deliberately excluded. Powers the "practice questions" achievements;
   * backfilled to 0 on older profiles.
   */
  practiceQuestionsAnswered: number;
  /**
   * Per-day activity tally keyed by ISO date (YYYY-MM-DD); the value counts the
   * questions answered that day. Powers the activity heatmap and longest-streak
   * stat. Absent on profiles created before this field existed.
   */
  activityLog?: Record<string, number>;
  /**
   * Per-concept practice/review performance, keyed by concept-tag slug. Feeds
   * mastery beyond the lesson's built-in questions so review actually moves the
   * needle. Absent on profiles created before this field existed.
   */
  conceptStats?: Record<string, ConceptStat>;
  createdAt: string;
  updatedAt: string;
}

/** How well a learner has demonstrated a concept, coarsest to strongest. */
export type ConceptMasteryTier =
  | "not_started"
  | "learning"
  | "proficient"
  | "mastered";

/** Aggregated mastery of a single concept tag across every lesson that teaches it. */
export interface ConceptMastery {
  /** Concept tag slug, e.g. "power_rule". */
  concept: string;
  /** Human-readable label for display. */
  label: string;
  tier: ConceptMasteryTier;
  /** 0–100 share of the concept's questions answered correctly on the first try. */
  percent: number;
  /** Concept questions answered correctly on the first try. */
  firstTry: number;
  /** Concept questions the learner has cleared (eventually answered correctly). */
  cleared: number;
  /** Total answerable questions tagged with this concept. */
  total: number;
  /** Published lesson ids that teach this concept, in course order. */
  lessonIds: string[];
}

export type FeedbackResult =
  | { correct: true; message: string }
  | { correct: false; message: string; showHint: boolean; hint?: string };
