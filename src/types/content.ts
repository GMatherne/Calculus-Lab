export type StepType =
  | "read"
  | "multiple_choice"
  | "numeric"
  | "slider_graph"
  | "power_term";

export type LessonStatus =
  | "not_started"
  | "in_progress"
  | "complete";

export interface TextBlock {
  type: "text";
  body: string;
}

export interface MathBlock {
  type: "math";
  latex: string;
  display?: boolean;
}

export type ContentBlock = TextBlock | MathBlock;

export interface GraphConfig {
  fn: string;
  domain: [number, number];
  /** Explicit y-axis range. When omitted, the range is derived from the data. */
  yDomain?: [number, number];
  fixedPoint?: number;
  sliderLabel?: string;
  showSecant?: boolean;
  showTangent?: boolean;
  /**
   * Draw the tangent at the FIXED point (`fixedPoint`) as a static reference
   * line while the secant slides. Pair with `showSecant` and an `h` slider so
   * the learner can watch the secant converge onto the tangent as h → 0.
   */
  tangentAtFixedPoint?: boolean;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  initialSlider?: number;
  xLabel?: string;
  yLabel?: string;
  /** Override the slope readout label (e.g. "Rate of change"). */
  slopeLabel?: string;
  /**
   * Show the live slope/secant readout. Defaults to on whenever a tangent or
   * secant is drawn. Set false to keep the line visible but hide the number, so
   * a "find the x where the slope is …" question can't be solved by matching.
   */
  showSlopeValue?: boolean;
  /** Show a live "f(x) = value" readout for the current slider position. Defaults to on. */
  showValue?: boolean;
  /**
   * Render the graph as a static, non-interactive illustration: no slider and
   * no live readouts, just the curve (plus any marker/area below). Used to give
   * a relevant visual to questions whose answer is typed, picked, or built
   * rather than read off the graph.
   */
  static?: boolean;
  /**
   * For static illustrations, mark this x on the curve with a dot and a dashed
   * guide down to the x-axis. When `showTangent` is also set, the tangent line
   * is drawn there too. Anchors a question like "the slope at x = 3" without
   * revealing the numeric answer.
   */
  markerX?: number;
  /**
   * For tap-the-point questions, snap the tapped x to the nearest multiple of
   * this value (e.g. 0.5) so the learner can't pick arbitrarily precise points.
   */
  pointSnap?: number;
  /**
   * For tap-the-point questions, render these x-values as discrete, visible dots
   * on the curve. A tap snaps to the nearest dot, so the submitted x is always
   * exactly one of these values (no fuzzy decimals like 2.02). Takes precedence
   * over `pointSnap` when both are set.
   */
  pointChoices?: number[];
  /**
   * Shade the area between the curve and the x-axis, from `areaStart` to the
   * slider's current x. This is the visual for an integral (accumulated area).
   */
  showArea?: boolean;
  /** Left edge of the shaded area. Defaults to the domain minimum. */
  areaStart?: number;
  /** Show a live "area ≈ value" readout. Defaults to on when `showArea` is set. */
  showAreaValue?: boolean;
  /** Override the area readout label (e.g. "Shaded area"). */
  areaLabel?: string;
}

export interface MultipleChoiceAnswer {
  type: "multiple_choice";
  options: string[];
  correctIndex: number;
}

export interface NumericAnswer {
  type: "numeric";
  value: number;
  tolerance?: number;
}

/**
 * Drag-the-slider question: the learner moves the graph slider until a
 * condition is met. The submitted answer is the slider's value.
 */
export interface SliderAnswer {
  type: "slider";
  value: number;
  tolerance?: number;
}

/**
 * Tap-the-point question: the learner clicks a location on the curve. The
 * submitted answer is the x-coordinate of the tap.
 */
export interface GraphPointAnswer {
  type: "graph_point";
  x: number;
  tolerance?: number;
}

/**
 * "Derivative builder" question: the learner assembles a single power term
 * a·xⁿ with a coefficient stepper and an exponent stepper, applying the power
 * rule by hand instead of typing or picking the answer. The submitted answer is
 * the `{ coefficient, exponent }` pair. A coefficient of 0 collapses the whole
 * term to 0 (e.g. the derivative of a constant), so the exponent is ignored when
 * grading that case.
 */
export interface PowerTermAnswer {
  type: "power_term";
  coefficient: number;
  exponent: number;
  /** Coefficient shown in the builder before editing — usually the original term's. */
  startCoefficient?: number;
  /** Exponent shown in the builder before editing — usually the original power. */
  startExponent?: number;
}

