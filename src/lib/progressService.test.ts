import {
  computeStreakUpdate,
  computeLongestStreak,
  recordActivity,
  checkMilestones,
  isLessonComplete,
  nextStepProgress,
} from "./progressService";
import type { MilestoneStats, UserProfile } from "../types/content";

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    displayName: "Test",
    email: "test@example.com",
    streak: { count: 0, lastActiveDate: "" },
    milestones: [],
    xp: 0,
    practiceQuestionsAnswered: 0,
    activityLog: {},
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseStats(overrides: Partial<MilestoneStats> = {}): MilestoneStats {
  return {
    lessonsCompleted: 0,
    totalLessons: 8,
    streak: 0,
    xp: 0,
    practiceQuestionsAnswered: 0,
    conceptsMastered: 0,
    totalConcepts: 6,
    ...overrides,
  };
}

describe("computeStreakUpdate", () => {
  it("does not change the streak for same-day activity", () => {
    const current = { count: 3, lastActiveDate: "2026-03-15" };
    expect(computeStreakUpdate(current, "2026-03-15")).toEqual(current);
  });

  it("increments the streak on a consecutive day", () => {
    const res = computeStreakUpdate(
      { count: 3, lastActiveDate: "2026-03-14" },
      "2026-03-15",
    );
    expect(res.count).toBe(4);
    expect(res.lastActiveDate).toBe("2026-03-15");
  });

  it("resets the streak after a gap", () => {
    const res = computeStreakUpdate(
      { count: 9, lastActiveDate: "2026-03-10" },
      "2026-03-15",
    );
    expect(res.count).toBe(1);
  });

  it("starts a streak from no prior activity", () => {
    const res = computeStreakUpdate({ count: 0, lastActiveDate: "" }, "2026-03-15");
    expect(res.count).toBe(1);
  });
});

describe("recordActivity", () => {
  it("increments the day's tally and advances the streak", () => {
    const res = recordActivity(baseProfile(), 1, "2026-03-15");
    expect(res.activityLog?.["2026-03-15"]).toBe(1);
    expect(res.streak).toEqual({ count: 1, lastActiveDate: "2026-03-15" });
  });

  it("accumulates multiple activities on the same day without re-bumping the streak", () => {
    const once = recordActivity(baseProfile(), 1, "2026-03-15");
    const twice = recordActivity(once, 1, "2026-03-15");
    expect(twice.activityLog?.["2026-03-15"]).toBe(2);
    expect(twice.streak.count).toBe(1);
  });

  it("does not mutate the source profile", () => {
    const profile = baseProfile();
    recordActivity(profile, 1, "2026-03-15");
    expect(profile.activityLog).toEqual({});
  });
});

describe("computeLongestStreak", () => {
  it("is 0 with no activity", () => {
    expect(computeLongestStreak({})).toBe(0);
    expect(computeLongestStreak(undefined)).toBe(0);
  });

  it("finds the longest consecutive run, ignoring gaps and empty days", () => {
    const log = {
      "2026-03-01": 2,
      "2026-03-02": 1,
      "2026-03-03": 3,
      "2026-03-05": 1,
      "2026-03-06": 0,
    };
    expect(computeLongestStreak(log)).toBe(3);
  });
});

