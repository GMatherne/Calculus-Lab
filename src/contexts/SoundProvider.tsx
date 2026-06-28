import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useProgress } from "./ProgressContext";
import { useSoundPreference } from "../hooks/useSoundPreference";
import { playSound, resumeAudio, setSoundEnabled } from "../lib/sound";
import { SoundContext } from "./SoundContext";

/**
 * Wires the sound engine into the app: keeps the engine's enabled flag in sync
 * with the learner's persisted preference, unlocks the AudioContext on the first
 * user gesture (browsers start audio suspended), plays a soft tap for any
 * interactive element, and turns XP / streak / milestone gains into sounds by
 * watching the profile — so those cues fire wherever the gain happens, including
 * mid-lesson where they have no screen of their own.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useSoundPreference();
  const { profile } = useProgress();

  // Push the preference into the (module-level) engine whenever it changes.
  useEffect(() => {
    setSoundEnabled(enabled);
  }, [enabled]);

  // Resume audio on the first interaction, and play a tap when an interactive
  // element is pressed. Both live for the app's lifetime, so they're installed
  // once; the engine no-ops while sound is disabled.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resumeOnce = () => {
      resumeAudio();
      window.removeEventListener("pointerdown", resumeOnce, true);
      window.removeEventListener("keydown", resumeOnce, true);
    };
    window.addEventListener("pointerdown", resumeOnce, true);
    window.addEventListener("keydown", resumeOnce, true);

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const el = target.closest<HTMLElement>(
        'button, a[href], [role="button"], summary',
      );
      if (!el) return;
      if (el.getAttribute("aria-disabled") === "true") return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      // Opt out by tagging any element (or an ancestor) with data-no-sound.
      if (el.closest("[data-no-sound]")) return;
      playSound("tap");
    };
    window.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", resumeOnce, true);
      window.removeEventListener("keydown", resumeOnce, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  // Watch the profile for in-session gains. Baselines are captured the first
  // time a profile is seen (and reset on sign-out) so loading or signing in
  // never triggers a celebration. When one update bumps several at once, only
  // the headline event sounds, keeping the moment from turning into a chord.
  const xpRef = useRef<number | null>(null);
  const streakRef = useRef<number | null>(null);
  const milestonesRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) {
      xpRef.current = null;
      streakRef.current = null;
      milestonesRef.current = null;
      return;
    }

    const xp = profile.xp ?? 0;
    const streak = profile.streak?.count ?? 0;
    const milestones = profile.milestones?.length ?? 0;

    if (
      xpRef.current === null ||
      streakRef.current === null ||
      milestonesRef.current === null
    ) {
      xpRef.current = xp;
      streakRef.current = streak;
      milestonesRef.current = milestones;
      return;
    }

    const milestoneUp = milestones > milestonesRef.current;
    const streakUp = streak > streakRef.current;
    const xpUp = xp > xpRef.current;

    xpRef.current = xp;
    streakRef.current = streak;
    milestonesRef.current = milestones;

    if (milestoneUp) playSound("milestone");
    else if (streakUp) playSound("streak");
    else if (xpUp) playSound("xp");
  }, [profile]);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
