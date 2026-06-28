import type { Lesson, Step, AnswerSpec, GraphConfig, Sandbox } from "../types/content";
import {
  MAX_STEPS,
  MIN_STEPS,
  PRACTICE_BANK_MIN,
  MIN_MC_OPTIONS,
  MIN_MATCH_PAIRS,
  isRiemannDemo,
} from "../types/content";
import { derivativeAt, evalAt } from "./feedbackEngine";

export function validateLesson(lesson: Lesson): string[] {
  const errors: string[] = [];
  const stepCount = lesson.steps.length;

  if (stepCount < MIN_STEPS || stepCount > MAX_STEPS) {
    errors.push(
      `Lesson "${lesson.id}" has ${stepCount} steps; expected ${MIN_STEPS}-${MAX_STEPS}.`,
    );
  }

  const hasSlider = lesson.steps.some((s) => s.type === "slider_graph");
  if (!hasSlider) {
    errors.push(`Lesson "${lesson.id}" must include at least one slider_graph step.`);
  }

  for (const step of lesson.steps) {
    // Lesson steps offer the "solve" assistance level, so each graded one needs
    // an authored worked solution. Practice questions don't (they only offer
    // hints / no help), so the practice bank is checked without that rule.
    errors.push(...validateStep(step, lesson.id, true));
  }

  errors.push(...validatePracticeBank(lesson));

  return errors;
}

/**
 * The practice bank is a pool of interactive questions (no "read" steps) that
 * practice sessions sample from. It must hold at least a session's worth so
 * every session can be filled, and every question id must be unique.
 */
function validatePracticeBank(lesson: Lesson): string[] {
  const errors: string[] = [];
  const bank = lesson.practiceBank;
  if (!bank) return errors;

  if (bank.length < PRACTICE_BANK_MIN) {
    errors.push(
      `Lesson "${lesson.id}" practice bank has ${bank.length} questions; expected at least ${PRACTICE_BANK_MIN}.`,
    );
  }

  const ids = new Set<string>();
  for (const step of bank) {
    if (step.type === "read") {
      errors.push(
        `Practice question "${step.id}" in "${lesson.id}" must be interactive, not a read step.`,
      );
    }
    if (ids.has(step.id)) {
      errors.push(`Duplicate practice question id "${step.id}" in "${lesson.id}".`);
    }
    ids.add(step.id);
    errors.push(...validateStep(step, lesson.id));
  }

  return errors;
}

/**
 * Validate a single interaction's answer spec and graph requirement. Shared by a
 * step and each of its follow-up parts, so every answer type is checked the same
 * way wherever it appears. `id` labels the messages. `stepType` is only used to
 * require a graph for a top-level `slider_graph` step; a follow-up part (passed
 * `undefined`) needs a graph only when its own answer
 * (slider/graph_point/predict_point) demands one.
 */
