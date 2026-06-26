/**
 * Decorative warm glow that flickers around the streak badge while it's hovered.
 * Like {@link ElectricityFX}, the ring stays invisible until the parent
 * `.group` is hovered, so there's no idle animation cost. Render inside a
 * `group relative` container.
 */
export function FireFX() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      <span className="streak-glow-ring absolute inset-0 rounded-full" />
    </span>
  );
}
