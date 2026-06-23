export type StepType =
  | "read"
  | "multiple_choice"
  | "numeric"
  | "slider_graph";

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
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  initialSlider?: number;
  xLabel?: string;
  yLabel?: string;
  /** Override the slope readout label (e.g. "Rate of change"). */
  slopeLabel?: string;
  /** Show a live "f(x) = value" readout for the current slider position. Defaults to on. */
  showValue?: boolean;
  /**
   * For tap-the-point questions, snap the tapped x to the nearest multiple of
   * this value (e.g. 0.5) so the learner can't pick arbitrarily precise points.
   */
  pointSnap?: number;
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
  /** Optional instruction shown beneath the graph (e.g. what to drag toward). */
  prompt?: string;
}

/**
 * Tap-the-point question: the learner clicks a location on the curve. The
 * submitted answer is the x-coordinate of the tap.
 */
export interface GraphPointAnswer {
  type: "graph_point";
  x: number;
  tolerance?: number;
  prompt?: string;
}

export type AnswerSpec =
  | MultipleChoiceAnswer
  | NumericAnswer
  | SliderAnswer
  | GraphPointAnswer;

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
  createdAt: string;
  updatedAt: string;
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

/** Number of questions a legacy fixed practice set should contain. */
export const PRACTICE_STEPS = 3;

/** Questions shown in a single lesson practice session (sampled from the bank). */
export const PRACTICE_SESSION_SIZE = 3;

/** Questions shown in a single cross-lesson mixed-review session. */
export const REVIEW_SESSION_SIZE = 5;

/** Minimum number of questions a practice bank should contain. */
export const PRACTICE_BANK_MIN = PRACTICE_SESSION_SIZE;
