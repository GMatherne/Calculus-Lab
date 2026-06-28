import { useCallback, useEffect, useState } from "react";
import type { AssistanceLevel } from "../types/content";
import { DEFAULT_ASSISTANCE_LEVEL } from "../lib/constants";
import { useAuth } from "../contexts/AuthContext";

const KEY_BASE = "derivatives_assistance_level";

function storageKey(uid?: string): string {
  return uid ? `${KEY_BASE}_${uid}` : KEY_BASE;
}

function isAssistanceLevel(value: unknown): value is AssistanceLevel {
  return value === "solve" || value === "hints" || value === "none";
}

function readLevel(uid?: string): AssistanceLevel {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return isAssistanceLevel(raw) ? raw : DEFAULT_ASSISTANCE_LEVEL;
  } catch {
    return DEFAULT_ASSISTANCE_LEVEL;
  }
}

/**
 * The learner's sticky assistance-level preference, persisted in `localStorage`
 * per signed-in user. Defaults new learners to {@link DEFAULT_ASSISTANCE_LEVEL}
 * ("hints"). Setting it on any question updates the default for the next one, so
 * a learner picks their help level once and it carries over (overridable any
 * time). Kept off the synced profile so toggling never triggers a network write.
 */
export function useAssistancePreference(): [
  AssistanceLevel,
  (level: AssistanceLevel) => void,
] {
  const { user } = useAuth();
  const uid = user?.uid;
  const [level, setLevelState] = useState<AssistanceLevel>(() => readLevel(uid));

  // Re-read when the signed-in identity changes, so switching accounts on a
  // shared device doesn't carry one learner's preference into another's.
  useEffect(() => {
    setLevelState(readLevel(uid));
  }, [uid]);

  const setLevel = useCallback(
    (next: AssistanceLevel) => {
      setLevelState(next);
      try {
        localStorage.setItem(storageKey(uid), next);
      } catch {
        // Ignore storage failures (e.g. private mode); the in-memory value still
        // drives this session.
      }
    },
    [uid],
  );

  return [level, setLevel];
}
