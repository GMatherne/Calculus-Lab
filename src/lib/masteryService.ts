import type { ConceptMastery, ConceptMasteryTier } from "../types/content";
import { MASTERY_MASTERED, MASTERY_PROFICIENT } from "../types/content";
import { getLesson, getPublishedLessons, hasPractice } from "./contentLoader";

/**
 * Display names for concept-tag slugs. Slugs without an entry fall back to a
 * humanized version of the slug (see {@link conceptLabel}).
 */
export const CONCEPT_LABELS: Record<string, string> = {
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
function conceptLabel(concept: string): string {
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
      if (step.type === "read" || !step.interaction?.answer) return;
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

/** The tier for a concept given how much is cleared and how much was first-try. */
function masteryTier(
  cleared: number,
  firstTry: number,
  total: number,
): ConceptMasteryTier {
  if (total === 0 || cleared === 0) return "not_started";
  if (cleared < total) return "learning";
  const ratio = firstTry / total;
  if (ratio >= MASTERY_MASTERED) return "mastered";
  if (ratio >= MASTERY_PROFICIENT) return "proficient";
  return "learning";
}

/**
 * Mastery for every concept, in catalog order. A question is "cleared" when its
 * lesson is complete or the saved step pointer has advanced past it, and
 * "first-try" when it was cleared in a single attempt. The percentage is the
 * share of a concept's questions answered correctly on the first try.
 */
export function getConceptMastery(progress: ProgressInput): ConceptMastery[] {
  return getConceptCatalog().map((entry) => {
    let cleared = 0;
    let firstTry = 0;

    for (const ref of entry.steps) {
      const p = progress[ref.lessonId];
      if (!p) continue;
      const isCleared =
        isLessonDone(p.status) || ref.stepIndex < (p.currentStepIndex ?? 0);
      if (!isCleared) continue;
      cleared += 1;
      if ((p.stepAttempts?.[ref.stepId] ?? 0) === 1) firstTry += 1;
    }

    const total = entry.steps.length;
    const percent = total === 0 ? 0 : Math.round((firstTry / total) * 100);
    return {
      concept: entry.concept,
      label: entry.label,
      tier: masteryTier(cleared, firstTry, total),
      percent,
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
): WeakConcept[] {
  return getConceptMastery(progress)
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
