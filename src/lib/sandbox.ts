import type {
  GraphConfig,
  IntegralBoundsAnswer,
  RiemannAnswer,
  Sandbox,
} from "../types/content";
import { riemannSum } from "./feedbackEngine";

/** Fallback plot window for a preset sandbox when the author omits `domain`. */
const DEFAULT_SANDBOX_DOMAIN: [number, number] = [-3, 3];

/** Which kind of explorer a sandbox renders. */
export type SandboxKind =
  | "graph"
  | "shape"
  | "power_rule"
  | "reverse_power_rule"
  | "riemann"
  | "area"
  | "ftc";

/** A finite-interval preset needs both endpoints, with b > a. */
function hasInterval(sandbox: Sandbox): boolean {
  return (
    Number.isFinite(sandbox.a) &&
    Number.isFinite(sandbox.b) &&
    (sandbox.b as number) > (sandbox.a as number)
  );
}

/**
 * Resolve a {@link Sandbox} to the explorer it renders, or null when it is
 * misauthored (so the caller can render nothing). The `slope_explorer` preset and
 * the `graph` escape hatch both render the graph explorer.
 */
export function sandboxKind(sandbox: Sandbox): SandboxKind | null {
  if (sandbox.graph) return "graph";
  switch (sandbox.preset) {
    case "slope_explorer":
    case "rate_explorer":
      return sandbox.fn ? "graph" : null;
    case "shape_explorer":
      return sandbox.fn ? "shape" : null;
    case "power_rule":
      // The power-rule explorer is purely symbolic (a·xⁿ), so it needs no fields.
      return "power_rule";
    case "reverse_power_rule":
      // The reverse-power-rule explorer is purely symbolic too.
      return "reverse_power_rule";
    case "riemann":
      return sandbox.fn && hasInterval(sandbox) ? "riemann" : null;
    case "area_explorer":
      return sandbox.fn && hasInterval(sandbox) ? "area" : null;
    case "ftc_explorer":
      return sandbox.fn && hasInterval(sandbox) ? "ftc" : null;
    default:
      return null;
  }
}

/**
 * Expand a graph-style {@link Sandbox} (the `slope_explorer` preset or a `graph`
 * escape hatch) into the {@link GraphConfig} its explorer renders. The slope
 * preset builds a draggable point with ONLY its tangent and the slope readout on
 * — the readout slope questions hide — over a DIFFERENT curve; the secant
 * (`showSecant: false`) and the value readout are suppressed so the lone tangent
 * is the focus and no stray chord clutters the plot. Returns null when neither
 * applies.
 */
export function buildSandboxGraph(sandbox: Sandbox): GraphConfig | null {
  if (sandbox.graph) return sandbox.graph;
  if (sandbox.preset === "slope_explorer" && sandbox.fn) {
    return {
      fn: sandbox.fn,
      domain: sandbox.domain ?? DEFAULT_SANDBOX_DOMAIN,
      xLabel: sandbox.xLabel ?? "x",
      yLabel: sandbox.yLabel ?? "y",
      showTangent: true,
      showSecant: false,
      showSlopeValue: true,
      showValue: false,
      explore: true,
    };
  }
  if (sandbox.preset === "rate_explorer" && sandbox.fn) {
    return buildRateExplorerGraph(sandbox);
  }
  return null;
}

/**
 * Build the {@link GraphConfig} for the `rate_explorer` preset: a draggable point
 * on a STRAIGHT line that shows the rise/run triangle (the Δy and Δx legs) and a
 * live "rate of change = Δy / Δx" readout, with no tangent and no full-width
 * secant. The fixed corner sits at the domain's left edge so the run is always
 * positive, and dragging the moving point sweeps the triangle while the ratio
 * holds steady — the honest picture of a line's (constant) derivative. Runs on a
 * DIFFERENT line than the question, so nothing read off it is the answer.
 */
function buildRateExplorerGraph(sandbox: Sandbox): GraphConfig {
  const domain = sandbox.domain ?? DEFAULT_SANDBOX_DOMAIN;
  const [d0, d1] = domain;
  const span = d1 - d0;
  return {
    fn: sandbox.fn as string,
    domain,
    xLabel: sandbox.xLabel ?? "x",
    yLabel: sandbox.yLabel ?? "y",
    // The left edge anchors the triangle's right angle, so the run (x1 − x0)
    // never goes negative as the learner drags the moving point.
    fixedPoint: d0,
    showSecant: false,
    showTangent: false,
    showSecantRiseRun: true,
    slopeLabel: "Rate of change",
    showValue: false,
    sliderLabel: "x",
    sliderMin: d0,
    sliderMax: d1,
    sliderStep: 1,
    // Start a couple of steps in so a triangle is visible before any drag.
    initialSlider: d0 + Math.min(Math.max(Math.round(span * 0.4), 1), span - 0.5),
    explore: true,
  };
}

