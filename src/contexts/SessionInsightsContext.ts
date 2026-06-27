import { createContext, useContext } from "react";
import type { SessionMiss } from "../lib/learnerInsights";

/**
 * Tracks which concepts the learner has slipped on during the *current* study
 * session (in memory, reset on reload). It feeds the AI tutor so feedback can
 * acknowledge a recurring weak spot across a sitting — e.g. interleaved review.
 */
export interface SessionInsightsValue {
  /** Fold a graded answer's concept + verdict into the session tally. */
  recordAnswer: (conceptTag: string | undefined, isCorrect: boolean) => void;
  /** Concepts missed at least once this session, most-missed first. */
  getSessionMisses: () => SessionMiss[];
}

export const SessionInsightsContext =
  createContext<SessionInsightsValue | null>(null);

export function useSessionInsights() {
  const ctx = useContext(SessionInsightsContext);
  if (!ctx) {
    throw new Error(
      "useSessionInsights must be used within SessionInsightsProvider",
    );
  }
  return ctx;
}
