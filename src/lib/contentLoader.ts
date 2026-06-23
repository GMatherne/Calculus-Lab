import type { Course, Lesson, LessonMeta, Step } from "../types/content";
import { PRACTICE_SESSION_SIZE, REVIEW_SESSION_SIZE } from "../types/content";
import { assertValidLesson } from "./validateLesson";

import courseData from "../../content/derivatives/course.json";
import lesson1 from "../../content/derivatives/what-is-a-derivative.json";
import lesson2 from "../../content/derivatives/slope-of-a-curve.json";
import lesson3 from "../../content/derivatives/difference-quotient.json";
import lesson4 from "../../content/derivatives/power-rule.json";
import lesson5 from "../../content/derivatives/graph-shape.json";
import lesson6 from "../../content/derivatives/what-is-an-integral.json";
import lesson7 from "../../content/derivatives/area-under-a-curve.json";
import lesson8 from "../../content/derivatives/fundamental-theorem.json";

const rawLessons: Lesson[] = [
  lesson1 as Lesson,
  lesson2 as Lesson,
  lesson3 as Lesson,
  lesson4 as Lesson,
  lesson5 as Lesson,
  lesson6 as Lesson,
  lesson7 as Lesson,
  lesson8 as Lesson,
];

for (const lesson of rawLessons) {
  assertValidLesson(lesson);
}

const lessonsById = new Map(rawLessons.map((l) => [l.id, l]));

export const course = courseData as Course;

export function getPublishedLessons(): LessonMeta[] {
  return course.lessons.filter((l) => l.published).sort((a, b) => a.order - b.order);
}

export function getLesson(id: string): Lesson | undefined {
  return lessonsById.get(id);
}

export function getAllLessons(): Lesson[] {
  return rawLessons.sort((a, b) => a.order - b.order);
}

/** Live stats for published lessons, used for summary copy that should stay accurate. */
export function getLessonStepStats(): {
  lessonCount: number;
  minSteps: number;
  maxSteps: number;
} {
  const publishedIds = new Set(getPublishedLessons().map((l) => l.id));
  const counts = rawLessons
    .filter((l) => publishedIds.has(l.id) && l.published)
    .map((l) => l.steps.length);
  if (counts.length === 0) {
    return { lessonCount: 0, minSteps: 0, maxSteps: 0 };
  }
  return {
    lessonCount: counts.length,
    minSteps: Math.min(...counts),
    maxSteps: Math.max(...counts),
  };
}

export function getLessonStepCount(lessonId: string): number {
  return lessonsById.get(lessonId)?.steps.length ?? 0;
}

/**
 * The full pool of practice questions for a lesson. Prefers the `practiceBank`
 * and falls back to the legacy `practice` set so older content still works.
 */
export function getPracticeBank(lessonId: string): Step[] {
  const lesson = lessonsById.get(lessonId);
  return lesson?.practiceBank ?? lesson?.practice ?? [];
}

/** Whether a lesson has any practice questions available. */
export function hasPractice(lessonId: string): boolean {
  return getPracticeBank(lessonId).length > 0;
}

/** Fisher–Yates shuffle returning a new array (source is left untouched). */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A randomly chosen subset of a lesson's practice bank — one practice session.
 * Different each call, so repeated practice stays varied.
 */
export function getPracticeSession(
  lessonId: string,
  size: number = PRACTICE_SESSION_SIZE,
): Step[] {
  return shuffle(getPracticeBank(lessonId)).slice(0, size);
}

/** Published lessons the learner has started or finished — eligible for review. */
function reviewableLessons(
  progress: Record<string, { status: string }>,
): LessonMeta[] {
  return getPublishedLessons().filter((l) => {
    const s = progress[l.id]?.status;
    return s === "in_progress" || s === "complete" || s === "mastered";
  });
}

/** Combined pool of practice questions across every lesson eligible for review. */
export function getReviewBank(
  progress: Record<string, { status: string }>,
): Step[] {
  return reviewableLessons(progress).flatMap((l) => getPracticeBank(l.id));
}

/** A random cross-lesson set of questions for a mixed-review session. */
export function getReviewSession(
  progress: Record<string, { status: string }>,
  size: number = REVIEW_SESSION_SIZE,
): Step[] {
  return shuffle(getReviewBank(progress)).slice(0, size);
}

/** Whether the learner has covered enough material to run a mixed review. */
export function canReview(
  progress: Record<string, { status: string }>,
): boolean {
  return getReviewBank(progress).length > 0;
}

/**
 * Fraction of a lesson the learner has worked through, 0–100.
 * Completed lessons return 100; otherwise it's the share of steps cleared
 * (currentStepIndex points at the next unfinished step).
 */
