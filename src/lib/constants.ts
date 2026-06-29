import type { AssistanceLevel } from "../types/content";

/**
 * Tuning constants for the course: step counts, XP rewards, session sizes,
 * test-out thresholds, authoring minimums, and mastery cutoffs. Pulled out of
 * `types/content.ts` so that file holds only types, and so these values have one
 * obvious home shared by the content loader, validator, mastery/review logic,
 * and the UI.
 */

/** The assistance level a brand-new learner starts on before changing the toggle. */
export const DEFAULT_ASSISTANCE_LEVEL: AssistanceLevel = "hints";

export const MIN_STEPS = 6;
export const MAX_STEPS = 10;

/** XP awarded the first time a lesson is completed. */
export const XP_PER_LESSON = 50;

/**
 * XP awarded per question answered correctly on the first try during a practice
 * or review session. Worth less than a full lesson so new material stays the
 * primary way to earn XP.
 */
export const XP_PER_PRACTICE_CORRECT = 10;

/**
 * Flat bonus XP for a multi-part question. A multi-part question still counts as
 * a single question for scoring and mastery, but earns this extra on top — in a
 * lesson it's added per multi-part step on first completion, and in practice
 * it's added per multi-part question cleared on the first try.
 */
export const XP_PER_MULTIPART_BONUS = 5;

/** Questions shown in a single lesson practice session (sampled from the bank). */
export const PRACTICE_SESSION_SIZE = 3;

/** Questions shown in a single cross-lesson mixed-review session. */
export const REVIEW_SESSION_SIZE = 5;

/** Default question count pre-filled when a learner opens custom practice. */
export const CUSTOM_PRACTICE_DEFAULT_SIZE = 5;

/** Upper bound on how many questions a single custom practice set may request. */
export const CUSTOM_PRACTICE_MAX_SIZE = 20;

/**
 * First-try accuracy (0–1) a learner must reach on a test-out challenge to skip
 * the lesson(s) it covers. Set high on purpose: testing out should require real
 * fluency, not a coin-flip pass.
 */
export const TEST_OUT_PASS_RATIO = 0.8;

/** Target number of questions per concept within a single lesson's test-out draw. */
export const TEST_OUT_PER_CONCEPT = 2;

/**
 * Questions drawn from each lesson a skip-ahead spans. A skip-ahead test-out
 * pulls this quota from every lesson up to and including the target level, so a
 * test that bypasses more lessons is proportionally longer and each bypassed
 * lesson is guaranteed representation.
 */
export const TEST_OUT_PER_LESSON = 3;

/** Fewest questions a test-out must be able to offer to be worth taking. */
export const TEST_OUT_MIN_QUESTIONS = 3;

/** Minimum number of questions a practice bank should contain. */
export const PRACTICE_BANK_MIN = PRACTICE_SESSION_SIZE;

/** Minimum number of answer choices every multiple-choice question must offer. */
export const MIN_MC_OPTIONS = 4;

/** Minimum number of pairs a match question must offer. */
export const MIN_MATCH_PAIRS = 2;

/**
 * First-try accuracy (0–1) needed to count a fully-covered concept as
 * "proficient" — every question cleared, most of them on the first try.
 */
export const MASTERY_PROFICIENT = 0.6;

/**
 * First-try accuracy (0–1) needed to count a fully-covered concept as
 * "mastered" — every question cleared, nearly all on the first try.
 */
export const MASTERY_MASTERED = 0.9;
