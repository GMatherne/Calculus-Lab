import { useEffect, useState } from "react";

/**
 * A short countdown "gate" that briefly blocks an advance button so the learner
 * is nudged to actually read or interact before moving on. While `active`, the
 * countdown (re)starts whenever `restartKey` changes and returns the whole
 * seconds remaining, ticking down to 0 once `durationMs` has elapsed; when
 * `active` is false it stays at 0. The caller treats a returned value > 0 as
 * "locked".
 *
 * Deliberately ignores `prefers-reduced-motion`: this is a functional pause that
 * paces the lesson, not a decorative animation, so it must hold for everyone.
 */
export function useActionLock(
  restartKey: unknown,
  durationMs: number,
  active = true,
): number {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!active || durationMs <= 0) {
      setSecondsLeft(0);
      return;
    }
    const start = performance.now();
    const remaining = () =>
      Math.max(0, Math.ceil((durationMs - (performance.now() - start)) / 1000));
    setSecondsLeft(remaining());
    // Tick faster than once a second so the unlock lands promptly; React bails on
    // the no-op setState between whole-second boundaries, so this re-renders only
    // a handful of times (once per second counted down).
    const id = setInterval(() => {
      const left = remaining();
      setSecondsLeft(left);
      if (left <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [restartKey, durationMs, active]);

  return secondsLeft;
}
