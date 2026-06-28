import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/reducedMotion";

interface CountUpOptions {
  /** How long the roll takes, in milliseconds. */
  durationMs?: number;
  /** When false, the value snaps to the target without rolling. */
  animate?: boolean;
  /**
   * Value to start the very first roll from. Defaults to `target`, so the hook
   * shows the target immediately on mount and only rolls on later changes (good
   * for an always-visible total). Pass `0` to roll up from zero on mount (good
   * for a one-time celebration screen).
   */
  initial?: number;
}

/**
 * Animates a number toward `target` with an ease-out curve via
 * requestAnimationFrame, returning the value to display. Respects
 * `prefers-reduced-motion` by jumping straight to the target.
 */
export function useCountUp(
  target: number,
  { durationMs = 600, animate = true, initial }: CountUpOptions = {},
): number {
  const startValue = initial ?? target;
  const [display, setDisplay] = useState(startValue);
  // Tracks the most recent value shown so an interrupted roll resumes from
  // where it left off rather than snapping back.
  const displayRef = useRef(startValue);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayRef.current;

    if (!animate || prefersReducedMotion() || from === target) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const delta = target - from;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + delta * eased);
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs, animate]);

  return display;
}