export type AnswerSpec =
  | MultipleChoiceAnswer
  | NumericAnswer
  | SliderAnswer
  | GraphPointAnswer
  | PowerTermAnswer;

export interface Interaction {
  graph?: GraphConfig;
  answer?: AnswerSpec;
  /** Hints shown after this many wrong attempts (default 2; lesson 1 uses 1) */
  hintAfterAttempts?: number;
}

export interface StepFeedback {
  correct: string;
  incorrect: string;
  hint: string;
}

export interface Step {
  id: string;
  type: StepType;
  conceptTag?: string;
  content: ContentBlock[];
  interaction?: Interaction;
  feedback: StepFeedback;
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  conceptTags: string[];
  published: boolean;
  steps: Step[];
  /**
   * @deprecated Use `practiceBank`. Legacy fixed practice set kept for
   * backward compatibility; the loader falls back to it when no bank exists.
   */
  practice?: Step[];
  /**
   * Pool of practice questions for this lesson. Each practice session draws a
   * random subset so repeated practice stays varied.
   */
  practiceBank?: Step[];
}

/** Outcome of a practice session: how many questions were correct on the first try. */
export interface PracticeResult {
  correct: number;
  total: number;
}

export interface LessonMeta {
  id: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  published: boolean;
}

/**
 * A level groups several lessons into a stage of the course that builds on the
 * previous one (e.g. "What Is a Derivative?" → "Finding Derivatives"). Lessons
 * are referenced by id and rendered in the listed order.
 */
export interface CourseLevel {
  id: string;
  title: string;
  /** One-line summary of what this level builds toward. */
  description: string;
  lessonIds: string[];
}

export interface Course {
  id: "derivatives";
  title: string;
  subject: string;
  description: string;
  /** Ordered learning stages. When omitted, all lessons fall under one level. */
  levels?: CourseLevel[];
  lessons: LessonMeta[];
}

export interface LessonProgress {
  status: LessonStatus;
  currentStepIndex: number;
  stepAttempts: Record<string, number>;
  stepAnswers: Record<string, unknown>;
  completedAt: string | null;
  updatedAt: string;
}

export interface StreakData {
  count: number;
  lastActiveDate: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  streak: StreakData;
  milestones: string[];
  /** Total experience points earned, primarily by completing lessons. */
  xp: number;
  /**
   * Per-day activity tally keyed by ISO date (YYYY-MM-DD); the value counts the
   * questions answered that day. Powers the activity heatmap and longest-streak
   * stat. Absent on profiles created before this field existed.
   */
  activityLog?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

/** How well a learner has demonstrated a concept, coarsest to strongest. */
export type ConceptMasteryTier =
  | "not_started"
  | "learning"
  | "proficient"
  | "mastered";

/** Aggregated mastery of a single concept tag across every lesson that teaches it. */
export interface ConceptMastery {
  /** Concept tag slug, e.g. "power_rule". */
  concept: string;
  /** Human-readable label for display. */
  label: string;
  tier: ConceptMasteryTier;
  /** 0–100 share of the concept's questions answered correctly on the first try. */
  percent: number;
  /** Concept questions answered correctly on the first try. */
  firstTry: number;
  /** Concept questions the learner has cleared (eventually answered correctly). */
  cleared: number;
  /** Total answerable questions tagged with this concept. */
  total: number;
  /** Published lesson ids that teach this concept, in course order. */
  lessonIds: string[];
}

export type FeedbackResult =
  | { correct: true; message: string }
  | { correct: false; message: string; showHint: boolean; hint?: string };

export const MILESTONE_DEFS: Record<
  string,
  { title: string; description: string }
> = {
  first_lesson: {
    title: "First Steps",
    description: "Completed your first calculus lesson",
  },
  three_lessons: {
    title: "On a Roll",
    description: "Completed 3 calculus lessons",
  },
  five_day_streak: {
    title: "Consistent Learner",
    description: "Maintained a 5-day streak",
  },
  course_complete: {
    title: "Calculus Master",
    description: "Completed every lesson in the course",
  },
};

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

/** Number of questions a legacy fixed practice set should contain. */
export const PRACTICE_STEPS = 3;

/** Questions shown in a single lesson practice session (sampled from the bank). */
export const PRACTICE_SESSION_SIZE = 3;

/** Questions shown in a single cross-lesson mixed-review session. */
export const REVIEW_SESSION_SIZE = 5;

/** Minimum number of questions a practice bank should contain. */
export const PRACTICE_BANK_MIN = PRACTICE_SESSION_SIZE;

/** Minimum number of answer choices every multiple-choice question must offer. */
export const MIN_MC_OPTIONS = 4;

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
