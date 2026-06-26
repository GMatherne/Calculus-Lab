/**
 * Decorative electric glow that pulses around the XP badge while it's hovered.
 * The ring stays invisible until the parent `.group` is hovered (see the
 * `.group:hover` rules in index.css), so there's no idle animation cost. Render
 * inside a `group relative` container.
 */
export function ElectricityFX() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      <span className="xp-zap-ring absolute inset-0 rounded-full" />
    </span>
  );
}
