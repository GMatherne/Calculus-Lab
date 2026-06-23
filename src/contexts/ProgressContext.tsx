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
  computeStreakUpdate,
  checkMilestones,
} from "../lib/progressService";
import { getPublishedLessons } from "../lib/contentLoader";

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
  completeLesson: (lessonId: string) => Promise<void>;
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
  return status === "complete" || status === "mastered";
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
    setProfile(p);
    setProgress(prog);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

    const updated: LessonProgress = {
      ...current,
      status: "in_progress",
      currentStepIndex: isCorrect ? stepIndex + 1 : stepIndex,
      stepAttempts: { ...current.stepAttempts, [stepId]: attempts },
      stepAnswers: { ...current.stepAnswers, [stepId]: answer },
      updatedAt: new Date().toISOString(),
    };

    setProgress((prev) => ({ ...prev, [lessonId]: updated }));
    void saveLessonProgress(user.uid, lessonId, updated);

    if (profile) {
      const streak = computeStreakUpdate(profile.streak);
      if (JSON.stringify(streak) !== JSON.stringify(profile.streak)) {
        const newProfile = { ...profile, streak };
        await saveUserProfile(user.uid, newProfile);
        setProfile(newProfile);
      }
    }
  };

  const completeLesson = async (lessonId: string) => {
    if (!user || !profile) return;
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

    const streak = computeStreakUpdate(profile.streak);
    const milestones = checkMilestones(
      profile.milestones,
      completedCount,
      streak.count,
      published.length,
    );
    const newProfile = { ...profile, streak, milestones };
    await saveUserProfile(user.uid, newProfile);
    setProfile(newProfile);
  };

  return (
    <ProgressContext.Provider
      value={{
        profile,
        progress,
        loading,
        updateStepProgress,
        completeLesson,
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