describe("checkMilestones", () => {
  it("awards the first-lesson milestone after one completion", () => {
    expect(checkMilestones([], baseStats({ lessonsCompleted: 1 }))).toContain(
      "first_lesson",
    );
  });

  it("awards three-lessons after three completions", () => {
    const res = checkMilestones([], baseStats({ lessonsCompleted: 3 }));
    expect(res).toContain("first_lesson");
    expect(res).toContain("three_lessons");
  });

  it("awards the five-day-streak milestone", () => {
    expect(checkMilestones([], baseStats({ streak: 5 }))).toContain(
      "five_day_streak",
    );
  });

  it("awards course-complete when every lesson is done", () => {
    expect(
      checkMilestones([], baseStats({ lessonsCompleted: 8, totalLessons: 8 })),
    ).toContain("course_complete");
  });

  it("awards XP milestones once their thresholds are reached", () => {
    const res = checkMilestones([], baseStats({ xp: 1000 }));
    expect(res).toContain("xp_250");
    expect(res).toContain("xp_1000");
  });

  it("does not award an XP milestone below its threshold", () => {
    expect(checkMilestones([], baseStats({ xp: 249 }))).not.toContain("xp_250");
  });

  it("awards every practice-question tier once the count is high enough", () => {
    const res = checkMilestones([], baseStats({ practiceQuestionsAnswered: 100 }));
    expect(res).toContain("questions_10");
    expect(res).toContain("questions_25");
    expect(res).toContain("questions_50");
    expect(res).toContain("questions_100");
  });

  it("awards only the practice-question tiers that have been reached", () => {
    const res = checkMilestones([], baseStats({ practiceQuestionsAnswered: 30 }));
    expect(res).toContain("questions_10");
    expect(res).toContain("questions_25");
    expect(res).not.toContain("questions_50");
    expect(res).not.toContain("questions_100");
  });

  it("awards the concepts milestone at the fixed threshold", () => {
    expect(checkMilestones([], baseStats({ conceptsMastered: 3 }))).toContain(
      "concepts_3",
    );
  });

  it("awards all-concepts only when every concept is mastered", () => {
    expect(
      checkMilestones([], baseStats({ conceptsMastered: 5, totalConcepts: 6 })),
    ).not.toContain("all_concepts");
    expect(
      checkMilestones([], baseStats({ conceptsMastered: 6, totalConcepts: 6 })),
    ).toContain("all_concepts");
  });

  it("does not award complete-everything milestones to an empty course", () => {
    const res = checkMilestones(
      [],
      baseStats({ totalLessons: 0, totalConcepts: 0 }),
    );
    expect(res).not.toContain("course_complete");
    expect(res).not.toContain("all_concepts");
  });

  it("does not duplicate already-earned milestones", () => {
    const res = checkMilestones(
      ["first_lesson"],
      baseStats({ lessonsCompleted: 1 }),
    );
    expect(res.filter((m) => m === "first_lesson")).toHaveLength(1);
  });
});

describe("isLessonComplete", () => {
  it("is true only for finished statuses", () => {
    expect(isLessonComplete("complete")).toBe(true);
    expect(isLessonComplete("mastered")).toBe(true);
    expect(isLessonComplete("in_progress")).toBe(false);
    expect(isLessonComplete("not_started")).toBe(false);
    expect(isLessonComplete(undefined)).toBe(false);
  });
});

describe("nextStepProgress", () => {
  it("advances the step pointer on a correct answer while in progress", () => {
    const res = nextStepProgress(
      { status: "in_progress", currentStepIndex: 2 },
      2,
      true,
    );
    expect(res).toEqual({ status: "in_progress", currentStepIndex: 3 });
  });

  it("holds the pointer on a wrong answer while in progress", () => {
    const res = nextStepProgress(
      { status: "in_progress", currentStepIndex: 2 },
      2,
      false,
    );
    expect(res).toEqual({ status: "in_progress", currentStepIndex: 2 });
  });

  it("starts a not-started lesson progressing", () => {
    const res = nextStepProgress(
      { status: "not_started", currentStepIndex: 0 },
      0,
      true,
    );
    expect(res).toEqual({ status: "in_progress", currentStepIndex: 1 });
  });

  // Regression: re-answering a question while reviewing a finished lesson must
  // not downgrade it to in_progress or rewind the saved step pointer.
  it("keeps a completed lesson completed when re-answered during review", () => {
    const res = nextStepProgress(
      { status: "complete", currentStepIndex: 9 },
      0,
      true,
    );
    expect(res).toEqual({ status: "complete", currentStepIndex: 9 });
  });
});
