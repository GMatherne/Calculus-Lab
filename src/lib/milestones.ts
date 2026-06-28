import type { IconName } from "../types/icons";

/**
 * Everything about achievement milestones: their definitions, display grouping,
 * and the pure progress computation. Moved out of `types/content.ts` so the
 * milestone catalog (data) and `milestoneProgress` (logic) live together, away
 * from the type vocabulary. The award logic (`progressService`) and the
 * achievements UI both read from here, so they can't disagree.
 */

/** Which learner statistic a milestone tracks, used to compute progress. */
type MilestoneMetric =
  | "lessons"
  | "streak"
  | "course"
  | "xp"
  | "questions"
  | "concepts"
  | "allConcepts";

export interface MilestoneDef {
  title: string;
  description: string;
  /** Registered icon ({@link IconName}) shown on the achievement badge. */
  icon: IconName;
  metric: MilestoneMetric;
  /**
   * Threshold required to earn the milestone. For the "course" metric the live
   * target is the published lesson count; `goal` is only a sensible fallback.
   */
  goal: number;
}

export const MILESTONE_DEFS: Record<string, MilestoneDef> = {
  first_lesson: {
    title: "First Steps",
    description: "Complete your first calculus lesson",
    icon: "sprout",
    metric: "lessons",
    goal: 1,
  },
  three_lessons: {
    title: "On a Roll",
    description: "Complete 3 calculus lessons",
    icon: "flame",
    metric: "lessons",
    goal: 3,
  },
  five_day_streak: {
    title: "Consistent Learner",
    description: "Maintain a 5-day learning streak",
    icon: "calendarCheck",
    metric: "streak",
    goal: 5,
  },
  course_complete: {
    title: "Calculus Master",
    description: "Complete every lesson in the course",
    icon: "graduationCap",
    metric: "course",
    goal: 1,
  },
  questions_10: {
    title: "Warming Up",
    description: "Answer 10 practice questions right on the first try",
    icon: "dumbbell",
    metric: "questions",
    goal: 10,
  },
  questions_25: {
    title: "Getting Reps In",
    description: "Answer 25 practice questions right on the first try",
    icon: "penLine",
    metric: "questions",
    goal: 25,
  },
  questions_50: {
    title: "Practice Pro",
    description: "Answer 50 practice questions right on the first try",
    icon: "library",
    metric: "questions",
    goal: 50,
  },
  questions_100: {
    title: "Century",
    description: "Answer 100 practice questions right on the first try",
    icon: "target",
    metric: "questions",
    goal: 100,
  },
  concepts_3: {
    title: "Concept Explorer",
    description: "Master 3 concepts",
    icon: "brain",
    metric: "concepts",
    goal: 3,
  },
  all_concepts: {
    title: "Concept Conqueror",
    description: "Master every concept in the course",
    icon: "crown",
    metric: "allConcepts",
    goal: 1,
  },
  xp_250: {
    title: "Point Collector",
    description: "Earn 250 XP",
    icon: "gem",
    metric: "xp",
    goal: 250,
  },
  xp_1000: {
    title: "XP Champion",
    description: "Earn 1,000 XP",
    icon: "trophy",
    metric: "xp",
    goal: 1000,
  },
};

/** A labeled group of related achievements, shown as one section in the UI. */
export interface MilestoneSection {
  id: string;
  label: string;
  /** Milestone ids belonging to this section, in display order. */
  milestoneIds: string[];
}

/**
 * Achievements grouped by theme for display. {@link MILESTONE_ORDER} is derived
 * from this, so every id in {@link MILESTONE_DEFS} must appear in exactly one
 * section.
 */
export const MILESTONE_SECTIONS: MilestoneSection[] = [
  {
    id: "lessons",
    label: "Lessons",
    milestoneIds: ["first_lesson", "three_lessons", "course_complete"],
  },
  {
    id: "practice",
    label: "Practice",
    milestoneIds: [
      "questions_10",
      "questions_25",
      "questions_50",
      "questions_100",
    ],
  },
  {
    id: "mastery",
    label: "Concept mastery",
    milestoneIds: ["concepts_3", "all_concepts"],
  },
  {
    id: "streak",
    label: "Streaks",
    milestoneIds: ["five_day_streak"],
  },
  {
    id: "xp",
    label: "Experience",
    milestoneIds: ["xp_250", "xp_1000"],
  },
];

/** Milestone ids in display order, flattened from {@link MILESTONE_SECTIONS}. */
export const MILESTONE_ORDER: string[] = MILESTONE_SECTIONS.flatMap(
  (section) => section.milestoneIds,
);

/** Learner stats needed to evaluate progress toward any milestone. */
export interface MilestoneStats {
  lessonsCompleted: number;
  totalLessons: number;
  streak: number;
  /** Total experience points earned across lessons and practice. */
  xp: number;
  /** Practice/review questions cleared on the first try (lesson questions excluded). */
  practiceQuestionsAnswered: number;
  /** Concepts the learner has fully mastered. */
  conceptsMastered: number;
  /** Total concepts taught by the published course. */
  totalConcepts: number;
}

/**
 * Current progress toward a milestone: `current` is how far the learner has
 * come and `target` is what they must reach to earn it. A milestone is earned
 * once `current >= target`, which keeps the award rules and the achievements UI
 * reading from one source of truth.
 */
export function milestoneProgress(
  def: MilestoneDef,
  stats: MilestoneStats,
): { current: number; target: number } {
  switch (def.metric) {
    case "lessons":
      return { current: stats.lessonsCompleted, target: def.goal };
    case "streak":
      return { current: stats.streak, target: def.goal };
    case "course":
      return { current: stats.lessonsCompleted, target: stats.totalLessons };
    case "xp":
      return { current: stats.xp, target: def.goal };
    case "questions":
      return { current: stats.practiceQuestionsAnswered, target: def.goal };
    case "concepts":
      return { current: stats.conceptsMastered, target: def.goal };
    case "allConcepts":
      return { current: stats.conceptsMastered, target: stats.totalConcepts };
  }
}