function validateInteraction(
  answer: AnswerSpec | undefined,
  graph: GraphConfig | undefined,
  sandbox: Sandbox | undefined,
  id: string,
  lessonId: string,
  stepType: Step["type"] | undefined,
): string[] {
  const errors: string[] = [];

  // A question only needs a graph when the answer is physically tied to one: a
  // slider must move along a curve, a graph_point is a tap on the plot, and a
  // slider_graph step is a graph by definition. Other question types (numeric,
  // multiple_choice, power_term) are fine with just an interaction.
  const needsGraph =
    stepType === "slider_graph" ||
    answer?.type === "slider" ||
    answer?.type === "graph_point" ||
    answer?.type === "predict_point";
  if (needsGraph && !graph) {
    const kind = answer ? `${answer.type} answer` : `${stepType} step`;
    errors.push(
      `Step "${id}" in "${lessonId}" has a ${kind} but has no graph config.`,
    );
  }

  if (answer?.type === "multiple_choice" && answer.options.length < MIN_MC_OPTIONS) {
    errors.push(
      `Step "${id}" in "${lessonId}" has ${answer.options.length} multiple-choice options; expected at least ${MIN_MC_OPTIONS}.`,
    );
  }

  if (answer?.type === "power_term") {
    if (!Number.isFinite(answer.coefficient) || !Number.isInteger(answer.exponent)) {
      errors.push(
        `Step "${id}" in "${lessonId}" has an invalid power_term answer (need a numeric coefficient and integer exponent).`,
      );
    }
    // Fraction mode: the denominator is the new exponent (n+1), so it must be a
    // positive integer.
    if (
      answer.denominator != null &&
      (!Number.isInteger(answer.denominator) || answer.denominator < 1)
    ) {
      errors.push(
        `Step "${id}" in "${lessonId}" power_term denominator must be a positive integer.`,
      );
    }
  }

  if (answer?.type === "multi_choice") {
    // The point of this type is to ask about several things at once, so it
    // needs more than one row. Each row needs a real choice (>= 2 options), but
    // not the 4-option floor of a standalone multiple_choice — these rows are
    // usually short classification labels (e.g. max/min/neither).
    if (answer.parts.length < 2) {
      errors.push(
        `Step "${id}" in "${lessonId}" multi_choice needs at least two parts.`,
      );
    }
    answer.parts.forEach((part, i) => {
      const options = part.options ?? answer.options;
      if (!options || options.length < 2) {
        errors.push(
          `Step "${id}" in "${lessonId}" multi_choice part ${i + 1} needs at least two options.`,
        );
      } else if (
        !Number.isInteger(part.correctIndex) ||
        part.correctIndex < 0 ||
        part.correctIndex >= options.length
      ) {
        errors.push(
          `Step "${id}" in "${lessonId}" multi_choice part ${i + 1} has a correctIndex outside its options.`,
        );
      }
    });
  }

  if (answer?.type === "drag_drop") {
    if (answer.blanks.length < 1) {
      errors.push(
        `Step "${id}" in "${lessonId}" drag_drop needs at least one blank.`,
      );
    }
    const uniqueBank = new Set(answer.bank);
    if (uniqueBank.size !== answer.bank.length) {
      errors.push(
        `Step "${id}" in "${lessonId}" drag_drop bank has duplicate tiles; each tile must be unique.`,
      );
    }
    // The bank must offer at least one distractor beyond the correct tiles, or
    // there's nothing to choose wrong and the question grades itself.
    if (answer.bank.length <= answer.blanks.length) {
      errors.push(
        `Step "${id}" in "${lessonId}" drag_drop bank needs more tiles than blanks (add at least one distractor).`,
      );
    }
    for (const blank of answer.blanks) {
      if (!uniqueBank.has(blank.accept)) {
        errors.push(
          `Step "${id}" in "${lessonId}" drag_drop blank expects "${blank.accept}", which is not in the bank.`,
        );
      }
    }
  }

  if (answer?.type === "match") {
    // Matching needs more than one pair, or there's nothing to match.
    if (answer.pairs.length < MIN_MATCH_PAIRS) {
      errors.push(
        `Step "${id}" in "${lessonId}" match needs at least ${MIN_MATCH_PAIRS} pairs.`,
      );
    }
    answer.pairs.forEach((pair, i) => {
      if (!pair.prompt || !pair.match) {
        errors.push(
          `Step "${id}" in "${lessonId}" match pair ${i + 1} needs both a prompt and a match.`,
        );
      }
    });
    // Options (matches + distractors) may intentionally share a label: two
    // prompts can have the same correct answer, or a distractor can mirror a
    // correct value to defeat solving by elimination. Grading is positional and
    // by value, and the widget tracks each tile by a stable id, so no uniqueness
    // is required and duplicate labels are allowed.
  }

  if (answer?.type === "sign_chart") {
    if (answer.points.length < 1) {
      errors.push(
        `Step "${id}" in "${lessonId}" sign_chart needs at least one critical point.`,
      );
    }
    // Ticks must be listed in increasing order so the regions read left-to-right.
    for (let i = 1; i < answer.points.length; i++) {
      if (answer.points[i] <= answer.points[i - 1]) {
        errors.push(
          `Step "${id}" in "${lessonId}" sign_chart points must be in strictly increasing order.`,
        );
        break;
      }
    }
    if (answer.options.length < 2) {
      errors.push(
        `Step "${id}" in "${lessonId}" sign_chart needs at least two options.`,
      );
    }
    // There is always exactly one more region than there are dividing points.
    if (answer.regions.length !== answer.points.length + 1) {
      errors.push(
        `Step "${id}" in "${lessonId}" sign_chart must have exactly points.length + 1 regions (got ${answer.regions.length} for ${answer.points.length} points).`,
      );
    }
    answer.regions.forEach((region, i) => {
      if (
        !Number.isInteger(region.correctIndex) ||
        region.correctIndex < 0 ||
        region.correctIndex >= answer.options.length
      ) {
        errors.push(
          `Step "${id}" in "${lessonId}" sign_chart region ${i + 1} has a correctIndex outside its options.`,
        );
      }
    });
  }

  if (answer?.type === "order_list") {
    if (answer.items.length < 2) {
      errors.push(
        `Step "${id}" in "${lessonId}" order_list needs at least two items.`,
      );
    }
    // Items are graded by exact identity, so duplicates would be ambiguous.
    if (new Set(answer.items).size !== answer.items.length) {
      errors.push(
        `Step "${id}" in "${lessonId}" order_list items must be unique.`,
      );
    }
  }

  if (answer?.type === "predict_point") {
    if (!Number.isFinite(answer.x)) {
      errors.push(
        `Step "${id}" in "${lessonId}" predict_point needs a finite x.`,
      );
    }
    if (answer.tolerance !== undefined && !(answer.tolerance > 0)) {
      errors.push(
        `Step "${id}" in "${lessonId}" predict_point tolerance must be positive.`,
      );
    }
    if (answer.acceptX && answer.acceptX.some((x) => !Number.isFinite(x))) {
      errors.push(
        `Step "${id}" in "${lessonId}" predict_point acceptX values must all be finite.`,
      );
    }
    // The reveal is the payoff of a predict step, so it must be authored.
    if (!answer.reveal) {
      errors.push(
        `Step "${id}" in "${lessonId}" predict_point needs a reveal spec.`,
      );
    }
  }

  if (answer?.type === "riemann") {
    if (!(answer.b > answer.a)) {
      errors.push(
        `Step "${id}" in "${lessonId}" riemann needs b > a.`,
      );
    }
    if (!Number.isFinite(answer.trueArea)) {
      errors.push(
        `Step "${id}" in "${lessonId}" riemann needs a finite trueArea.`,
      );
    }
    if (!(answer.targetWithin > 0)) {
      errors.push(
        `Step "${id}" in "${lessonId}" riemann targetWithin must be positive.`,
      );
    }
    // A Riemann step draws its own curve and rectangles, so a separate graph
    // config would render a confusing duplicate plot above the widget.
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" riemann must not also define a graph (the widget draws its own).`,
      );
    }
  }

  if (answer?.type === "construct_graph") {
    if (answer.nodes.length < 2) {
      errors.push(
        `Step "${id}" in "${lessonId}" construct_graph needs at least two nodes.`,
      );
    }
    if (answer.nodes.some((n) => !Number.isFinite(n.x))) {
      errors.push(
        `Step "${id}" in "${lessonId}" construct_graph nodes need finite x values.`,
      );
    }
    // Grading reads the target from exactly one source: a function or an
    // explicit per-node list. Both or neither is ambiguous.
    const hasFn = answer.targetFn !== undefined;
    const hasY = answer.targetY !== undefined;
    if (hasFn === hasY) {
      errors.push(
        `Step "${id}" in "${lessonId}" construct_graph needs exactly one of targetFn or targetY.`,
      );
    }
    if (hasY && answer.targetY!.length !== answer.nodes.length) {
      errors.push(
        `Step "${id}" in "${lessonId}" construct_graph targetY must have one entry per node.`,
      );
    }
    // Optional axis tick overrides must be positive spacings.
    for (const [field, value] of [
      ["xTickStep", answer.xTickStep],
      ["yTickStep", answer.yTickStep],
    ] as const) {
      if (value !== undefined && !(Number.isFinite(value) && value > 0)) {
        errors.push(
          `Step "${id}" in "${lessonId}" construct_graph ${field} must be a positive number.`,
        );
      }
    }
    // The widget draws its own axes, so a separate graph config would render a
    // confusing duplicate plot above it.
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" construct_graph must not also define a graph (the widget draws its own).`,
      );
    }
  }

  if (answer?.type === "paint_intervals") {
    if (answer.breakpoints.length < 1) {
      errors.push(
        `Step "${id}" in "${lessonId}" paint_intervals needs at least one breakpoint.`,
      );
    }
    // Breakpoints split the domain left to right, so they must be ordered.
    for (let i = 1; i < answer.breakpoints.length; i++) {
      if (answer.breakpoints[i] <= answer.breakpoints[i - 1]) {
        errors.push(
          `Step "${id}" in "${lessonId}" paint_intervals breakpoints must be in strictly increasing order.`,
        );
        break;
      }
    }
    const [d0, d1] = answer.domain;
    if (answer.breakpoints.some((b) => b <= d0 || b >= d1)) {
      errors.push(
        `Step "${id}" in "${lessonId}" paint_intervals breakpoints must lie strictly inside the domain.`,
      );
    }
    // There is always exactly one more segment than there are breakpoints.
    if (answer.correct.length !== answer.breakpoints.length + 1) {
      errors.push(
        `Step "${id}" in "${lessonId}" paint_intervals must have breakpoints.length + 1 correct entries (got ${answer.correct.length} for ${answer.breakpoints.length} breakpoints).`,
      );
    }
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" paint_intervals must not also define a graph (the widget draws its own).`,
      );
    }
  }

  if (answer?.type === "tangent_line") {
    if (!Number.isFinite(answer.x0)) {
      errors.push(`Step "${id}" in "${lessonId}" tangent_line needs a finite x0.`);
    }
    if (!Number.isFinite(answer.slope)) {
      errors.push(`Step "${id}" in "${lessonId}" tangent_line needs a finite slope.`);
    }
    if (answer.tolerance !== undefined && !(answer.tolerance > 0)) {
      errors.push(
        `Step "${id}" in "${lessonId}" tangent_line tolerance must be positive.`,
      );
    }
    // The correct slope is f'(x0); catch an authored slope that disagrees with
    // the curve so the dot and the verdict can't diverge. Lenient, so a hand-
    // rounded slope still passes.
    if (Number.isFinite(answer.x0) && Number.isFinite(answer.slope)) {
      try {
        const actual = derivativeAt(answer.fn, answer.x0);
        if (Number.isFinite(actual) && Math.abs(actual - answer.slope) > 0.5) {
          errors.push(
            `Step "${id}" in "${lessonId}" tangent_line slope ${answer.slope} should match f'(${answer.x0}) ≈ ${actual.toFixed(2)}.`,
          );
        }
      } catch {
        errors.push(
          `Step "${id}" in "${lessonId}" tangent_line fn "${answer.fn}" could not be evaluated at x0.`,
        );
      }
    }
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" tangent_line must not also define a graph (the widget draws its own).`,
      );
    }
  }

  if (answer?.type === "integral_bounds") {
    if (!Number.isFinite(answer.a) || !Number.isFinite(answer.b)) {
      errors.push(
        `Step "${id}" in "${lessonId}" integral_bounds needs finite a and b.`,
      );
    }
    if (!(answer.b > answer.a)) {
      errors.push(`Step "${id}" in "${lessonId}" integral_bounds needs b > a.`);
    }
    if (answer.tolerance !== undefined && !(answer.tolerance > 0)) {
      errors.push(
        `Step "${id}" in "${lessonId}" integral_bounds tolerance must be positive.`,
      );
    }
    const [d0, d1] = answer.domain;
    if (answer.a < d0 || answer.b > d1) {
      errors.push(
        `Step "${id}" in "${lessonId}" integral_bounds a and b must lie within the domain.`,
      );
    }
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" integral_bounds must not also define a graph (the widget draws its own).`,
      );
    }
  }

  if (answer?.type === "simulate") {
    if (!(answer.duration > 0)) {
      errors.push(`Step "${id}" in "${lessonId}" simulate needs a positive duration.`);
    }
    if (
      answer.coverage !== undefined &&
      !(answer.coverage > 0 && answer.coverage <= 1)
    ) {
      errors.push(
        `Step "${id}" in "${lessonId}" simulate coverage must be in (0, 1].`,
      );
    }
    if (answer.tolerance !== undefined && !(answer.tolerance > 0)) {
      errors.push(
        `Step "${id}" in "${lessonId}" simulate tolerance must be positive.`,
      );
    }
    // The target must evaluate as a function of t, or the trace can't be graded.
    try {
      evalAt(answer.target, { t: 0 });
    } catch {
      errors.push(
        `Step "${id}" in "${lessonId}" simulate target "${answer.target}" could not be evaluated at t = 0.`,
      );
    }
    // The optional source curve (derivative mode) must evaluate too.
    if (answer.referenceFn) {
      try {
        evalAt(answer.referenceFn, { t: 0 });
      } catch {
        errors.push(
          `Step "${id}" in "${lessonId}" simulate referenceFn "${answer.referenceFn}" could not be evaluated at t = 0.`,
        );
      }
    }
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" simulate must not also define a graph (the widget draws its own).`,
      );
    }
  }

  if (answer?.type === "select_region") {
    if (answer.bands.length < 2) {
      errors.push(
        `Step "${id}" in "${lessonId}" select_region needs at least two bands.`,
      );
    }
    const [d0, d1] = answer.domain;
    let prevTo = -Infinity;
    let overlap = false;
    answer.bands.forEach((b, i) => {
      if (!Number.isFinite(b.from) || !Number.isFinite(b.to)) {
        errors.push(
          `Step "${id}" in "${lessonId}" select_region band ${i + 1} needs finite from/to.`,
        );
        return;
      }
      if (b.to <= b.from) {
        errors.push(
          `Step "${id}" in "${lessonId}" select_region band ${i + 1} needs from < to.`,
        );
      }
      if (b.from < d0 || b.to > d1) {
        errors.push(
          `Step "${id}" in "${lessonId}" select_region band ${i + 1} must lie within the domain.`,
        );
      }
      // Bands read left-to-right and must not overlap (a gap between them is fine).
      if (!overlap && b.from < prevTo - 1e-9) {
        overlap = true;
        errors.push(
          `Step "${id}" in "${lessonId}" select_region bands must be ordered left-to-right without overlapping.`,
        );
      }
      prevTo = b.to;
    });
    const correctCount = answer.bands.filter((b) => b.correct === true).length;
    if (answer.multi) {
      if (correctCount < 1) {
        errors.push(
          `Step "${id}" in "${lessonId}" multi-select select_region needs at least one correct band.`,
        );
      }
    } else if (correctCount !== 1) {
      errors.push(
        `Step "${id}" in "${lessonId}" single-select select_region needs exactly one correct band.`,
      );
    }
    // Catch a typo'd curve so the plot can't silently render empty.
    try {
      evalAt(answer.fn, { x: d0 });
    } catch {
      errors.push(
        `Step "${id}" in "${lessonId}" select_region fn "${answer.fn}" could not be evaluated.`,
      );
    }
    // The widget draws its own curve, so a separate graph config would duplicate it.
    if (graph) {
      errors.push(
        `Step "${id}" in "${lessonId}" select_region must not also define a graph (the widget draws its own).`,
      );
    }
  }

  errors.push(...validateSandbox(sandbox, graph, answer, id, lessonId));

  return errors;
}

