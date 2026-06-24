import { create, all, type EvalFunction } from "mathjs";
import type { Step } from "../types/content";
import type { FeedbackResult } from "../types/content";

const math = create(all);

// Cache compiled expressions; math.js uses "^" for exponentiation natively
// (do NOT convert to "**", which math.js does not support).
const compiledCache = new Map<string, EvalFunction>();

export function evalFunction(fn: string, x: number): number {
  let expr = compiledCache.get(fn);
  if (!expr) {
    expr = math.compile(fn);
    compiledCache.set(fn, expr);
  }
  const result = expr.evaluate({ x });
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error(`Invalid evaluation at x=${x}`);
  }
  return result;
}

export function secantSlope(
  fn: string,
  x0: number,
  h: number,
): number {
  if (Math.abs(h) < 1e-9) return NaN;
  return (evalFunction(fn, x0 + h) - evalFunction(fn, x0)) / h;
}

/**
 * Instantaneous slope (derivative) at a point via a central difference.
 * Defined for all points where the function is smooth, so it has no 0/0
 * blow-up the way a secant does when its two points coincide.
 */
export function derivativeAt(fn: string, x: number, h = 1e-4): number {
  return (evalFunction(fn, x + h) - evalFunction(fn, x - h)) / (2 * h);
}

export function checkAnswer(
  step: Step,
  answer: unknown,
): FeedbackResult {
  const spec = step.interaction?.answer;
  if (!spec) {
    return { correct: true, message: step.feedback.correct };
  }

  switch (spec.type) {
    case "multiple_choice": {
      const index = answer as number;
      const correct = index === spec.correctIndex;
      return correct
        ? { correct: true, message: step.feedback.correct }
        : {
            correct: false,
            message: step.feedback.incorrect,
            showHint: false,
            hint: step.feedback.hint,
          };
    }
    case "numeric":
    case "slider": {
      const num = Number(answer);
      if (!Number.isFinite(num)) {
        return {
          correct: false,
          message: "Please enter a valid number.",
          showHint: false,
          hint: step.feedback.hint,
        };
      }
      const tolerance = spec.tolerance ?? 0.01;
      const verified = math.abs(math.subtract(num, spec.value)) <= tolerance;
      return verified
        ? { correct: true, message: step.feedback.correct }
        : {
            correct: false,
            message: step.feedback.incorrect,
            showHint: false,
            hint: step.feedback.hint,
          };
    }
    case "graph_point": {
      const num = Number(answer);
      if (!Number.isFinite(num)) {
        return {
          correct: false,
          message: "Tap a point on the curve.",
          showHint: false,
          hint: step.feedback.hint,
        };
      }
      const tolerance = spec.tolerance ?? 0.25;
      const verified = math.abs(math.subtract(num, spec.x)) <= tolerance;
      return verified
        ? { correct: true, message: step.feedback.correct }
        : {
            correct: false,
            message: step.feedback.incorrect,
            showHint: false,
            hint: step.feedback.hint,
          };
    }
    case "power_term": {
      const v = (answer ?? {}) as { coefficient?: number; exponent?: number };
      const coeff = Number(v.coefficient);
      const exp = Number(v.exponent);
      if (!Number.isFinite(coeff) || !Number.isFinite(exp)) {
        return {
          correct: false,
          message: step.feedback.incorrect,
          showHint: false,
          hint: step.feedback.hint,
        };
      }
      // A zero coefficient means the term vanished (e.g. a constant's
      // derivative), so the exponent doesn't matter in that case.
      const verified =
        spec.coefficient === 0
          ? coeff === 0
          : coeff === spec.coefficient && exp === spec.exponent;
      return verified
        ? { correct: true, message: step.feedback.correct }
        : {
            correct: false,
            message: step.feedback.incorrect,
            showHint: false,
            hint: step.feedback.hint,
          };
    }
    default:
      return {
        correct: false,
        message: "Unknown answer type.",
        showHint: false,
      };
  }
}

export function verifyNumericWithMathJs(
  expected: number,
  actual: number,
  tolerance = 0.01,
): boolean {
  return math.abs(math.subtract(actual, expected)) <= tolerance;
}
