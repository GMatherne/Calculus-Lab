import {
  getReviewPriorities,
  getReviewTargets,
  getTargetedReviewSession,
} from "./reviewPlanner";
import { getConceptCatalog, type ConceptCatalogEntry } from "./masteryService";
import { getPublishedLessons, getPracticeBank } from "./contentLoader";
import { REVIEW_SESSION_SIZE } from "../types/content";

const DAY_MS = 24 * 60 * 60 * 1000;
const catalog = getConceptCatalog();
const published = getPublishedLessons();

type TestProgress = Record<
  string,
  {
    status: string;
    currentStepIndex: number;
    stepAttempts: Record<string, number>;
    updatedAt: string;
  }
>;

/**
 * Build progress that completes each concept's teaching lessons, recording a
 * fixed attempt count for that concept's questions (1 = mastered, 2 = shaky)
 * and an `updatedAt` `daysAgo` in the past (for the recency signal).
 */
function buildProgress(
  specs: { entry: ConceptCatalogEntry; attempts: number; daysAgo?: number }[],
): TestProgress {
  const progress: TestProgress = {};
  const now = Date.now();
  for (const { entry, attempts, daysAgo = 0 } of specs) {
    const iso = new Date(now - daysAgo * DAY_MS).toISOString();
    for (const lessonId of entry.lessonIds) {
      const existing = progress[lessonId];
      const stepAttempts = { ...(existing?.stepAttempts ?? {}) };
      for (const ref of entry.steps) {
        if (ref.lessonId === lessonId) stepAttempts[ref.stepId] = attempts;
      }
      const updatedAt =
        existing && Date.parse(existing.updatedAt) > Date.parse(iso)
          ? existing.updatedAt
          : iso;
      progress[lessonId] = {
        status: "complete",
        currentStepIndex: 0,
        stepAttempts,
        updatedAt,
      };
    }
  }
  return progress;
}

/** Mark every published lesson complete, last touched `daysAgo` in the past. */
function allCompleteProgress(daysAgo = 0): TestProgress {
  const iso = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  const progress: TestProgress = {};
  for (const meta of published) {
    progress[meta.id] = {
      status: "complete",
      currentStepIndex: 0,
      stepAttempts: {},
      updatedAt: iso,
    };
  }
  return progress;
}

/** Two concepts taught in entirely separate lessons, so each can be scored in
 *  isolation without the other's lessons leaking in. */
function disjointPair(): [ConceptCatalogEntry, ConceptCatalogEntry] {
  for (let i = 0; i < catalog.length; i++) {
    for (let j = i + 1; j < catalog.length; j++) {
      const overlap = catalog[i].lessonIds.some((id) =>
        catalog[j].lessonIds.includes(id),
      );
      if (!overlap) return [catalog[i], catalog[j]];
    }
  }
  throw new Error("expected at least one disjoint concept pair in the catalog");
}

describe("getReviewPriorities", () => {
  it("returns nothing without progress", () => {
    expect(getReviewPriorities({})).toEqual([]);
  });

  it("only includes concepts the learner has actually cleared", () => {
    const [seen, unseen] = disjointPair();
    const priorities = getReviewPriorities(buildProgress([{ entry: seen, attempts: 2 }]));
    expect(priorities.some((p) => p.concept === seen.concept)).toBe(true);
    expect(priorities.some((p) => p.concept === unseen.concept)).toBe(false);
    expect(priorities.every((p) => p.mastery.cleared > 0)).toBe(true);
  });

  it("ranks a weaker concept above a stronger one (weakness dominates)", () => {
    const [weak, strong] = disjointPair();
    const priorities = getReviewPriorities(
      buildProgress([
        { entry: weak, attempts: 2, daysAgo: 0 },
        { entry: strong, attempts: 1, daysAgo: 0 },
      ]),
    );
    const w = priorities.find((p) => p.concept === weak.concept)!;
    const s = priorities.find((p) => p.concept === strong.concept)!;
    expect(w.weakness).toBeGreaterThan(s.weakness);
    expect(w.priority).toBeGreaterThan(s.priority);
  });

  it("breaks ties by recency — a staler concept ranks higher", () => {
    const [stale, recent] = disjointPair();
    const priorities = getReviewPriorities(
      buildProgress([
        { entry: stale, attempts: 2, daysAgo: 30 },
        { entry: recent, attempts: 2, daysAgo: 0 },
      ]),
    );
    const a = priorities.find((p) => p.concept === stale.concept)!;
    const b = priorities.find((p) => p.concept === recent.concept)!;
    expect(a.recency).toBeGreaterThan(b.recency);
    expect(a.priority).toBeGreaterThan(b.priority);
  });
});

describe("getReviewTargets", () => {
  it("is empty without progress", () => {
    expect(getReviewTargets({})).toEqual([]);
  });

  it("names seen concepts that have review questions, capped at the limit", () => {
    const targets = getReviewTargets(allCompleteProgress(), 2);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.length).toBeLessThanOrEqual(2);
    expect(targets.every((label) => label.length > 0)).toBe(true);
  });
});

describe("getTargetedReviewSession", () => {
  it("is empty when there is nothing to review", () => {
    expect(getTargetedReviewSession({})).toEqual([]);
  });

  it("fills up to the review size with no repeats", () => {
    const session = getTargetedReviewSession(allCompleteProgress());
    expect(session.length).toBe(REVIEW_SESSION_SIZE);
    const ids = session.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws only from a single reviewable lesson's bank", () => {
    const id = published[0].id;
    const session = getTargetedReviewSession({
      [id]: {
        status: "complete",
        currentStepIndex: 0,
        stepAttempts: {},
        updatedAt: new Date().toISOString(),
      },
    });
    const bankIds = new Set(getPracticeBank(id).map((s) => s.id));
    expect(session.length).toBeGreaterThan(0);
    expect(session.every((s) => bankIds.has(s.id))).toBe(true);
  });

  it("falls back to the wider pool when no concept has been cleared yet", () => {
    const id = published[0].id;
    // Started but nothing cleared: reviewable, but no concept is "seen", so the
    // targeted pass is empty and the session must come from the backfill.
    const progress: TestProgress = {
      [id]: {
        status: "in_progress",
        currentStepIndex: 0,
        stepAttempts: {},
        updatedAt: new Date().toISOString(),
      },
    };
    expect(getReviewPriorities(progress)).toEqual([]);
    const session = getTargetedReviewSession(progress);
    const bankIds = new Set(getPracticeBank(id).map((s) => s.id));
    expect(session.length).toBeGreaterThan(0);
    expect(session.every((s) => bankIds.has(s.id))).toBe(true);
  });
});
