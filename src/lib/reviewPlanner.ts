import type { ConceptMastery, Step } from "../types/content";
import { REVIEW_SESSION_SIZE } from "../types/content";
import { getConceptMastery, type ConceptStatMap } from "./masteryService";
import { getReviewBank, shuffle } from "./contentLoader";

/**
 * Builds a *targeted* review session instead of a purely random one. It blends
 * two signals we already track, with no scheduling and no extra persisted data:
 *
 * - **Weakness** — concepts the learner has seen but answers shakily, from
 *   first-try mastery (`masteryService`).
 * - **Recency / spacing** — how long since the concept's lessons were last
 *   touched, so stale topics resurface (a lightweight nod to the spacing effect).
 *
 * Both are computed on the fly from existing progress; nothing here is written
 * back. A manual "pick my topics" mode is intentionally out of scope.
 */

/** Days after which a concept counts as fully "stale" for the recency signal. */
const SPACING_HORIZON_DAYS = 14;

/** Relative pull of weakness vs. recency in the priority score (sum to 1). */
const WEAKNESS_WEIGHT = 0.65;
const RECENCY_WEIGHT = 0.35;

/** How many top concepts a single review session spreads across (interleaving). */
const TARGET_CONCEPT_SPREAD = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Progress shape this planner needs: enough to score mastery, plus recency. */
type ReviewProgressInput = Record<
  string,
  {
    status: string;
    currentStepIndex?: number;
    stepAttempts?: Record<string, number>;
    /** ISO timestamp of the last write to this lesson's progress. */
    updatedAt?: string;
  }
>;

/** A seen concept ranked for review, with the signals behind its priority. */
export interface ReviewPriority {
  concept: string;
  label: string;
  /** Combined weakness + recency score; higher means review sooner. */
  priority: number;
  /** 0–1 share of the concept's questions missed on the first try. */
  weakness: number;
  /** 0–1 staleness, saturating at `SPACING_HORIZON_DAYS` since last seen. */
  recency: number;
  mastery: ConceptMastery;
}

/** Whether a question is hands-on, i.e. backed by a manipulable graph. */
function isInteractive(step: Step): boolean {
  return Boolean(step.interaction?.graph);
}

/**
 * Days since the most recent progress write across a concept's teaching
 * lessons. Returns null when none of them carry a usable timestamp, which the
 * caller treats as fully stale (the concept hasn't been refreshed recently).
 * Exported so the AI tutor's learner-history insights can reuse the same
 * recency math rather than duplicating it.
 */
export function daysSinceLastSeen(
  lessonIds: string[],
  progress: ReviewProgressInput,
  now: number,
): number | null {
  let mostRecent: number | null = null;
  for (const id of lessonIds) {
    const updatedAt = progress[id]?.updatedAt;
    if (!updatedAt) continue;
    const t = Date.parse(updatedAt);
    if (Number.isNaN(t)) continue;
    if (mostRecent === null || t > mostRecent) mostRecent = t;
  }
  if (mostRecent === null) return null;
  return Math.max(0, (now - mostRecent) / DAY_MS);
}

/**
 * Seen concepts (at least one question cleared) ranked for review, strongest
 * priority first. Not-started concepts are excluded — review only resurfaces
 * material the learner has actually worked through.
 */
