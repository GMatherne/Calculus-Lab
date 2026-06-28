import { useMemo, useState } from "react";
import type { Lesson, PracticeResult, Step } from "../types/content";
import { useSessionExitGuard, type SessionExitGuard } from "./useSessionExitGuard";

export interface QuizSessionConfig {
  /**
   * Page-level preconditions for the player to be live (guards passed, not
   * loading, access allowed, intro dismissed, …). Combined with "a non-empty
   * question set exists" and "no result yet" to drive the exit guard.
   */
  ready: boolean;
  /** Identity for the throwaway lesson that wraps the sampled questions. */
  lesson: Pick<Lesson, "id" | "title" | "order">;
  /**
   * Draw this attempt's questions. Re-run whenever the attempt counter bumps
   * (and whenever an entry in {@link QuizSessionConfig.resampleKey} changes).
   */
  buildSteps: () => Step[];
  /** Extra dependencies that should also re-sample the set (e.g. a lesson id). */
  resampleKey?: unknown[];
}

export interface QuizSession {
  attempt: number;
  steps: Step[];
  /** Synthetic lesson for the player, or undefined when there are no questions. */
  lesson: Lesson | undefined;
  result: PracticeResult | null;
  /** True only while the player is on screen (ready, lesson present, no result). */
  active: boolean;
  exitGuard: SessionExitGuard;
  /** Stable remount key so each attempt starts the player fresh. */
  playerKey: string;
  /** LessonPlayer's onComplete: store the result, falling back to a 0/total score. */
  complete: (result?: PracticeResult) => void;
  /** Clear the result and re-sample for another attempt. */
  retry: () => void;
}

/**
 * The shared state machine behind every practice/review/test-out page: hold the
 * latest result, re-sample a fresh question set per attempt, wrap it in a
 * throwaway {@link Lesson} for the player (in practice mode, so real progress is
 * untouched), and guard against leaving before the session banks its XP. Pages
 * keep their own guards, intros, pickers, and results screens and feed this the
 * `ready` flag plus how to build the set.
 */
export function useQuizSession({
  ready,
  lesson: meta,
  buildSteps,
  resampleKey = [],
}: QuizSessionConfig): QuizSession {
  const [result, setResult] = useState<PracticeResult | null>(null);
  // Bumping this remounts the player AND re-samples, so each attempt is fresh.
  const [attempt, setAttempt] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const steps = useMemo(buildSteps, [attempt, ...resampleKey]);

  const lesson = useMemo<Lesson | undefined>(
    () =>
      steps.length > 0
        ? {
            id: meta.id,
            title: meta.title,
            order: meta.order,
            estimatedMinutes: 0,
            conceptTags: [],
            published: true,
            steps,
          }
        : undefined,
    [steps, meta.id, meta.title, meta.order],
  );

  // The player is truly on screen only when the page's guards pass, a set
  // exists, and we haven't reached the results screen.
  const active = ready && !!lesson && result === null;
  const exitGuard = useSessionExitGuard(active);

  return {
    attempt,
    steps,
    lesson,
    result,
    active,
    exitGuard,
    playerKey: `${meta.id}-${attempt}`,
    complete: (r) => setResult(r ?? { correct: 0, total: steps.length }),
    retry: () => {
      setResult(null);
      setAttempt((a) => a + 1);
    },
  };
}