/**
 * A concept sandbox is an ungraded, hints-only explorer on a DIFFERENT example.
 * Its honesty rests on never running on the graded instance, so the rules here
 * enforce, per preset, that it has exactly one source, evaluates, and differs
 * from the question's own curve/term.
 */
function validateSandbox(
  sandbox: Sandbox | undefined,
  graph: GraphConfig | undefined,
  answer: AnswerSpec | undefined,
  id: string,
  lessonId: string,
): string[] {
  const errors: string[] = [];
  if (!sandbox) return errors;

  const hasPreset = sandbox.preset !== undefined;
  const hasGraph = sandbox.graph !== undefined;
  // Exactly one source for the explorer: a preset or a full graph escape hatch.
  if (hasPreset === hasGraph) {
    errors.push(
      `Step "${id}" in "${lessonId}" sandbox needs exactly one of preset or graph.`,
    );
  }

  const norm = (s: string) => s.replace(/\s+/g, "");
  // The graded curve a curve-based sandbox must differ from: the question's
  // graph fn, or a self-drawing answer's own fn (e.g. riemann, select_region).
  const answerFn =
    answer && "fn" in answer && typeof answer.fn === "string"
      ? answer.fn
      : undefined;
  const gradedFn = graph?.fn ?? answerFn;
  const preset = sandbox.preset;

  // Presets (and the escape hatch) that draw a curve the learner explores. Their
  // honesty rests on running on a DIFFERENT curve, so the fn must evaluate and
  // must not match the question's own curve.
  const curvePresets = new Set([
    "slope_explorer",
    "shape_explorer",
    "area_explorer",
    "ftc_explorer",
    "riemann",
  ]);
  const isCurveSandbox =
    hasGraph || (preset !== undefined && curvePresets.has(preset));

  if (isCurveSandbox) {
    const fn = hasGraph ? sandbox.graph!.fn : sandbox.fn;
    const domain = hasGraph ? sandbox.graph!.domain : sandbox.domain;
    const startX = domain
      ? domain[0]
      : Number.isFinite(sandbox.a)
        ? (sandbox.a as number)
        : 0;
    if (!fn) {
      errors.push(
        `Step "${id}" in "${lessonId}" sandbox preset "${preset ?? "graph"}" needs an fn.`,
      );
    } else {
      try {
        evalAt(fn, { x: startX });
      } catch {
        errors.push(
          `Step "${id}" in "${lessonId}" sandbox fn "${fn}" could not be evaluated.`,
        );
      }
      if (gradedFn && norm(gradedFn) === norm(fn)) {
        errors.push(
          `Step "${id}" in "${lessonId}" sandbox fn must differ from the graded fn (a sandbox teaches on a different example).`,
        );
      }
    }
    // The graph escape hatch is for slope-style explorers, so it must keep its
    // slope readout on; the curve presets manage their own readouts.
    if (hasGraph && sandbox.graph!.showSlopeValue === false) {
      errors.push(
        `Step "${id}" in "${lessonId}" sandbox graph must keep its slope readout on (showSlopeValue must not be false).`,
      );
    }
  }

  // Interval presets slice or span a finite [a, b]; both endpoints are required
  // and b must exceed a.
  const intervalPresets = new Set(["riemann", "area_explorer", "ftc_explorer"]);
  if (preset !== undefined && intervalPresets.has(preset)) {
    if (!Number.isFinite(sandbox.a) || !Number.isFinite(sandbox.b)) {
      errors.push(
        `Step "${id}" in "${lessonId}" sandbox preset "${preset}" needs finite a and b.`,
      );
    } else if (!((sandbox.b as number) > (sandbox.a as number))) {
      errors.push(
        `Step "${id}" in "${lessonId}" sandbox preset "${preset}" needs b > a.`,
      );
    }
  }

  return errors;
}

