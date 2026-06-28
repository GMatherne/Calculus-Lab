/**
 * Whether the user has asked the OS to minimize animation
 * (`prefers-reduced-motion: reduce`). Guards `window`/`matchMedia` so it is safe
 * in non-browser (test/SSR) contexts, where it returns false. Shared by the
 * solve/montage animation components, the count-up hook, and the sound default,
 * which previously each carried their own identical copy.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