export function getReviewPriorities(
  progress: ReviewProgressInput,
  conceptStats: ConceptStatMap = {},
): ReviewPriority[] {
  const now = Date.now();
  return getConceptMastery(progress, conceptStats, now)
    .filter((m) => m.cleared > 0)
    .map((m) => {
      // Weakness tracks the blended mastery percent (lesson + review), so doing
      // well in review lowers a concept's priority and it stops being nagged.
      const weakness = 1 - m.percent / 100;
      // "Last seen" is the more recent of the concept's lessons being touched
      // and the learner practicing it, so a fresh review resets staleness too
      // (otherwise a just-reviewed concept would keep resurfacing on recency).
      const lessonDays = daysSinceLastSeen(m.lessonIds, progress, now);
      const reviewedAt = conceptStats[m.concept]?.lastReviewed;
      const reviewDays =
        reviewedAt && !Number.isNaN(Date.parse(reviewedAt))
          ? Math.max(0, (now - Date.parse(reviewedAt)) / DAY_MS)
          : null;
      const days =
        lessonDays === null
          ? reviewDays
          : reviewDays === null
            ? lessonDays
            : Math.min(lessonDays, reviewDays);
      // A missing timestamp means we can't tell when it was last seen, so bias
      // toward resurfacing it (treat as fully stale).
      const recency = days === null ? 1 : Math.min(1, days / SPACING_HORIZON_DAYS);
      const priority = WEAKNESS_WEIGHT * weakness + RECENCY_WEIGHT * recency;
      return { concept: m.concept, label: m.label, priority, weakness, recency, mastery: m };
    })
    .sort((a, b) => b.priority - a.priority || b.weakness - a.weakness);
}

/** The review pool grouped by `conceptTag`, drawn from reviewable lessons. */
function questionsByConcept(progress: ReviewProgressInput): Map<string, Step[]> {
  const byConcept = new Map<string, Step[]>();
  for (const step of getReviewBank(progress)) {
    const concept = step.conceptTag;
    if (!concept) continue;
    const list = byConcept.get(concept);
    if (list) list.push(step);
    else byConcept.set(concept, [step]);
  }
  return byConcept;
}

/**
 * Labels of the concepts this review will focus on (those highest-priority
 * concepts that actually have review questions available), for UI copy like
 * "Focus on Power Rule & Integrals". Empty when nothing is eligible yet.
 */
export function getReviewTargets(
  progress: ReviewProgressInput,
  limit: number = TARGET_CONCEPT_SPREAD,
  conceptStats: ConceptStatMap = {},
): string[] {
  const byConcept = questionsByConcept(progress);
  return getReviewPriorities(progress, conceptStats)
    .filter((p) => byConcept.has(p.concept))
    .slice(0, limit)
    .map((p) => p.label);
}

/**
 * A targeted review session: questions interleaved across the learner's
 * highest-priority (weakest + stalest) concepts, favoring hands-on graph
 * questions within each. Higher-priority concepts are drawn first, so they
 * contribute the most. When prioritized concepts can't fill the session — early
 * learners, sparse banks, or nothing seen yet — it backfills from the broader
 * random review pool so a session is always as full as the available material
 * allows. The final order is shuffled.
 */
export function getTargetedReviewSession(
  progress: ReviewProgressInput,
  size: number = REVIEW_SESSION_SIZE,
  conceptStats: ConceptStatMap = {},
): Step[] {
  const byConcept = questionsByConcept(progress);

  // One queue per top concept, ordered interactive-first then shuffled within
  // each tier so the draw stays hands-on but varied between sessions.
  const queues = getReviewPriorities(progress, conceptStats)
    .filter((p) => byConcept.has(p.concept))
    .slice(0, TARGET_CONCEPT_SPREAD)
    .map((p) => {
      const pool = byConcept.get(p.concept) ?? [];
      const interactive = shuffle(pool.filter(isInteractive));
      const plain = shuffle(pool.filter((s) => !isInteractive(s)));
      return [...interactive, ...plain];
    });

  const picked: Step[] = [];
  const seenIds = new Set<string>();

  // Round-robin across concept queues so the session interleaves topics,
  // weighted toward the highest-priority concepts (listed first).
  let addedThisPass = true;
  while (picked.length < size && addedThisPass) {
    addedThisPass = false;
    for (const queue of queues) {
      if (picked.length >= size) break;
      const next = queue.shift();
      if (!next || seenIds.has(next.id)) continue;
      picked.push(next);
      seenIds.add(next.id);
      addedThisPass = true;
    }
  }

  // Backfill from the broader random pool when the targeted draw came up short.
  if (picked.length < size) {
    for (const step of shuffle(getReviewBank(progress))) {
      if (picked.length >= size) break;
      if (seenIds.has(step.id)) continue;
      picked.push(step);
      seenIds.add(step.id);
    }
  }

  return shuffle(picked);
}
