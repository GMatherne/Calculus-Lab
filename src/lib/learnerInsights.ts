import type { ConceptMasteryTier, LessonProgress } from "../types/content";
import { getConceptMastery } from "./masteryService";
import { daysSinceLastSeen } from "./reviewPlanner";
import { getLesson } from "./contentLoader";

/**
 * Learning-science signals about a single concept, assembled for the AI tutor.
 * Everything here is *derived* from already-persisted progress (mastery from
 * first-try accuracy, recency from each lesson's `updatedAt`) — no new storage.
 */
export interface ConceptInsight {
  /** Concept-tag slug, e.g. "power_rule". */
  concept: string;
  /** Human-readable label, e.g. "Power Rule". */
  label: string;
  /** Mastery tier from first-try accuracy across the concept's questions. */
  tier: ConceptMasteryTier;
  /** 0–100 share of the concept's questions answered correctly on the first try. */
  percent: number;
  /**
   * Days since the concept's teaching lessons were last touched, or null when
   * the learner has never worked them (treated as "not seen recently").
   */
  daysSinceSeen: number | null;
  /** Title of the concept's primary teaching lesson, for natural phrasing. */
  lessonTitle: string | null;
}

/**
 * Build the concept insight for `conceptTag` from the learner's saved progress.
 * Returns null when there's no concept tag or the tag isn't part of the course
 * catalog, so callers can simply skip personalization in those cases.
 */
export function getConceptInsight(
  progress: Record<string, LessonProgress>,
  conceptTag: string | undefined,
): ConceptInsight | null {
  if (!conceptTag) return null;
  const mastery = getConceptMastery(progress).find(
    (m) => m.concept === conceptTag,
  );
  if (!mastery) return null;

  const daysSinceSeen = daysSinceLastSeen(mastery.lessonIds, progress, Date.now());
  const primaryLessonId = mastery.lessonIds[0];
  const lessonTitle = primaryLessonId
    ? getLesson(primaryLessonId)?.title ?? null
    : null;

  return {
    concept: mastery.concept,
    label: mastery.label,
    tier: mastery.tier,
    percent: mastery.percent,
    daysSinceSeen,
    lessonTitle,
  };
}

/** Running per-concept answer counts for the current study session. */
export interface ConceptTally {
  label: string;
  missed: number;
  total: number;
}

/** Session miss tally keyed by concept-tag slug. */
export type SessionTally = Record<string, ConceptTally>;

/** A concept the learner has missed this session, for the tutor context. */
export interface SessionMiss {
  concept: string;
  label: string;
  count: number;
}

/**
 * Fold one graded answer into the session tally. Pure (returns a new object) so
 * it's trivially unit-testable; the provider just keeps the latest result in
 * state. Answers without a concept tag are ignored.
 */
export function tallyAnswer(
  state: SessionTally,
  conceptTag: string | undefined,
  label: string,
  isCorrect: boolean,
): SessionTally {
  if (!conceptTag) return state;
  const prev = state[conceptTag] ?? { label, missed: 0, total: 0 };
  return {
    ...state,
    [conceptTag]: {
      label: prev.label || label,
      missed: prev.missed + (isCorrect ? 0 : 1),
      total: prev.total + 1,
    },
  };
}

/**
 * The concepts missed at least once this session, most-missed first (ties
 * broken alphabetically by label for a stable order).
 */
export function sessionMisses(state: SessionTally): SessionMiss[] {
  return Object.entries(state)
    .filter(([, v]) => v.missed > 0)
    .map(([concept, v]) => ({ concept, label: v.label, count: v.missed }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
