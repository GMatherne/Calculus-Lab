/**
 * Shared math + beat/caption logic for the polynomial "term by term" solve
 * animation (differentiate or integrate), kept out of the component file so it
 * can be imported by both {@link PolynomialSolveAnimation} and the lesson player
 * (which drives the animation beat-by-beat) without tripping react-refresh's
 * "components only" rule.
 */

import type { PowerRuleTerm } from "../../types/content";

/**
 * Which way the rule runs: `differentiate` drops a·xⁿ to (a·n)·xⁿ⁻¹ (a constant
 * vanishes); `integrate` raises it to a/(n+1)·xⁿ⁺¹ (a constant c becomes c·x).
 */
export type SolveDirection = "differentiate" | "integrate";

/**
 * Whether this source term simply disappears: only when differentiating a
 * constant (its derivative is 0). Integration turns a constant c into c·x.
 */
export function isDropped(t: PowerRuleTerm, direction: SolveDirection): boolean {
  return direction === "differentiate" && t.exponent === 0;
}

/** Magnitude-only LaTeX for c·xᵉ: a coefficient of 1 is hidden unless e = 0. */
export function termBody(coeff: number, exp: number): string {
  const m = Math.abs(coeff);
  if (exp === 0) return `${m}`;
  const c = m === 1 ? "" : `${m}`;
  const x = exp === 1 ? "x" : `x^{${exp}}`;
  return `${c}${x}`;
}

/** LaTeX for a source term a·xⁿ; `lead` keeps the sign (later terms use an op). */
export function sourceTermLatex(t: PowerRuleTerm, lead: boolean): string {
  const sign = t.coefficient < 0 ? "-" : "";
  return `${lead ? sign : ""}${termBody(t.coefficient, t.exponent)}`;
}

/**
 * LaTeX for the transformed term. Differentiate: (a·n)·xⁿ⁻¹. Integrate: raise
 * the exponent and divide the coefficient — a/(n+1)·xⁿ⁺¹, shown as a clean
 * integer coefficient when it divides evenly, else as a fraction.
 */
export function resultTermLatex(
  t: PowerRuleTerm,
  lead: boolean,
  direction: SolveDirection,
): string {
  if (direction === "integrate") {
    const newExp = t.exponent + 1;
    const sign = t.coefficient < 0 ? "-" : "";
    const mag = Math.abs(t.coefficient);
    const lead0 = lead ? sign : "";
    if (mag % newExp === 0) {
      return `${lead0}${termBody(mag / newExp, newExp)}`;
    }
    const xPart = newExp === 1 ? "x" : `x^{${newExp}}`;
    const frac =
      mag === 1 ? `\\frac{${xPart}}{${newExp}}` : `\\frac{${mag}}{${newExp}}${xPart}`;
    return `${lead0}${frac}`;
  }
  const c = t.coefficient * t.exponent;
  const sign = c < 0 ? "-" : "";
  return `${lead ? sign : ""}${termBody(c, t.exponent - 1)}`;
}

/** The signed coefficient of the transformed term, used to pick its joining op. */
export function resultCoeff(t: PowerRuleTerm, direction: SolveDirection): number {
  return direction === "integrate" ? t.coefficient : t.coefficient * t.exponent;
}

/** The "+"/"−" joining a non-leading term, by the sign of its coefficient. */
export function opFor(coeff: number): string {
  return coeff < 0 ? "\u2212" : "+";
}

/** Number of manual beats: one per term, then a final "add the pieces" beat. */
export function polynomialBeatCount(terms: PowerRuleTerm[]): number {
  return terms.length + 1;
}

/**
 * Caption for a given manual beat, so the player can drive its caption banner in
 * sync with the controlled animation: beats `0…terms.length-1` narrate
 * transforming each term, and the final beat assembles the result. Authored
 * `overrides` (indexed by term) win on a term's beat.
 */
