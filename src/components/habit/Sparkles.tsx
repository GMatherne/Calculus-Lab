import { Icon } from "../common/Icon";

interface SparklesProps {
  /**
   * Change this value to replay the burst. Re-keying the inner node remounts
   * the particles so their CSS animation restarts on each gain.
   */
  trigger?: number;
  className?: string;
}

/** Direction (px) and size (Tailwind w/h) each particle flies out to. */
const PARTICLES = [
  { tx: -24, ty: -12, size: "h-3.5 w-3.5" },
  { tx: 20, ty: -18, size: "h-3 w-3" },
  { tx: -16, ty: 16, size: "h-3 w-3" },
  { tx: 22, ty: 12, size: "h-3.5 w-3.5" },
  { tx: 0, ty: -26, size: "h-4 w-4" },
  { tx: -2, ty: 24, size: "h-3 w-3" },
];

/**
 * A purely decorative burst of sparkles that flies outward from the centre of
 * the positioned parent. Render inside a `relative` container.
 */
export function Sparkles({ trigger = 0, className = "" }: SparklesProps) {
  return (
    <span
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      aria-hidden
    >
      <span key={trigger} className="relative">
        {PARTICLES.map((p, i) => (
          <Icon
            key={i}
            name="sparkle"
            fill="currentColor"
            className={`xp-sparkle absolute left-0 top-0 text-amber-300 ${p.size}`}
            style={
              {
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                animationDelay: `${i * 40}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
    </span>
  );
}
