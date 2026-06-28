import type { Step, StepPart } from "../types/content";

/**
 * Runtime helpers for navigating a {@link Step} and its optional follow-up
 * {@link StepPart}s. Kept out of `types/content.ts` (which is now types-only) so
 * the data model and the small functions that operate on it live in separate
 * layers; the lesson player, grader, and progress/mastery services share these.
 */

/** Whether a step has any follow-up parts beyond its own interaction. */
export function isMultiPart(step: Step): boolean {
  return (step.parts?.length ?? 0) > 0;
}

/**
 * The step viewed as its own first {@link StepPart}, so the step's interaction
 * can be handled uniformly alongside its follow-ups. Defaults a missing
 * interaction to an empty object for the (graded) common case.
 */
function stepAsPart(step: Step): StepPart {
  return {
    id: step.id,
    conceptTag: step.conceptTag,
    content: step.content,
    interaction: step.interaction ?? {},
    feedback: step.feedback,
  };
}

/**
 * Every part of a step in display order: index 0 is the step's own interaction
 * (Part 1), followed by any authored {@link Step.parts}. A single-part step
 * yields a one-element array.
 */
export function getStepParts(step: Step): StepPart[] {
  return [stepAsPart(step), ...(step.parts ?? [])];
}

/**
 * Synthesize a {@link Step} that represents a single part, so the per-step
 * machinery — {@link checkAnswer}, {@link answerProximity}, and the AI tutor —
 * can grade and explain one part without special-casing. The part's
 * `conceptTag` wins, falling back to the parent step's.
 */
export function partAsStep(step: Step, part: StepPart): Step {
  return {
    id: part.id,
    type: step.type,
    conceptTag: part.conceptTag ?? step.conceptTag,
    content: part.content,
    interaction: part.interaction,
    feedback: part.feedback,
  };
}

/**
 * A Riemann step flagged as a demonstration (`answer.demo`): it renders the
 * interactive widget for the learner to explore, but isn't graded — it advances
 * with a "Continue" button and is excluded from concept mastery, just like a
 * read step.
 */
export function isRiemannDemo(step: Step): boolean {
  const answer = step.interaction?.answer;
  return answer?.type === "riemann" && answer.demo === true;
}

/**
 * Steps that present material without grading: plain `read` steps and Riemann
 * demos. These advance with "Continue", show as info in the step nav, and never
 * count toward concept mastery.
 */
export function isInstructionStep(step: Step): boolean {
  return step.type === "read" || isRiemannDemo(step);
}