export function polynomialBeatCaption(
  terms: PowerRuleTerm[],
  beat: number,
  direction: SolveDirection,
  overrides?: string[],
): string {
  const total = terms.length;
  const clamped = Math.max(0, Math.min(beat, total));
  if (clamped >= total) {
    return direction === "integrate"
      ? "Add the pieces — that's $F(x)$ (plus a constant $C$)."
      : "Add the pieces — that's $f'(x)$.";
  }
  const override = overrides?.[clamped];
  if (override) return override;
  const t = terms[clamped];
  const src = sourceTermLatex(t, true);
  if (direction === "integrate") {
    if (t.exponent === 0) {
      const c = Math.abs(t.coefficient);
      const res = c === 1 ? "x" : `${c}x`;
      return `The constant $${c}$ integrates to $${res}$.`;
    }
    const res = resultTermLatex(t, true, "integrate");
    return `Integrate $${src}$: raise the exponent to $${t.exponent + 1}$, then divide → $${res}$.`;
  }
  if (t.exponent === 0) {
    return "A constant has slope $0$ everywhere, so it drops away.";
  }
  const res = resultTermLatex(t, true, "differentiate");
  return `Differentiate $${src}$: bring the exponent down → $${res}$.`;
}

/**
 * LaTeX for the assembled antiderivative F(x) built from the integrand `terms`
 * (each a·xⁿ → a/(n+1)·xⁿ⁺¹), joined with the right +/− operators — the same
 * result row the term-by-term integrate animation assembles.
 */
export function antiderivativeLatex(terms: PowerRuleTerm[]): string {
  const parts = terms.filter((t) => !isDropped(t, "integrate"));
  if (parts.length === 0) return "0";
  let out = resultTermLatex(parts[0], true, "integrate");
  for (let i = 1; i < parts.length; i++) {
    out += ` ${opFor(resultCoeff(parts[i], "integrate"))} ${resultTermLatex(parts[i], false, "integrate")}`;
  }
  return out;
}

/** Numeric value of the antiderivative F(x) = Σ a/(n+1)·xⁿ⁺¹ at a point. */
export function antiderivativeValueAt(terms: PowerRuleTerm[], x: number): number {
  return terms.reduce((sum, t) => {
    const n = t.exponent + 1;
    return sum + (t.coefficient / n) * Math.pow(x, n);
  }, 0);
}

/** Round to at most two decimals for a clean readout (9, 2.67, -1.5). */
export function formatSolveNumber(n: number): string {
  return `${Math.round(n * 100) / 100}`;
}

/**
 * Manual beats for the "evaluate a definite integral" walkthrough: build F(x)
 * term by term (the {@link polynomialBeatCount} build beats), then two more beats
 * — substitute the limits, then compute F(b) − F(a).
 */
export function ftcEvaluateBeatCount(terms: PowerRuleTerm[]): number {
  return polynomialBeatCount(terms) + 2;
}

/**
 * Caption for a given beat of the FTC-evaluate walkthrough. Beats `0…terms.length`
 * reuse the integrate build captions (per-term, then the assembled F); the next
 * beat sets up the substitution F(b) − F(a), and the last computes the number.
 */
export function ftcEvaluateCaption(
  terms: PowerRuleTerm[],
  a: number,
  b: number,
  beat: number,
  captions?: string[],
): string {
  if (beat < terms.length) {
    return polynomialBeatCaption(terms, beat, "integrate", captions);
  }
  if (beat === terms.length) {
    return "That's the antiderivative $F(x)$. In a definite integral the $+C$ cancels, so we can drop it.";
  }
  if (beat === terms.length + 1) {
    return `Now plug in the limits — the Fundamental Theorem says $\\int_{${a}}^{${b}} f(x)\\,dx = F(${b}) - F(${a})$.`;
  }
  const Fb = antiderivativeValueAt(terms, b);
  const Fa = antiderivativeValueAt(terms, a);
  const result = Fb - Fa;
  return `Evaluate: $F(${b}) - F(${a}) = ${formatSolveNumber(Fb)} - ${formatSolveNumber(Fa)} = ${formatSolveNumber(result)}$.`;
}
