import { getConceptCatalog, type ConceptCatalogEntry } from "./masteryService";
import {
  getConceptInsight,
  sessionMisses,
  tallyAnswer,
  type SessionTally,
} from "./learnerInsights";
import { getLesson } from "./contentLoader";
import type { LessonProgress } from "../types/content";

const DAY_MS = 24 * 60 * 60 * 1000;
const catalog = getConceptCatalog();

/** Mark every teaching lesson of a concept complete, with a fixed attempt
 *  count per question and a shared `updatedAt` `daysAgo` in the past. */
function progressFor(
  entry: ConceptCatalogEntry,
  attempts: number,
  daysAgo: number,
): Record<string, LessonProgress> {
  const updatedAt = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  const progress: Record<string, LessonProgress> = {};
  for (const lessonId of entry.lessonIds) {
    const stepAttempts: Record<string, number> = {};
    for (const ref of entry.steps) {
      if (ref.lessonId === lessonId) stepAttempts[ref.stepId] = attempts;
    }
    progress[lessonId] = {
      status: "complete",
      currentStepIndex: 0,
      stepAttempts,
      stepAnswers: {},
      completedAt: updatedAt,
      updatedAt,
    };
  }
  return progress;
}

describe("getConceptInsight", () => {
  it("returns null without a concept tag or for an unknown concept", () => {
    expect(getConceptInsight({}, undefined)).toBeNull();
    expect(getConceptInsight({}, "not_a_real_concept")).toBeNull();
  });

  it("derives mastery, recency, and the teaching lesson title", () => {
    const entry = catalog[0];
    const insight = getConceptInsight(progressFor(entry, 1, 10), entry.concept)!;
    expect(insight).not.toBeNull();
    expect(insight.concept).toBe(entry.concept);
    expect(insight.label).toBe(entry.label);
    // A flawless lesson with no practice yet only reaches the halfway mark — the
    // top half of mastery is earned through practice/review.
    expect(insight.tier).toBe("learning");
    expect(insight.percent).toBe(50);
    // Recency comes from `updatedAt`; rounding absorbs the sub-ms now() drift.
    expect(Math.round(insight.daysSinceSeen ?? -1)).toBe(10);
    expect(insight.lessonTitle).toBe(getLesson(entry.lessonIds[0])?.title ?? null);
    expect(insight.lessonTitle).toBeTruthy();
  });

  it("reports a known-but-unseen concept with null recency", () => {
    const entry = catalog[0];
    const insight = getConceptInsight({}, entry.concept)!;
    expect(insight).not.toBeNull();
    expect(insight.tier).toBe("not_started");
    expect(insight.daysSinceSeen).toBeNull();
  });
});

describe("tallyAnswer", () => {
  it("accumulates misses and totals per concept, ignoring untagged answers", () => {
    let s: SessionTally = {};
    s = tallyAnswer(s, "power_rule", "Power Rule", false);
    s = tallyAnswer(s, "power_rule", "Power Rule", true);
    s = tallyAnswer(s, "sum_rule", "Sum Rule", false);
    s = tallyAnswer(s, undefined, "", false);
    expect(s.power_rule).toEqual({ label: "Power Rule", missed: 1, total: 2 });
    expect(s.sum_rule).toEqual({ label: "Sum Rule", missed: 1, total: 1 });
    expect(Object.keys(s)).toHaveLength(2);
  });

  it("treats the tally as immutable", () => {
    const s0: SessionTally = {};
    const s1 = tallyAnswer(s0, "power_rule", "Power Rule", false);
    expect(s0).toEqual({});
    expect(s1).not.toBe(s0);
  });
});

describe("sessionMisses", () => {
  it("lists missed concepts most-missed first, excluding clean ones", () => {
    let s: SessionTally = {};
    s = tallyAnswer(s, "power_rule", "Power Rule", false);
    s = tallyAnswer(s, "power_rule", "Power Rule", false);
    s = tallyAnswer(s, "sum_rule", "Sum Rule", false);
    s = tallyAnswer(s, "ftc", "Fundamental Theorem", true); // never missed
    expect(sessionMisses(s)).toEqual([
      { concept: "power_rule", label: "Power Rule", count: 2 },
      { concept: "sum_rule", label: "Sum Rule", count: 1 },
    ]);
  });

  it("breaks count ties alphabetically by label", () => {
    let s: SessionTally = {};
    s = tallyAnswer(s, "sum_rule", "Sum Rule", false);
    s = tallyAnswer(s, "power_rule", "Power Rule", false);
    expect(sessionMisses(s).map((m) => m.concept)).toEqual([
      "power_rule",
      "sum_rule",
    ]);
  });
});