/**
 * Validate a step's follow-up parts (see {@link Step.parts}). Only graded steps
 * may have parts; each part needs its own answer, feedback, and a unique id, and
 * its interaction is checked with the same per-type rules as a top-level step.
 */
function validateParts(step: Step, lessonId: string): string[] {
  const errors: string[] = [];
  const parts = step.parts;
  if (!parts || parts.length === 0) return errors;

  if (step.type === "read" || isRiemannDemo(step)) {
    errors.push(
      `Step "${step.id}" in "${lessonId}" is a read/instruction step and cannot have follow-up parts.`,
    );
  }

  const seen = new Set<string>([step.id]);
  parts.forEach((part, i) => {
    const label = part.id || `part ${i + 1}`;
    if (!part.id) {
      errors.push(`Step "${step.id}" in "${lessonId}" part ${i + 1} needs an id.`);
    } else if (seen.has(part.id)) {
      errors.push(
        `Step "${step.id}" in "${lessonId}" has a duplicate part id "${part.id}".`,
      );
    }
    if (part.id) seen.add(part.id);

    // Parts are one level deep; a part can't itself carry nested parts.
    if ((part as { parts?: unknown }).parts) {
      errors.push(
        `Step "${step.id}" in "${lessonId}" part "${label}" cannot have nested parts.`,
      );
    }

    const partAnswer = part.interaction?.answer;
    if (!partAnswer) {
      errors.push(
        `Step "${step.id}" in "${lessonId}" part "${label}" must have an answer spec.`,
      );
    }

    if (
      !part.feedback?.correct ||
      !part.feedback?.incorrect ||
      !part.feedback?.hint
    ) {
      errors.push(
        `Step "${step.id}" in "${lessonId}" part "${label}" is missing feedback fields.`,
      );
    }

    // A follow-up part requires a graph only when its own answer needs one, so
    // pass no step type (the parent's slider_graph type must not force a graph
    // on, say, a numeric follow-up).
    errors.push(
      ...validateInteraction(
        partAnswer,
        part.interaction?.graph,
        part.interaction?.sandbox,
        part.id || `${step.id}#${i + 1}`,
        lessonId,
        undefined,
      ),
    );
  });

  return errors;
}

