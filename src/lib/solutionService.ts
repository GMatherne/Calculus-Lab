import type {
  ConstructGraphAnswer,
  ContentBlock,
  RiemannAnswer,
  SimulateAnswer,
  Step,
} from "../types/content";
import { describeCorrectAnswer } from "./answerFormat";
import { evalAt, evalFunction, riemannSum } from "./feedbackEngine";

/**
 * Powers the "solve" assistance level: it pre-fills the interactive widget with
 * the correct answer and supplies the worked-solution blocks shown beside it.
 * The widget value shapes here mirror exactly what {@link checkAnswer} grades,
 * so a pre-filled answer reads as correct in every widget.
 */

/** Smallest rectangle count whose midpoint sum lands within tolerance of the truth. */
function smallestRiemannN(spec: RiemannAnswer): number {
  const max = spec.maxRects ?? 40;
  for (let n = 1; n <= max; n++) {
    if (Math.abs(riemannSum(spec.fn, spec.a, spec.b, n) - spec.trueArea) <= spec.targetWithin) {
      return n;
    }
  }
  return max;
}

/** Target y per node (from `targetFn` at the node's x, else `targetY`), clamped into range. */
function constructTargets(spec: ConstructGraphAnswer): number[] {
  const [lo, hi] = spec.yDomain;
  return spec.nodes.map((node, i) => {
    let y: number;
    try {
      y = spec.targetFn !== undefined
        ? evalFunction(spec.targetFn, node.x)
        : spec.targetY?.[i] ?? 0;
    } catch {
      y = 0;
    }
    return Math.min(Math.max(y, lo), hi);
  });
}

/** A trace that follows the target curve, sampled evenly across the run. */
function simulateTrace(spec: SimulateAnswer): number[] {
  const samples = 48;
  const [lo, hi] = spec.yDomain;
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (spec.duration * i) / (samples - 1);
    let y: number;
    try {
      y = evalAt(spec.target, { t });
    } catch {
      y = 0;
    }
    out.push(Math.min(Math.max(y, lo), hi));
  }
  return out;
}

/**
 * The structured value each answer widget expects in order to display the
 * correct answer, derived from the step's answer spec. Returns `undefined` for
 * steps without an answer (e.g. read steps). The shapes match the seeds the
 * widgets accept, so they can be fed straight into the player's answer state.
 */
export function correctAnswerValue(step: Step): unknown {
  const spec = step.interaction?.answer;
  if (!spec) return undefined;
  switch (spec.type) {
    case "multiple_choice":
      return spec.correctIndex;
    case "multi_choice":
      return spec.parts.map((p) => p.correctIndex);
    case "numeric":
    case "slider":
      return spec.value;
    case "graph_point":
    case "predict_point":
      return spec.x;
    case "power_term":
      return spec.denominator != null
        ? {
            coefficient: spec.coefficient,
            denominator: spec.denominator,
            exponent: spec.exponent,
          }
        : { coefficient: spec.coefficient, exponent: spec.exponent };
    case "drag_drop":
      return spec.blanks.map((b) => b.accept);
    case "match":
      return spec.pairs.map((p) => p.match);
    case "sign_chart":
      return spec.regions.map((r) => r.correctIndex);
    case "order_list":
      return spec.items;
    case "riemann":
      return smallestRiemannN(spec);
    case "construct_graph":
      return constructTargets(spec);
    case "paint_intervals":
      return spec.correct;
    case "tangent_line":
      return spec.slope;
    case "integral_bounds":
      return { a: spec.a, b: spec.b };
    case "simulate":
      return simulateTrace(spec);
    case "select_region":
      // Multi-select grades a boolean per band; single-select grades the index
      // of the (one) correct band.
      return spec.multi
        ? spec.bands.map((b) => b.correct === true)
        : spec.bands.findIndex((b) => b.correct === true);
    default:
      return undefined;
  }
}

/**
 * The worked-solution content for the "solve" level: the hand-authored
 * {@link Step.solution} when present, otherwise a minimal fallback that states
 * the correct answer (so the panel is never empty even before a solution is
 * authored).
 */
export function solutionBlocks(step: Step): ContentBlock[] {
  if (step.solution && step.solution.length > 0) return step.solution;
  const spec = step.interaction?.answer;
  if (!spec) return [];
  return [
    {
      type: "text",
      body: `The correct answer is ${describeCorrectAnswer(spec)}.`,
    },
  ];
}
