import { useCallback, useEffect } from "react";
import { useBlocker, type BlockerFunction } from "react-router-dom";

export interface SessionExitGuard {
  /** True while a navigation away from the active session is parked, awaiting a choice. */
  open: boolean;
  /** Proceed with the blocked navigation (the user chose to leave). */
  confirmLeave: () => void;
  /** Cancel the blocked navigation and stay on the page. */
  cancelLeave: () => void;
}

/**
 * Guards against leaving an in-progress practice/review session early — before
 * it finishes and banks XP. While `active`, in-app navigations are intercepted
 * (so a confirmation dialog can be shown) and a `beforeunload` listener warns on
 * tab close, refresh, or hard navigation.
 *
 * `active` should be false once the session reaches its results screen, which is
 * internal component state rather than a navigation — so finishing the session
 * never trips the guard.
 */
export function useSessionExitGuard(active: boolean): SessionExitGuard {
  // Only block a navigation that actually leaves the current path; a same-path
  // navigation isn't "leaving the session", so it should pass through.
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      active && currentLocation.pathname !== nextLocation.pathname,
    [active],
  );
  const blocker = useBlocker(shouldBlock);

  // Tab close / refresh / hard navigation can't be intercepted by the router, so
  // fall back to the browser's native "leave site?" prompt while active.
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  // If the session ends (e.g. transitions to results) while a navigation is
  // parked, release it so a stale block can't wedge the app.
  useEffect(() => {
    if (!active && blocker.state === "blocked") {
      blocker.reset();
    }
  }, [active, blocker]);

  const confirmLeave = useCallback(() => {
    if (blocker.state === "blocked") blocker.proceed();
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);

  return { open: blocker.state === "blocked", confirmLeave, cancelLeave };
}
