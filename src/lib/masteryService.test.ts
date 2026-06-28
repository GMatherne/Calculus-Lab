import {
  getConceptCatalog,
  getConceptMastery,
  getWeakConcepts,
  type ConceptCatalogEntry,
} from "./masteryService";

const DAY_MS = 24 * 60 * 60 * 1000;
const catalog = getConceptCatalog();

/** Build progress that marks every teaching lesson of a concept complete, with
 *  a fixed attempt count recorded for each of the concept's questions. */
function progressFor(entry: ConceptCatalogEntry, attempts: number) {
  const progress: Record<
    string,
    {
      status: string;
      currentStepIndex: number;
      stepAttempts: Record<string, number>;
      solvedSteps?: string[];
    }
  > = {};
  for (const lessonId of entry.lessonIds) {
    const stepAttempts: Record<string, number> = {};
    for (const ref of entry.steps) {
      if (ref.lessonId === lessonId) stepAttempts[ref.stepId] = attempts;
    }
    progress[lessonId] = { status: "complete", currentStepIndex: 0, stepAttempts };
  }
  return progress;
}

describe("getConceptCatalog", () => {
  it("derives concepts, each with teaching lessons and answerable steps", () => {
    expect(catalog.length).toBeGreaterThan(1);
    for (const entry of catalog) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.lessonIds.length).toBeGreaterThanOrEqual(1);
      expect(entry.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("includes concepts taught across more than one lesson", () => {
    expect(catalog.some((e) => e.lessonIds.length > 1)).toBe(true);
  });
});

describe("getConceptMastery", () => {
  it("reports every concept as not_started with no progress", () => {
    const mastery = getConceptMastery({});
    expect(mastery.length).toBe(catalog.length);
    expect(mastery.every((m) => m.tier === "not_started")).toBe(true);
    expect(mastery.every((m) => m.percent === 0 && m.cleared === 0)).toBe(true);
  });

  it("caps a flawless but unpracticed lesson around the halfway mark", () => {
    const entry = catalog[0];
    // Every lesson question first-try correct, but no practice/review yet.
    const result = getConceptMastery(progressFor(entry, 1)).find(
      (m) => m.concept === entry.concept,
    )!;
    expect(result.firstTry).toBe(result.total);
    // The lesson can only account for half of mastery, so a clean lesson sits
    // around 50% / learning rather than reading 100% / mastered — the rest is
    // earned through practice.
    expect(result.percent).toBe(50);
    expect(result.tier).toBe("learning");
  });

  it("unlocks mastery for a clean lesson once it's heavily practiced", () => {
    const entry = catalog[0];
    const now = Date.now();
    const result = getConceptMastery(
      progressFor(entry, 1),
      {
        [entry.concept]: {
          seen: 8,
          firstTryCorrect: 8,
          lastReviewed: new Date(now).toISOString(),
        },
      },
      now,
    ).find((m) => m.concept === entry.concept)!;
    // Sustained successful practice fills in the top half, so the flawless
    // lesson now reads as full mastery.
    expect(result.tier).toBe("mastered");
    expect(result.percent).toBe(100);
  });

  it("moves a clean lesson up through proficient as practice accrues", () => {
    const entry = catalog[0];
    const now = Date.now();
    const result = getConceptMastery(
      progressFor(entry, 1),
      {
        [entry.concept]: {
          seen: 4,
          firstTryCorrect: 4,
          lastReviewed: new Date(now).toISOString(),
        },
      },
      now,
    ).find((m) => m.concept === entry.concept)!;
    // Halfway to the practice cap with a clean lesson lands mid-proficient,
    // above the 50% lesson ceiling but short of mastery.
    expect(result.percent).toBeGreaterThan(50);
    expect(result.tier).toBe("proficient");
  });

  it("keeps a fully-covered but low-accuracy concept in learning", () => {
    const entry = catalog[0];
    const mastery = getConceptMastery(progressFor(entry, 2));
    const result = mastery.find((m) => m.concept === entry.concept)!;
    expect(result.cleared).toBe(result.total);
    expect(result.firstTry).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.tier).toBe("learning");
  });

  it("lets enough strong practice carry a struggled lesson to full mastery", () => {
    const entry = catalog[0];
    const now = Date.now();
    // Every lesson question took two tries (0% first-try) — the rocky start.
    const base = getConceptMastery(progressFor(entry, 2), {}, now).find(
      (m) => m.concept === entry.concept,
    )!;
    expect(base.percent).toBe(0);
    expect(base.tier).toBe("learning");

    // Then a solid run of practice, all first-try correct, reaching the cap.
    const withReview = getConceptMastery(
      progressFor(entry, 2),
      {
        [entry.concept]: {
          seen: 8,
          firstTryCorrect: 8,
          lastReviewed: new Date(now).toISOString(),
        },
      },
      now,
    ).find((m) => m.concept === entry.concept)!;
    // Practice fully carries it: the shaky lesson no longer caps mastery.
    expect(withReview.percent).toBe(100);
    expect(withReview.tier).toBe("mastered");
  });

  it("lets a little practice nudge without fully overriding the lesson", () => {
    const entry = catalog[0];
    const now = Date.now();
    const result = getConceptMastery(
      progressFor(entry, 2),
      {
        [entry.concept]: {
          seen: 2,
          firstTryCorrect: 2,
          lastReviewed: new Date(now).toISOString(),
        },
      },
      now,
    ).find((m) => m.concept === entry.concept)!;
    // 2 of 8 cap → review carries a quarter of the weight, lifting 0% to 25%.
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });

  it("lets weak review erode a once-perfect concept", () => {
    const entry = catalog[0];
    const now = Date.now();
    const withReview = getConceptMastery(
      progressFor(entry, 1),
      {
        [entry.concept]: {
          seen: 8,
          firstTryCorrect: 0,
          lastReviewed: new Date(now).toISOString(),
        },
      },
      now,
    ).find((m) => m.concept === entry.concept)!;
    expect(withReview.percent).toBeLessThan(100);
    expect(withReview.tier).not.toBe("mastered");
  });

  it("decays mastery the longer a concept goes untouched", () => {
    const entry = catalog[0];
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    const review = (lastReviewed: string) => ({
      [entry.concept]: { seen: 8, firstTryCorrect: 8, lastReviewed },
    });

    const fresh = getConceptMastery(
      progressFor(entry, 1),
      review(new Date(now).toISOString()),
      now,
    ).find((m) => m.concept === entry.concept)!;
    const stale = getConceptMastery(
      progressFor(entry, 1),
      review(new Date(now - 120 * DAY_MS).toISOString()),
      now,
    ).find((m) => m.concept === entry.concept)!;

    expect(fresh.percent).toBe(100);
    expect(fresh.tier).toBe("mastered");
    // Long disuse drops it well below mastery, but never to zero (it stays
    // "cleared", just in need of review).
    expect(stale.percent).toBeLessThan(fresh.percent);
    expect(stale.percent).toBeGreaterThan(0);
    expect(stale.tier).not.toBe("mastered");
  });

  it("ignores review for a concept the learner hasn't started", () => {
    const entry = catalog[0];
    const iso = new Date().toISOString();
    const result = getConceptMastery(
      {},
      { [entry.concept]: { seen: 6, firstTryCorrect: 6, lastReviewed: iso } },
    ).find((m) => m.concept === entry.concept)!;
    expect(result.tier).toBe("not_started");
    expect(result.percent).toBe(0);
  });

  it("excludes steps cleared via 'solve' from a concept's mastery", () => {
    const entry = catalog[0];
    // First-try on every question gives the concept clear graded progress (~50%,
    // since the lesson alone tops out at the halfway mark) to then drop.
    const base = getConceptMastery(progressFor(entry, 1)).find(
      (m) => m.concept === entry.concept,
    )!;
    expect(base.percent).toBe(50);
    expect(base.tier).toBe("learning");

    // Marking every one of the concept's steps as solved drops them out of
    // mastery entirely (numerator and denominator), so nothing graded remains.
    const progress = progressFor(entry, 1);
    for (const lessonId of entry.lessonIds) {
      progress[lessonId].solvedSteps = entry.steps
        .filter((ref) => ref.lessonId === lessonId)
        .map((ref) => ref.stepId);
    }
    const solved = getConceptMastery(progress).find(
      (m) => m.concept === entry.concept,
    )!;
    expect(solved.total).toBe(0);
    expect(solved.cleared).toBe(0);
    expect(solved.firstTry).toBe(0);
    expect(solved.tier).toBe("not_started");
  });
});

describe("getWeakConcepts", () => {
  it("surfaces started-but-unmastered concepts, weakest first, with a review link", () => {
    const entry = catalog[0];
    const weak = getWeakConcepts(progressFor(entry, 2));
    expect(weak.length).toBeGreaterThanOrEqual(1);
    expect(weak[0].concept).toBe(entry.concept);
    expect(weak[0].reviewHref).toMatch(/^\/lesson\//);
    expect(weak[0].reviewLessonTitle.length).toBeGreaterThan(0);
  });

  it("returns nothing when there is no progress", () => {
    expect(getWeakConcepts({})).toEqual([]);
  });

  it("respects the limit", () => {
    const all = Object.fromEntries(
      catalog.flatMap((e) =>
        e.lessonIds.map((id) => [id, { status: "complete", currentStepIndex: 0, stepAttempts: {} }]),
      ),
    );
    expect(getWeakConcepts(all, 2).length).toBeLessThanOrEqual(2);
  });
});
