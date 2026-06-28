import type { Step } from "../../types/content";

/**
 * Pure, stateless helpers extracted from {@link LessonPlayer}: answer seeding,
 * the predict-marker start position, the graph's initial slider, and the small
 * interpolation utilities the "solve" walkthrough uses to tween a widget toward
 * its answer. Kept here (free of React/state) so the player file focuses on the
 * component's state machine, and so these can be unit-tested in isolation.
 */

/** Shuffle a list into an order that differs from the original when possible. */
function shuffleOrder(items: string[]): string[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 12; attempt++) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((v, i) => v !== items[i])) return out;
  }
  return [...items];
}

/**
 * The starting answer for question types that begin from a non-empty state: the
 * power-term builder opens on the original term, an order_list opens shuffled,
 * and a Riemann sum opens at a single (clearly-too-coarse) rectangle. Everything
 * else starts blank (undefined).
 */
export function seedAnswer(step: Step): unknown {
  const a = step.interaction?.answer;
  if (a?.type === "power_term") {
    // Fraction mode (reverse power rule) opens with the denominator stepper too.
    return a.denominator != null
      ? {
          coefficient: a.startCoefficient ?? 1,
          denominator: a.startDenominator ?? 1,
          exponent: a.startExponent ?? 1,
        }
      : { coefficient: a.startCoefficient ?? 1, exponent: a.startExponent ?? 1 };
  }
  if (a?.type === "order_list") return shuffleOrder(a.items);
  if (a?.type === "riemann") return 1;
  if (a?.type === "construct_graph") {
    // Open every node resting on the x-axis (clamped into range), so the learner
    // drags each up or down from a neutral baseline.
    const [lo, hi] = a.yDomain;
    const start = Math.min(Math.max(0, lo), hi);
    return a.nodes.map(() => start);
  }
  if (a?.type === "paint_intervals") {
    // Open with nothing shaded; the learner brushes segments on.
    return a.correct.map(() => false);
  }
  if (a?.type === "tangent_line") {
    // Open with a flat line through the pivot, ready to be rotated.
    return 0;
  }
  if (a?.type === "integral_bounds") {
    // Open with two handles inside the domain, away from the correct limits.
    const [d0, d1] = a.domain;
    const w = d1 - d0;
    return {
      a: parseFloat((d0 + w * 0.3).toFixed(3)),
      b: parseFloat((d0 + w * 0.6).toFixed(3)),
    };
  }
  if (a?.type === "select_region") {
    // Multi-select opens with nothing chosen (a boolean per band); single-select
    // opens blank (undefined) until a band is tapped.
    return a.multi ? a.bands.map(() => false) : undefined;
  }
  return undefined;
}

/**
 * Where a predict marker starts: the graph's initial slider if authored, else
 * the midpoint of the domain — a neutral spot to drag away from. Returns null
 * for non-predict steps.
 */
export function predictStartX(step: Step): number | null {
  if (step.interaction?.answer?.type !== "predict_point") return null;
  const g = step.interaction.graph;
  if (!g) return 0;
  if (typeof g.initialSlider === "number") return g.initialSlider;
  return (g.domain[0] + g.domain[1]) / 2;
}

/** The graph's initial slider value (authored initial, else its min, else 0). */
export function graphInitial(step: Step): number {
  return (
    step.interaction?.graph?.initialSlider ??
    step.interaction?.graph?.sliderMin ??
    0
  );
}

/** Linear interpolation between a and b at fraction e (0..1). */
export function lerp(a: number, b: number, e: number): number {
  return a + (b - a) * e;
}

/**
 * Fallback captions for a secant "rate of change" walkthrough when a step doesn't
 * author its own: beat 0 draws the secant, beat 1 reads off the rise / run.
 */
export const DEFAULT_SECANT_CAPTIONS = [
  "A derivative is the rate of change — how much f changes for each step in x. Join two points on the line with a secant.",
  "Its slope is the rise Δy over the run Δx, and on a straight line that ratio is the same everywhere — so it is the derivative.",
];

/** Finite number from a value, else the fallback. */
function toNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Whether the "solve" walkthrough can smoothly tween this answer type to its
 * target. Pick/place types (multiple_choice, drag_drop, match, …) have no
 * meaningful in-between state, so they snap to the answer instead.
 */
export function isTweenable(type: string | undefined): boolean {
  return (
    type === "slider" ||
    type === "numeric" ||
    type === "graph_point" ||
    type === "predict_point" ||
    type === "power_term" ||
    type === "riemann" ||
    type === "tangent_line" ||
    type === "integral_bounds" ||
    type === "construct_graph"
  );
}

/**
 * Interpolate an `answer`-shaped value from `from` toward `to` at fraction e, so
 * the "solve" walkthrough can animate the widget into its answer (slider/point
 * values are tweened separately via graphValue/clickedX/predictX).
 */
export function lerpAnswer(
  type: string | undefined,
  from: unknown,
  to: unknown,
  e: number,
): unknown {
  switch (type) {
    case "numeric":
    case "tangent_line":
      return Math.round(lerp(toNum(from, 0), to as number, e) * 100) / 100;
    case "riemann":
      return Math.max(1, Math.round(lerp(toNum(from, 1), to as number, e)));
    case "power_term": {
      const f = (from ?? {}) as {
        coefficient?: number;
        exponent?: number;
        denominator?: number;
      };
      const t = to as {
        coefficient: number;
        exponent: number;
        denominator?: number;
      };
      const next: { coefficient: number; exponent: number; denominator?: number } = {
        coefficient: Math.round(lerp(toNum(f.coefficient, 0), t.coefficient, e)),
        exponent: Math.round(lerp(toNum(f.exponent, t.exponent), t.exponent, e)),
      };
      if (t.denominator != null) {
        next.denominator = Math.round(lerp(toNum(f.denominator, 1), t.denominator, e));
      }
      return next;
    }
    case "integral_bounds": {
      const f = (from ?? {}) as { a?: number; b?: number };
      const t = to as { a: number; b: number };
      return { a: lerp(toNum(f.a, t.a), t.a, e), b: lerp(toNum(f.b, t.b), t.b, e) };
    }
    case "construct_graph": {
      const f = Array.isArray(from) ? (from as number[]) : [];
      return (to as number[]).map((ty, i) => lerp(toNum(f[i], 0), ty, e));
    }
    default:
      return to;
  }
}
