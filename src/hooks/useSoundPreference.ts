import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { prefersReducedMotion } from "../lib/reducedMotion";

const KEY_BASE = "derivatives_sound_enabled";

function storageKey(uid?: string): string {
  return uid ? `${KEY_BASE}_${uid}` : KEY_BASE;
}

/**
 * A brand-new learner gets sound effects on, unless their OS asks for reduced
 * motion — there is no broadly-supported "reduced sound" media query, so the
 * reduce-motion signal doubles as a "keep it calm" cue here. An explicit saved
 * choice always wins over this default.
 */
function defaultEnabled(): boolean {
  return !prefersReducedMotion();
}

function readEnabled(uid?: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw === "on") return true;
    if (raw === "off") return false;
    return defaultEnabled();
  } catch {
    return defaultEnabled();
  }
}

/**
 * The learner's sticky sound-effects preference, persisted in `localStorage` per
 * signed-in user (mirroring {@link useAssistancePreference}). Kept off the synced
 * profile so toggling never triggers a network write.
 */
export function useSoundPreference(): [boolean, (enabled: boolean) => void] {
  const { user } = useAuth();
  const uid = user?.uid;
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled(uid));

  // Re-read when the signed-in identity changes, so switching accounts on a
  // shared device doesn't carry one learner's preference into another's.
  useEffect(() => {
    setEnabledState(readEnabled(uid));
  }, [uid]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      try {
        localStorage.setItem(storageKey(uid), next ? "on" : "off");
      } catch {
        // Ignore storage failures (e.g. private mode); the in-memory value still
        // drives this session.
      }
    },
    [uid],
  );

  return [enabled, setEnabled];
}
