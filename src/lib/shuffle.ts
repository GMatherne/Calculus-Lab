/**
 * A permutation of [0, n) that differs from the identity order when possible, so
 * a question (or a multi-choice row) authored with the correct answer first
 * doesn't always display it first. Returns the identity order for n < 2, or after
 * a few failed attempts to perturb it (e.g. when every option looks the same).
 * The display order moves while the underlying indices map back to the authored
 * positions, so grading is unaffected.
 */
export function shuffledIndices(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return order;
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  return order;
}
