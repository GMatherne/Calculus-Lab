import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { LessonProgress, UserProfile } from "../types/content";
import { useAuth } from "./AuthContext";
import {
  getAllLessonProgress,
  getUserProfile,
  saveLessonProgress,
  saveUserProfile,
  recordActivity,
  checkMilestones,
  clearAllProgress,
  isLessonComplete,
  nextStepProgress,
} from "../lib/progressService";
import { getPublishedLessons } from "../lib/contentLoader";
import { XP_PER_LESSON } from "../types/content";

interface ProgressContextValue {
  profile: UserProfile | null;
  progress: Record<string, LessonProgress>;
  loading: boolean;
  updateStepProgress: (
    lessonId: string,
    stepIndex: number,
    stepId: string,
    answer: unknown,
    isCorrect: boolean,
  ) => Promise<void>;
  /** Finish a lesson and return the XP gained (0 when reviewing an already-done lesson). */
  completeLesson: (lessonId: string) => Promise<number>;
  /** Award XP for an activity that isn't a fresh lesson completion (e.g. practice). */
  addXp: (amount: number) => Promise<void>;
  /** Persist editable profile fields (display name / email) and update state. */
  updateProfileInfo: (
    fields: Partial<Pick<UserProfile, "displayName" | "email">>,
  ) => Promise<void>;
  /** Dev/testing only: mark every published lesson complete (unlocks them all). */
  completeAllLessons: () => Promise<void>;
  /** Dev/testing only: wipe all progress and reset streak/milestones. */
  resetProgress: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function defaultProgress(): LessonProgress {
  return {
    status: "not_started",
    currentStepIndex: 0,
    stepAttempts: {},
    stepAnswers: {},
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function isLessonDone(status: string | undefined): boolean {
  return isLessonComplete(status);
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProgress({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [p, prog] = await Promise.all([
      getUserProfile(user.uid),
      getAllLessonProgress(user.uid),
    ]);
    // After a verified email change, the auth record updates before the stored
    // profile does; reconcile so the displayed email stays correct.
    let resolved = p;
    if (p && user.email && p.email !== user.email) {
      resolved = { ...p, email: user.email };
      void saveUserProfile(user.uid, resolved);
    }
    setProfile(resolved);
    setProgress(prog);
    setLoading(false);
  }, [user]);

  // Load profile + progress when the signed-in identity changes. Keyed on the
  // uid (not the whole user object) so in-place profile edits — e.g. renaming or
  // changing email — don't retrigger a reload that would clobber the optimistic
  // update made by updateProfileInfo.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const updateStepProgress = async (
    lessonId: string,
    stepIndex: number,
    stepId: string,
    answer: unknown,
    isCorrect: boolean,
  ) => {
    if (!user) return;
    const current = progress[lessonId] ?? defaultProgress();
    const attempts = (current.stepAttempts[stepId] ?? 0) + 1;

    // Preserve completion when reviewing a finished lesson; otherwise advance.
    const { status, currentStepIndex } = nextStepProgress(
      current,
      stepIndex,
      isCorrect,
    );

    const updated: LessonProgress = {
      ...current,
      status,
      currentStepIndex,
      stepAttempts: { ...current.stepAttempts, [stepId]: attempts },
      stepAnswers: { ...current.stepAnswers, [stepId]: answer },
      updatedAt: new Date().toISOString(),
    };

    setProgress((prev) => ({ ...prev, [lessonId]: updated }));
    void saveLessonProgress(user.uid, lessonId, updated);

    // Each answered question counts as a day's activity, advancing the streak
    // and feeding the profile heatmap.
    if (profile) {
      const newProfile = recordActivity(profile);
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  const completeLesson = async (lessonId: string): Promise<number> => {
    if (!user || !profile) return 0;
    const current = progress[lessonId] ?? defaultProgress();
    const updated: LessonProgress = {
      ...current,
      status: "complete",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProgress((prev) => ({ ...prev, [lessonId]: updated }));
    await saveLessonProgress(user.uid, lessonId, updated);

    const published = getPublishedLessons();
    const completedCount = published.filter((l) => {
      const s = l.id === lessonId ? updated.status : progress[l.id]?.status;
      return isLessonDone(s);
    }).length;

    const active = recordActivity(profile);
    const milestones = checkMilestones(
      profile.milestones,
      completedCount,
      active.streak.count,
      published.length,
    );
    // Award XP only the first time a lesson is finished, so replaying or
    // reviewing an already-completed lesson can't farm points.
    const xpGain = isLessonDone(current.status) ? 0 : XP_PER_LESSON;
    const newProfile = {
      ...active,
      milestones,
      xp: (profile.xp ?? 0) + xpGain,
    };
    await saveUserProfile(user.uid, newProfile);
    setProfile(newProfile);
    return xpGain;
  };

  // Award XP for activities outside fresh lesson completion (e.g. practice and
  // review sessions). Persisted immediately so the header badge stays in sync.
  const addXp = async (amount: number) => {
    if (!user || !profile || amount <= 0) return;
    // Practice and review answers skip updateStepProgress, so record the
    // session here too — it keeps the streak and heatmap in sync.
    const newProfile = { ...recordActivity(profile), xp: (profile.xp ?? 0) + amount };
    setProfile(newProfile);
    await saveUserProfile(user.uid, newProfile);
  };

  const updateProfileInfo = async (
    fields: Partial<Pick<UserProfile, "displayName" | "email">>,
  ) => {
    if (!user || !profile) return;
    const newProfile = { ...profile, ...fields };
    setProfile(newProfile);
    await saveUserProfile(user.uid, newProfile);
  };

  // Dev/testing helpers, surfaced through DevTools, for jumping past lesson
  // locks without grinding through every lesson first.
  const completeAllLessons = async () => {
    if (!user) return;
    const published = getPublishedLessons();
    const now = new Date().toISOString();
    const next: Record<string, LessonProgress> = { ...progress };
    for (const meta of published) {
      const current = next[meta.id] ?? defaultProgress();
      next[meta.id] = {
        ...current,
        status: "complete",
        completedAt: current.completedAt ?? now,
        updatedAt: now,
      };
    }
    setProgress(next);
    await Promise.all(
      published.map((meta) =>
        saveLessonProgress(user.uid, meta.id, { ...next[meta.id] }),
      ),
    );
    if (profile) {
      // Only freshly-completed lessons earn XP (those not already done).
      const newlyCompleted = published.filter(
        (meta) => !isLessonDone(progress[meta.id]?.status),
      ).length;
      const milestones = checkMilestones(
        profile.milestones,
        published.length,
        profile.streak.count,
        published.length,
      );
      const newProfile = {
        ...profile,
        milestones,
        xp: (profile.xp ?? 0) + newlyCompleted * XP_PER_LESSON,
      };
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  const resetProgress = async () => {
    if (!user) return;
    setProgress({});
    await clearAllProgress(user.uid);
    if (profile) {
      const newProfile = {
        ...profile,
        streak: { count: 0, lastActiveDate: "" },
        milestones: [],
        xp: 0,
        activityLog: {},
      };
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  return (
    <ProgressContext.Provider
      value={{
        profile,
        progress,
        loading,
        updateStepProgress,
        completeLesson,
        addXp,
        updateProfileInfo,
        completeAllLessons,
        resetProgress,
        refresh,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
