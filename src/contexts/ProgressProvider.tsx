import {
  useCallback,
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
  buildMilestoneStats,
  clearAllProgress,
  nextStepProgress,
} from "../lib/progressService";
import { getPublishedLessons } from "../lib/contentLoader";
import { XP_PER_LESSON } from "../types/content";
import { ProgressContext, isLessonDone } from "./ProgressContext";

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
    // and feeding the profile heatmap. Re-check milestones here too so
    // question- and concept-based achievements unlock the moment the stat is
    // reached, not only when a lesson is finished.
    if (profile) {
      const active = recordActivity(profile);
      const mergedProgress = { ...progress, [lessonId]: updated };
      const milestones = checkMilestones(
        active.milestones,
        buildMilestoneStats(active, mergedProgress),
      );
      const newProfile = { ...active, milestones };
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

    const active = recordActivity(profile);
    // Award XP only the first time a lesson is finished, so replaying or
    // reviewing an already-completed lesson can't farm points.
    const xpGain = isLessonDone(current.status) ? 0 : XP_PER_LESSON;
    // Apply this completion and the freshly-earned XP before evaluating
    // milestones so lesson-, XP-, and concept-based achievements all reflect
    // the just-finished lesson.
    const withXp = { ...active, xp: (profile.xp ?? 0) + xpGain };
    const mergedProgress = { ...progress, [lessonId]: updated };
    const milestones = checkMilestones(
      withXp.milestones,
      buildMilestoneStats(withXp, mergedProgress),
    );
    const newProfile = { ...withXp, milestones };
    await saveUserProfile(user.uid, newProfile);
    setProfile(newProfile);
    return xpGain;
  };

  // Record a finished practice/review session: bank XP, tally the practice
  // questions answered (lesson questions are counted elsewhere and excluded
  // from this metric), and keep the streak/heatmap in sync. Persisted
  // immediately so the header badge stays current.
  const addXp = async (amount: number, practiceQuestions = 0) => {
    if (!user || !profile) return;
    // A finished practice/review session always registers as activity (streak +
    // heatmap). XP and the practice-question achievements only move for
    // questions cleared on the first try, so a zero-first-try round records the
    // session without adding either.
    const withXp = {
      ...recordActivity(profile),
      xp: (profile.xp ?? 0) + Math.max(0, amount),
      practiceQuestionsAnswered:
        (profile.practiceQuestionsAnswered ?? 0) + Math.max(0, practiceQuestions),
    };
    // Practice can push XP or first-try counts past a threshold, so re-check
    // milestones even though no lesson was completed.
    const milestones = checkMilestones(
      withXp.milestones,
      buildMilestoneStats(withXp, progress),
    );
    const newProfile = { ...withXp, milestones };
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
      const withXp = {
        ...profile,
        xp: (profile.xp ?? 0) + newlyCompleted * XP_PER_LESSON,
      };
      const milestones = checkMilestones(
        withXp.milestones,
        buildMilestoneStats(withXp, next),
      );
      const newProfile = { ...withXp, milestones };
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
        practiceQuestionsAnswered: 0,
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
