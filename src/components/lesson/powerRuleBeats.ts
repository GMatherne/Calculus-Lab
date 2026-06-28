/**
 * Shared beat/caption logic for the power-rule animation, kept out of the
 * component file so it can be imported by both {@link PowerRuleAnimation} and the
 * lesson player (which drives the walkthrough beat-by-beat) without tripping
 * react-refresh's "components only" rule.
 *
 * The rule is shown as a three-line derivation: d/dx(a·xⁿ) → n(a·xⁿ⁻¹) → a·n·xⁿ⁻¹.
 * Pulling the power out in front as a factor (with the exponent already lowered),
 * then multiplying it into the coefficient, avoids the awkward "loose number
 * beside the coefficient" of a literal exponent drop.
 */
export const PHASES = ["start", "factor", "combine"] as const;
export type PowerRulePhase = (typeof PHASES)[number];

/** Number of beats a power-rule walkthrough steps through. */
export const POWER_RULE_BEAT_COUNT = PHASES.length;

/** Default caption for a beat, specialized for the a = 1 and constant cases. */
export function captionFor(
  a: number,
  n: number,
  phase: PowerRulePhase,
  overrides?: string[],
): string {
  const beat = PHASES.indexOf(phase);
  const override = overrides?.[beat];
  if (override) return override;
  const isConstant = n === 0;
  switch (beat) {
    case 0:
      return isConstant
        ? "A constant term has no x to vary"
        : "Differentiate the term";
    case 1:
      return isConstant
        ? "So its rate of change is 0"
        : "Bring the power n down in front, and lower the exponent by one";
    default:
      return isConstant
        ? "The derivative of a constant is 0"
        : a === 1
          ? "That is the derivative"
          : "Multiply n into the coefficient — that is the derivative";
  }
}

/**
 * The caption for a given manual beat of the power-rule walkthrough, so the
 * player can drive its own caption banner in sync with the controlled animation.
 */
export function powerRuleBeatCaption(
  coefficient: number,
  exponent: number,
  beat: number,
  overrides?: string[],
): string {
  const phase = PHASES[Math.max(0, Math.min(POWER_RULE_BEAT_COUNT - 1, beat))];
  return captionFor(coefficient, exponent, phase, overrides);
}
