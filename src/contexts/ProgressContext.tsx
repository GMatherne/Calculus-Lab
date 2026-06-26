import { createContext, useContext } from "react";
import type { LessonProgress, UserProfile } from "../types/content";
import { isLessonComplete } from "../lib/progressService";

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
  /**
   * Record a finished practice/review session: award `amount` XP and count
   * `practiceQuestions` toward the practice-question achievements.
   */
  addXp: (amount: number, practiceQuestions?: number) => Promise<void>;
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

export const ProgressContext = createContext<ProgressContextValue | null>(null);

export function isLessonDone(status: string | undefined): boolean {
  return isLessonComplete(status);
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