function validateStep(
  step: Step,
  lessonId: string,
  requireSolution = false,
): string[] {
  const errors: string[] = [];
  const interactive = step.type !== "read";
  const answer = step.interaction?.answer;

  if (interactive && !answer) {
    errors.push(`Step "${step.id}" in "${lessonId}" is interactive but has no answer spec.`);
  }

  // Check the step's own interaction (Part 1).
  errors.push(
    ...validateInteraction(
      answer,
      step.interaction?.graph,
      step.interaction?.sandbox,
      step.id,
      lessonId,
      step.type,
    ),
  );

  // Check any follow-up parts (multi-part questions).
  errors.push(...validateParts(step, lessonId));

  // Read steps and ungraded Riemann demos show no feedback, so they're exempt
  // from the feedback-fields requirement below.
  if (step.type === "read" || isRiemannDemo(step)) {
    return errors;
  }

  if (!step.feedback?.correct || !step.feedback?.incorrect || !step.feedback?.hint) {
    errors.push(`Step "${step.id}" in "${lessonId}" is missing feedback fields.`);
  }

  // Graded lesson steps must carry a worked solution for the "solve" assistance
  // level. Practice questions are exempt (they pass requireSolution = false).
  if (requireSolution && (!step.solution || step.solution.length === 0)) {
    errors.push(
      `Step "${step.id}" in "${lessonId}" is missing a worked solution (required on graded lesson steps for the "solve" assistance level).`,
    );
  }

  return errors;
}

export function assertValidLesson(lesson: Lesson): void {
  const errors = validateLesson(lesson);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
