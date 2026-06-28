/**
 * Shared beat/caption logic for the Riemann "rectangle refinement" solve
 * animation, kept out of the component file so it can be imported by both
 * {@link RiemannRefineAnimation} and the lesson player (which drives the
 * animation beat-by-beat) without tripping react-refresh's "components only" rule.
 */

/**
 * The rectangle counts shown per beat by default: a few wide rectangles, then
 * progressively more (and thinner) ones, so the estimate visibly closes in on
 * the true area. A step may override this with its own `counts`.
 */
export const RIEMANN_REFINE_COUNTS = [2, 5, 12, 30] as const;

/** Number of manual beats a Riemann-refine walkthrough steps through. */
export function riemannRefineBeatCount(counts?: number[]): number {
  return (counts ?? RIEMANN_REFINE_COUNTS).length;
}

/**
 * Caption for a given manual beat, so the player can drive its caption banner in
 * sync with the animation. The first beat frames the rough estimate, the last
 * the limit, and any in-between beats describe the sharpening. Authored
 * `overrides` win when present.
 */
export function riemannRefineCaption(
  beat: number,
  total: number,
  overrides?: string[],
): string {
  const override = overrides?.[beat];
  if (override) return override;
  if (beat <= 0) {
    return "A few wide rectangles give a rough estimate — big gaps over the curve.";
  }
  if (beat >= total - 1) {
    return "In the limit of infinitely many thin slices, the gaps vanish and the estimate becomes the exact area — the integral.";
  }
  return "More, thinner rectangles hug the curve, shrinking the gaps and sharpening the estimate.";
}
