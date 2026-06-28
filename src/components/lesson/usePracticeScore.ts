import { useCallback, useRef } from "react";
import type { ConceptSessionResult, PracticeResult } from "../../types/content";
import { XP_PER_MULTIPART_BONUS } from "../../lib/constants";

interface RecordArgs {
  stepId: string;
  conceptTag?: string;
  /** Cleared with no wrong submissions across any part. */
  firstTry: boolean;
  /** Whether the question had follow-up parts (earns the multi-part bonus). */
  multiPart: boolean;
}

export interface PracticeScore {
  /**
   * Score one cleared question. Each step id counts once (its first clear), so
   * "Try Again" retries can't inflate the result. A first-try clear adds to the
   * score and, for a multi-part question, a flat XP bonus; every first clear is
   * tallied against its concept so the session can feed mastery.
   */
  record: (args: RecordArgs) => void;
  /** The session result for `total` questions, for LessonPlayer's onComplete. */
  result: (total: number) => PracticeResult;
}

/**
 * Practice/review scoring for a session run by {@link LessonPlayer}: the
 * first-try count, multi-part bonus XP, and the per-concept first-try tally
 * folded into lifetime mastery on the results screen. Kept in refs (not state)
 * because nothing needs to re-render as it accrues — it's read once when the
 * session ends.
 */
export function usePracticeScore(): PracticeScore {
  const scoredStepIds = useRef<Set<string>>(new Set());
  const correctFirstTry = useRef(0);
  const conceptResults = useRef<Record<string, ConceptSessionResult>>({});
  const bonusXp = useRef(0);

  const record = useCallback(
    ({ stepId, conceptTag, firstTry, multiPart }: RecordArgs) => {
      if (scoredStepIds.current.has(stepId)) return;
      scoredStepIds.current.add(stepId);
      if (firstTry) {
        correctFirstTry.current += 1;
        // A multi-part question still counts as one question, but earns a flat
        // bonus when cleared on the first try.
        if (multiPart) bonusXp.current += XP_PER_MULTIPART_BONUS;
      }
      // Tally this question against its concept so the session can feed mastery.
      // Counts the question once (first submission), first-try or not.
      if (conceptTag) {
        const prev = conceptResults.current[conceptTag] ?? {
          seen: 0,
          firstTryCorrect: 0,
        };
        conceptResults.current[conceptTag] = {
          seen: prev.seen + 1,
          firstTryCorrect: prev.firstTryCorrect + (firstTry ? 1 : 0),
        };
      }
    },
    [],
  );

  const result = useCallback(
    (total: number): PracticeResult => ({
      correct: correctFirstTry.current,
      total,
      bonusXp: bonusXp.current,
      conceptResults: conceptResults.current,
    }),
    [],
  );

  return { record, result };
}