export function getLessonProgressPercent(
  lessonId: string,
  progress: Record<string, { status: string; currentStepIndex?: number }>,
): number {
  const total = getLessonStepCount(lessonId);
  if (total === 0) return 0;
  const p = progress[lessonId];
  if (!p) return 0;
  if (p.status === "complete" || p.status === "mastered") return 100;
  const done = Math.min(p.currentStepIndex ?? 0, total);
  return Math.round((done / total) * 100);
}

export function getNextLessonId(currentId: string): string | null {
  const published = getPublishedLessons();
  const idx = published.findIndex((l) => l.id === currentId);
  if (idx === -1 || idx >= published.length - 1) return null;
  return published[idx + 1].id;
}

export function isLessonUnlocked(
  lessonId: string,
  progress: Record<string, { status: string }>,
): boolean {
  const published = getPublishedLessons();
  const idx = published.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true;
  const prev = published[idx - 1];
  const prevProgress = progress[prev.id];
  return (
    prevProgress?.status === "complete" ||
    prevProgress?.status === "mastered"
  );
}

export function getContinueLessonId(
  progress: Record<string, { status: string; currentStepIndex?: number }>,
): string | null {
  const published = getPublishedLessons();
  for (const meta of published) {
    const p = progress[meta.id];
    if (p?.status === "in_progress") return meta.id;
  }
  for (const meta of published) {
    if (isLessonUnlocked(meta.id, progress)) {
      const p = progress[meta.id];
      if (!p || p.status === "not_started") return meta.id;
    }
  }
  return published[0]?.id ?? null;
}

export function getCompletionPercent(
  progress: Record<string, { status: string }>,
): number {
  const published = getPublishedLessons();
  if (published.length === 0) return 0;
  const done = published.filter((l) => {
    const s = progress[l.id]?.status;
    return s === "complete" || s === "mastered";
  }).length;
  return Math.round((done / published.length) * 100);
}

export type LevelStatus = "locked" | "not_started" | "in_progress" | "complete";

export interface ResolvedLevel {
  id: string;
  title: string;
  description: string;
  /** 1-based position of the level within the course. */
  order: number;
  lessons: LessonMeta[];
}

/**
 * Published lessons grouped into ordered levels. Falls back to a single level
 * holding every published lesson when the course defines none.
 */
export function getLevels(): ResolvedLevel[] {
  const published = getPublishedLessons();
  const byId = new Map(published.map((l) => [l.id, l]));
  const defined = course.levels ?? [];

  if (defined.length === 0) {
    return [
      {
        id: "all",
        title: course.title,
        description: course.description,
        order: 1,
        lessons: published,
      },
    ];
  }

  return defined
    .map((level, i) => ({
      id: level.id,
      title: level.title,
      description: level.description,
      order: i + 1,
      lessons: level.lessonIds
        .map((id) => byId.get(id))
        .filter((m): m is LessonMeta => Boolean(m)),
    }))
    .filter((level) => level.lessons.length > 0);
}

/** Resolve a single level by its id, including its order and lessons. */
export function getLevel(levelId: string): ResolvedLevel | undefined {
  return getLevels().find((l) => l.id === levelId);
}

/**
 * Aggregates the practice questions from every lesson in a level into one set,
 * so a level review can quiz concepts spanning all of its lessons at once.
 */
export function getLevelReviewSteps(levelId: string): Step[] {
  const level = getLevel(levelId);
  if (!level) return [];
  return level.lessons.flatMap((meta) => getPracticeBank(meta.id));
}

/** Whether a level has any review questions authored across its lessons. */
export function hasLevelReview(levelId: string): boolean {
  return getLevelReviewSteps(levelId).length > 0;
}

/** A random cross-lesson set of questions for a single level-review session. */
export function getLevelReviewSession(
  levelId: string,
  size: number = REVIEW_SESSION_SIZE,
): Step[] {
  return shuffle(getLevelReviewSteps(levelId)).slice(0, size);
}

/** Completed-lesson tally and percentage for a level. */
export function getLevelCompletion(
  level: ResolvedLevel,
  progress: Record<string, { status: string }>,
): { done: number; total: number; percent: number } {
  const total = level.lessons.length;
  const done = level.lessons.filter((l) => {
    const s = progress[l.id]?.status;
    return s === "complete" || s === "mastered";
  }).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * A level is locked until its first lesson unlocks (i.e. the prior level is
 * finished), in progress once any lesson is touched, and complete when every
 * lesson is done.
 */
export function getLevelStatus(
  level: ResolvedLevel,
  progress: Record<string, { status: string }>,
): LevelStatus {
  const first = level.lessons[0];
  if (!first || !isLessonUnlocked(first.id, progress)) return "locked";

  const statuses = level.lessons.map(
    (l) => progress[l.id]?.status ?? "not_started",
  );
  const isDone = (s: string) => s === "complete" || s === "mastered";
  if (statuses.every(isDone)) return "complete";
  if (statuses.some((s) => s === "in_progress" || isDone(s)))
    return "in_progress";
  return "not_started";
}