/**
 * Build the {@link GraphConfig} for the `shape_explorer` preset: a draggable
 * point on a DIFFERENT curve with the derivative f′ overlaid and the tangent
 * slope shown live. Dragging the point makes the link between the sign of f′ (the
 * orange overlay / the tangent's tilt) and where f rises, falls, and bends
 * something the learner feels directly. Returns null unless an `fn` is present.
 */
export function buildSandboxShape(sandbox: Sandbox): GraphConfig | null {
  if (sandbox.preset !== "shape_explorer" || !sandbox.fn) return null;
  return {
    fn: sandbox.fn,
    domain: sandbox.domain ?? DEFAULT_SANDBOX_DOMAIN,
    xLabel: sandbox.xLabel ?? "x",
    yLabel: sandbox.yLabel ?? "y",
    showDerivative: true,
    showTangent: true,
    showSecant: false,
    showSlopeValue: true,
    showValue: false,
    explore: true,
  };
}

/**
 * Build the {@link GraphConfig} for the `area_explorer` preset: a curve with a
 * shaded region from the fixed lower limit `a` to the slider's current x, plus a
 * live integral readout, so dragging sweeps out accumulated area on a DIFFERENT
 * curve than the question's. Returns null unless an `fn` and a valid interval are
 * present.
 */
export function buildSandboxArea(sandbox: Sandbox): GraphConfig | null {
  if (sandbox.preset !== "area_explorer" || !sandbox.fn || !hasInterval(sandbox)) {
    return null;
  }
  const a = sandbox.a as number;
  const b = sandbox.b as number;
  const integrand = sandbox.integrand ?? sandbox.fn.replace(/\*/g, "");
  return {
    fn: sandbox.fn,
    domain: sandbox.domain ?? [a, b],
    xLabel: sandbox.xLabel ?? "x",
    yLabel: sandbox.yLabel ?? "y",
    showSecant: false,
    showValue: false,
    showArea: true,
    areaStart: a,
    showAreaValue: true,
    areaReadoutMath: true,
    integrand,
    sliderLabel: "t",
    sliderMin: a,
    sliderMax: b,
    sliderStep: Math.max((b - a) / 24, 0.05),
    initialSlider: a + (b - a) / 3,
    explore: true,
  };
}

/**
 * Build the {@link IntegralBoundsAnswer} spec the `ftc_explorer` sandbox feeds to
 * its (ungraded) `IntegralBoundsInput`: two draggable limits a, b on a DIFFERENT
 * curve, with the signed area between them shown live — the geometry behind
 * F(b) − F(a). The `a`/`b` here only seed the starting handles (nothing is
 * graded). Returns null unless an `fn` and a valid interval are present.
 */
export function buildSandboxFtc(sandbox: Sandbox): IntegralBoundsAnswer | null {
  if (sandbox.preset !== "ftc_explorer" || !sandbox.fn || !hasInterval(sandbox)) {
    return null;
  }
  const a = sandbox.a as number;
  const b = sandbox.b as number;
  const pad = (b - a) * 0.25;
  return {
    type: "integral_bounds",
    fn: sandbox.fn,
    domain: sandbox.domain ?? [a - pad, b + pad],
    a,
    b,
    showAreaValue: true,
    xLabel: sandbox.xLabel ?? "x",
    yLabel: sandbox.yLabel ?? "y",
  };
}

/**
 * Build the {@link RiemannAnswer} spec the `riemann` sandbox feeds to its
 * (ungraded) `RiemannInput`. The true area is computed numerically with a fine
 * midpoint sum, so authors only supply the curve and interval; `targetWithin`
 * just tints the estimate as it converges and never grades anything. Returns null
 * unless the preset and a valid interval are present.
 */
export function buildSandboxRiemann(sandbox: Sandbox): RiemannAnswer | null {
  if (sandbox.preset !== "riemann" || !sandbox.fn || !hasInterval(sandbox)) {
    return null;
  }
  const a = sandbox.a as number;
  const b = sandbox.b as number;
  let trueArea: number;
  try {
    trueArea = riemannSum(sandbox.fn, a, b, 2000);
  } catch {
    return null;
  }
  return {
    type: "riemann",
    fn: sandbox.fn,
    a,
    b,
    trueArea,
    targetWithin: Math.max(Math.abs(trueArea) * 0.02, 0.05),
    domain: sandbox.domain,
  };
}
