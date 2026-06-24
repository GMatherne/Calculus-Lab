import {
  getPublishedLessons,
  getLesson,
  getNextLessonId,
  isLessonUnlocked,
  canAccessLesson,
  getLessonProgressPercent,
  getCompletionPercent,
  getLevels,
  getLevelStatus,
  getPracticeBank,
  getPracticeSession,
  canReview,
  getLessonStepCount,
} from "./contentLoader";
import { PRACTICE_SESSION_SIZE } from "../types/content";

const published = getPublishedLessons();

describe("getPublishedLessons", () => {
  it("returns published lessons sorted by order", () => {
    expect(published.length).toBeGreaterThan(1);
    expect(published.every((l) => l.published)).toBe(true);
    const orders = published.map((l) => l.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("getLesson", () => {
  it("finds an existing lesson and returns undefined otherwise", () => {
    expect(getLesson(published[0].id)?.id).toBe(published[0].id);
    expect(getLesson("does-not-exist")).toBeUndefined();
  });
});

describe("isLessonUnlocked", () => {
  it("unlocks the first lesson with no progress", () => {
    expect(isLessonUnlocked(published[0].id, {})).toBe(true);
  });

  it("locks later lessons until the previous one is complete", () => {
    const second = published[1].id;
    expect(isLessonUnlocked(second, {})).toBe(false);
    expect(
      isLessonUnlocked(second, { [published[0].id]: { status: "complete" } }),
    ).toBe(true);
  });
});

describe("canAccessLesson", () => {
  const first = published[0].id;
  const second = published[1].id;

  it("allows the first lesson and blocks a locked later lesson", () => {
    expect(canAccessLesson(first, {})).toBe(true);
    expect(canAccessLesson(second, {})).toBe(false);
  });

  it("allows a later lesson once the previous one is complete", () => {
    expect(canAccessLesson(second, { [first]: { status: "complete" } })).toBe(
      true,
    );
  });

  it("allows a started or finished lesson even if it would otherwise be locked", () => {
    expect(canAccessLesson(second, { [second]: { status: "in_progress" } })).toBe(
      true,
    );
    expect(canAccessLesson(second, { [second]: { status: "complete" } })).toBe(
      true,
    );
  });
});

describe("getNextLessonId", () => {
  it("returns the next lesson, or null at the end", () => {
    expect(getNextLessonId(published[0].id)).toBe(published[1].id);
    expect(getNextLessonId(published[published.length - 1].id)).toBeNull();
    expect(getNextLessonId("does-not-exist")).toBeNull();
  });
});

describe("getLessonProgressPercent", () => {
  const id = published[0].id;

  it("is 100 for a completed lesson", () => {
    expect(
      getLessonProgressPercent(id, {
        [id]: { status: "complete", currentStepIndex: 0 },
      }),
    ).toBe(100);
  });

  it("is the fraction of steps cleared while in progress", () => {
    const total = getLessonStepCount(id);
    const res = getLessonProgressPercent(id, {
      [id]: { status: "in_progress", currentStepIndex: 1 },
    });
    expect(res).toBe(Math.round((1 / total) * 100));
  });

  it("is 0 with no progress", () => {
    expect(getLessonProgressPercent(id, {})).toBe(0);
  });
});

describe("getCompletionPercent", () => {
  it("is 0 with no progress and 100 when all are complete", () => {
    expect(getCompletionPercent({})).toBe(0);
    const all = Object.fromEntries(
      published.map((l) => [l.id, { status: "complete" }]),
    );
    expect(getCompletionPercent(all)).toBe(100);
  });
});

describe("getLevels", () => {
  const levels = getLevels();

  it("returns ordered, non-empty levels", () => {
    expect(levels.length).toBeGreaterThanOrEqual(1);
    expect(levels.map((l) => l.order)).toEqual(levels.map((_, i) => i + 1));
    expect(levels.every((l) => l.lessons.length > 0)).toBe(true);
  });
});

describe("getLevelStatus", () => {
  const levels = getLevels();

  it("marks the first level not_started and a gated later level locked", () => {
    expect(getLevelStatus(levels[0], {})).toBe("not_started");
    expect(getLevelStatus(levels[1], {})).toBe("locked");
  });

  it("marks a level complete once all its lessons are done", () => {
    const done = Object.fromEntries(
      levels[0].lessons.map((l) => [l.id, { status: "complete" }]),
    );
    expect(getLevelStatus(levels[0], done)).toBe("complete");
  });
});

describe("practice sessions", () => {
  const id = published[0].id;

  it("samples a session drawn entirely from the lesson's practice bank", () => {
    const bank = getPracticeBank(id);
    expect(bank.length).toBeGreaterThanOrEqual(PRACTICE_SESSION_SIZE);

    const session = getPracticeSession(id);
    expect(session.length).toBe(Math.min(PRACTICE_SESSION_SIZE, bank.length));

    const bankIds = new Set(bank.map((s) => s.id));
    expect(session.every((s) => bankIds.has(s.id))).toBe(true);
  });

  it("excludes questions the learner already saw in the lesson", () => {
    // Every published lesson has enough authored practice questions, so none of
    // the lesson's own (already-seen) step questions should leak into practice.
    for (const meta of published) {
      const lesson = getLesson(meta.id)!;
      const lessonStepIds = new Set(
        lesson.steps
          .filter((s) => s.type !== "read" && Boolean(s.interaction?.answer))
          .map((s) => s.id),
      );
      const bank = getPracticeBank(meta.id);
      expect(bank.length).toBeGreaterThanOrEqual(PRACTICE_SESSION_SIZE);
      expect(bank.some((s) => lessonStepIds.has(s.id))).toBe(false);
    }
  });
});

describe("canReview", () => {
  it("is false with no progress and true once a lesson is started", () => {
    expect(canReview({})).toBe(false);
    expect(canReview({ [published[0].id]: { status: "in_progress" } })).toBe(true);
  });
});
