import { createContext, useContext } from "react";
import type {
  ConceptSessionResult,
  LessonProgress,
  UserProfile,
} from "../types/content";
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
    /**
     * Explicit try count for this question. When provided, it replaces the
     * stored `stepAttempts[stepId]` instead of incrementing — used by multi-part
     * questions, which persist once and set attempts to `1 + missed parts` so
     * mastery's "first try" (attempts === 1) holds iff no part was missed.
     */
    attempts?: number,
  ) => Promise<void>;
  /**
   * Record a lesson step cleared via the "solve" assistance level: advance the
   * lesson past it like a correct answer, but flag it in `solvedSteps` so
   * mastery excludes it (a worked example is not a graded attempt). Never used in
   * practice mode, which doesn't offer "solve".
   */
  markStepSolved: (
    lessonId: string,
    stepIndex: number,
    stepId: string,
    answer: unknown,
  ) => Promise<void>;
  /** Finish a lesson and return the XP gained (0 when reviewing an already-done lesson). */
  completeLesson: (lessonId: string) => Promise<number>;
  /**
   * Mark one or more lessons complete because the learner *tested out* of them:
   * seed each lesson's mastery (so it doesn't read 0%), fold the test's
   * per-concept results into `conceptStats`, and award first-time lesson XP for
   * any lesson not already finished. Returns the XP gained. Drives both the
   * single-lesson and whole-level test-out skips.
   */
  completeLessonsTestedOut: (
    lessonIds: string[],
    conceptResults?: Record<string, ConceptSessionResult>,
  ) => Promise<number>;
  /**
   * Record a finished practice/review session: award `amount` XP, count
   * `practiceQuestions` toward the practice-question achievements, and fold the
   * per-concept first-try results into `conceptStats` so mastery reflects it.
   */
  addXp: (
    amount: number,
    practiceQuestions?: number,
    conceptResults?: Record<string, ConceptSessionResult>,
  ) => Promise<void>;
  /** Persist editable profile fields (display name / email) and update state. */
  updateProfileInfo: (
    fields: Partial<Pick<UserProfile, "displayName" | "email">>,
  ) => Promise<void>;
  /** Dev/testing only: mark every published lesson complete (unlocks them all). */
  completeAllLessons: () => Promise<void>;
  /** Dev/testing only: wipe all progress and reset streak/milestones. */
  resetProgress: () => Promise<void>;
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
