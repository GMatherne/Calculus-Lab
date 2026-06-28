import type {
  ConceptMastery,
  ConceptMasteryTier,
  ConceptStat,
} from "../types/content";
import {
  MASTERY_MASTERED,
  MASTERY_PROFICIENT,
  isInstructionStep,
} from "../types/content";
import { getLesson, getPublishedLessons, hasPractice } from "./contentLoader";

/** Per-concept practice/review stats, keyed by concept tag. */
export type ConceptStatMap = Record<string, ConceptStat>;

/**
 * Display names for concept-tag slugs. Slugs without an entry fall back to a
 * humanized version of the slug (see {@link conceptLabel}).
 */
const CONCEPT_LABELS: Record<string, string> = {
  rate_of_change: "Rate of Change",
  secant_tangent: "Secant & Tangent Lines",
  limit_definition: "Limit Definition",
  difference_quotient: "Difference Quotient",
  power_rule: "Power Rule",
  sum_rule: "Sum Rule",
  graph_shape: "Graph Shape",
  extrema: "Maxima & Minima",
  integral: "Integrals",
  area_under_curve: "Area Under a Curve",
  definite_integral: "Definite Integrals",
  ftc: "Fundamental Theorem",
  antiderivative: "Antiderivatives",
};

/** Title-case a snake_case slug as a fallback label, e.g. "graph_shape" -> "Graph Shape". */
export function conceptLabel(concept: string): string {
  return (
    CONCEPT_LABELS[concept] ??
    concept
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

/** A single answerable question that contributes to a concept's mastery. */
interface ConceptStepRef {
  lessonId: string;
  stepId: string;
  /** Index within the lesson's full `steps` array, used to judge "cleared". */
  stepIndex: number;
}

/** Everything static about one concept: its label, teaching lessons, and questions. */
export interface ConceptCatalogEntry {
  concept: string;
  label: string;
  /** Published lesson ids that teach this concept, in course order. */
  lessonIds: string[];
  steps: ConceptStepRef[];
}

/** Minimal shape of saved progress this module needs to score mastery. */
type ProgressInput = Record<
  string,
  {
    status?: string;
    currentStepIndex?: number;
    stepAttempts?: Record<string, number>;
    /** Step ids cleared via the "solve" assistance level; excluded from mastery. */
    solvedSteps?: string[];
    /** ISO timestamp of the last write, used to decay stale mastery. */
    updatedAt?: string;
  }
>;

let catalog: ConceptCatalogEntry[] | null = null;

/**
 * Concepts derived from the published course, ordered by first appearance.
 * Only answerable lesson steps count (practice attempts aren't persisted, so
 * they can't contribute to mastery). Computed once and cached.
 */
export function getConceptCatalog(): ConceptCatalogEntry[] {
  if (catalog) return catalog;

  const order: string[] = [];
  const byConcept = new Map<string, ConceptCatalogEntry>();

  for (const meta of getPublishedLessons()) {
    const lesson = getLesson(meta.id);
    if (!lesson) continue;

    lesson.steps.forEach((step, stepIndex) => {
      // Skip ungraded steps (read steps and Riemann demos); they're never
      // persisted as cleared, so they can't contribute to mastery.
      if (isInstructionStep(step) || !step.interaction?.answer) return;
      const concept = step.conceptTag;
      if (!concept) return;

      let entry = byConcept.get(concept);
      if (!entry) {
        entry = { concept, label: conceptLabel(concept), lessonIds: [], steps: [] };
        byConcept.set(concept, entry);
        order.push(concept);
      }
      if (!entry.lessonIds.includes(meta.id)) entry.lessonIds.push(meta.id);
      entry.steps.push({ lessonId: meta.id, stepId: step.id, stepIndex });
    });
  }

  catalog = order.map((concept) => byConcept.get(concept)!);
  return catalog;
}

function isLessonDone(status: string | undefined): boolean {
  return status === "complete" || status === "mastered";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many practice/review questions it takes for practice to *fully* determine
 * a concept's mastery, independent of how the lesson itself went. Below this the
 * lesson first-try accuracy still carries weight (so a single practice answer
 * only nudges); at or above it, sustained practice decides the mastery outright
 * — a learner who struggled through the lesson but then aces enough practice can
 * reach full mastery, and the rocky lesson start no longer caps them.
 */
const REVIEW_EVIDENCE_CAP = 8;

/** Days of no practice before mastery begins to decay. */
const MASTERY_DECAY_GRACE_DAYS = 14;
/** Days of no practice at which decay bottoms out at {@link MASTERY_DECAY_FLOOR}. */
const MASTERY_DECAY_HORIZON_DAYS = 90;
/**
 * The most disuse can erode mastery: a long-untouched concept retains this
 * fraction of its earned accuracy (it never evaporates to zero — you don't
 * fully forget — but it slips enough to resurface for review and drop a tier).
 */
const MASTERY_DECAY_FLOOR = 0.5;

/**
 * How much of a concept's mastery the lesson itself can account for. Acing the
 * lesson (or testing out / dev complete-all) with no practice tops out here;
 * the rest of the bar is earned through practice/review. Completing a lesson
 * shows you can do the material with the steps in front of you — it shouldn't
 * read as anywhere near mastery on its own.
 */
const LESSON_MASTERY_CEIL = 0.5;

/**
 * Effective mastery ratio (0–1) for a concept, combining lesson work and
 * practice/review. The lesson contributes at most {@link LESSON_MASTERY_CEIL}
 * (so a flawless-but-unpracticed lesson sits around the halfway mark), and
 * practice fills in the rest. The practice signal's pull grows with how many
 * questions back it, reaching full control at {@link REVIEW_EVIDENCE_CAP} — so
 * enough good practice carries a concept all the way to mastery regardless of a
 * shaky lesson, and enough poor practice lets it slip the same way.
 */
export function blendReviewRatio(
  lessonRatio: number,
  review: ConceptStat | undefined,
): number {
  const lessonComponent = LESSON_MASTERY_CEIL * lessonRatio;
  if (!review || review.seen <= 0) return lessonComponent;
  const reviewRatio = review.firstTryCorrect / review.seen;
  const weight = Math.min(review.seen, REVIEW_EVIDENCE_CAP) / REVIEW_EVIDENCE_CAP;
  return lessonComponent * (1 - weight) + reviewRatio * weight;
}

/**
 * Multiplier (0–1) applied to a concept's mastery for going stale: 1 within the
 * grace window, then ramping down to {@link MASTERY_DECAY_FLOOR} by the horizon.
 * A null age (we don't know when it was last seen) means no decay, so unknown
 * timing never penalizes the displayed number.
 */
export function masteryDecayMultiplier(daysSinceSeen: number | null): number {
  if (daysSinceSeen === null || daysSinceSeen <= MASTERY_DECAY_GRACE_DAYS) {
    return 1;
  }
  if (daysSinceSeen >= MASTERY_DECAY_HORIZON_DAYS) return MASTERY_DECAY_FLOOR;
  const span = MASTERY_DECAY_HORIZON_DAYS - MASTERY_DECAY_GRACE_DAYS;
  const progressed = (daysSinceSeen - MASTERY_DECAY_GRACE_DAYS) / span;
  return 1 - (1 - MASTERY_DECAY_FLOOR) * progressed;
}

/** Most recent valid timestamp (ms) among the given ISO strings, or null. */
function latestTimestamp(values: (string | undefined)[]): number | null {
  let latest: number | null = null;
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isNaN(t)) continue;
    if (latest === null || t > latest) latest = t;
  }
  return latest;
}

/** The tier for a concept given how much is cleared and its blended accuracy. */
function masteryTier(
  cleared: number,
  total: number,
  ratio: number,
): ConceptMasteryTier {
  if (total === 0 || cleared === 0) return "not_started";
  if (cleared < total) return "learning";
  if (ratio >= MASTERY_MASTERED) return "mastered";
  if (ratio >= MASTERY_PROFICIENT) return "proficient";
  return "learning";
}

/**
 * Mastery for every concept, in catalog order. A question is "cleared" when its
 * lesson is complete or the saved step pointer has advanced past it, and
 * "first-try" when it was cleared in a single attempt. The percentage starts
 * from the share of a concept's lesson questions answered correctly on the
 * first try (worth at most {@link LESSON_MASTERY_CEIL}), then blends in the
 * learner's practice/review performance (`conceptStats`) for the rest — so a
 * flawless-but-unpracticed lesson sits around the halfway mark, and reaching the
 * mastered band takes real practice (which can also carry a shaky lesson all the
 * way up). Finally it decays toward a floor the longer the concept goes
 * untouched, so mastery has to be maintained; `now` is injectable for
 * deterministic tests.
 */
export function getConceptMastery(
  progress: ProgressInput,
  conceptStats: ConceptStatMap = {},
  now: number = Date.now(),
): ConceptMastery[] {
  return getConceptCatalog().map((entry) => {
    let cleared = 0;
    let firstTry = 0;
    let total = 0;

    for (const ref of entry.steps) {
      const p = progress[ref.lessonId];
      // A step cleared via the "solve" assistance level is a worked example, not
      // a graded attempt: exclude it from mastery entirely (numerator and
      // denominator) so seeing the solution neither raises nor caps the concept.
      if (p?.solvedSteps?.includes(ref.stepId)) continue;
      total += 1;
      if (!p) continue;
      const isCleared =
        isLessonDone(p.status) || ref.stepIndex < (p.currentStepIndex ?? 0);
      if (!isCleared) continue;
      cleared += 1;
      if ((p.stepAttempts?.[ref.stepId] ?? 0) === 1) firstTry += 1;
    }

    const lessonRatio = total === 0 ? 0 : firstTry / total;
    const review = conceptStats[entry.concept];

    // Decay against the most recent of the concept's lesson activity and its
    // last practice, so practicing it refreshes the clock just like re-touching
    // the lessons does.
    const lastSeen = latestTimestamp([
      ...entry.lessonIds.map((id) => progress[id]?.updatedAt),
      review?.lastReviewed,
    ]);
    const daysSinceSeen =
      lastSeen === null ? null : Math.max(0, (now - lastSeen) / DAY_MS);
    const decay = masteryDecayMultiplier(daysSinceSeen);

    // Review only counts once the learner has actually started the concept, so
    // an untouched concept stays at 0% / not_started (and decay can't apply).
    // The blend caps the lesson's contribution, so reaching the mastered band
    // requires real practice however cleanly the lesson (or a test-out / dev
    // complete-all) went.
    const ratio =
      cleared === 0 ? 0 : blendReviewRatio(lessonRatio, review) * decay;
    return {
      concept: entry.concept,
      label: entry.label,
      tier: masteryTier(cleared, total, ratio),
      percent: Math.round(ratio * 100),
      firstTry,
      cleared,
      total,
      lessonIds: entry.lessonIds,
    };
  });
}

/** A weak concept plus where to send the learner to shore it up. */
export interface WeakConcept extends ConceptMastery {
  /** Practice (or lesson) route that best targets this concept. */
  reviewHref: string;
  /** Title of the lesson the review targets. */
  reviewLessonTitle: string;
}

/** Prefer a teaching lesson that has practice; otherwise the first one. */
function recommendedLessonId(mastery: ConceptMastery): string {
  return mastery.lessonIds.find((id) => hasPractice(id)) ?? mastery.lessonIds[0];
}

/**
 * The learner's weakest started-but-unmastered concepts, lowest mastery first,
 * each linked to the best place to practice it. Limited to `limit` entries.
 */
export function getWeakConcepts(
  progress: ProgressInput,
  limit = 3,
  conceptStats: ConceptStatMap = {},
): WeakConcept[] {
  return getConceptMastery(progress, conceptStats)
    .filter((m) => m.tier === "learning" || m.tier === "proficient")
    .sort((a, b) => a.percent - b.percent || a.cleared - b.cleared)
    .slice(0, limit)
    .map((m) => {
      const lessonId = recommendedLessonId(m);
      return {
        ...m,
        reviewHref: hasPractice(lessonId)
          ? `/lesson/${lessonId}/practice`
          : `/lesson/${lessonId}`,
        reviewLessonTitle: getLesson(lessonId)?.title ?? lessonId,
      };
    });
}
