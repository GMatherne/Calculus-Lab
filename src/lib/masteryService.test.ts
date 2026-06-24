import {
  getConceptCatalog,
  getConceptMastery,
  getWeakConcepts,
  type ConceptCatalogEntry,
} from "./masteryService";

const catalog = getConceptCatalog();

/** Build progress that marks every teaching lesson of a concept complete, with
 *  a fixed attempt count recorded for each of the concept's questions. */
function progressFor(entry: ConceptCatalogEntry, attempts: number) {
  const progress: Record<
    string,
    { status: string; currentStepIndex: number; stepAttempts: Record<string, number> }
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

  it("marks a concept mastered at 100% when every question is first-try", () => {
    const entry = catalog[0];
    const mastery = getConceptMastery(progressFor(entry, 1));
    const result = mastery.find((m) => m.concept === entry.concept)!;
    expect(result.tier).toBe("mastered");
    expect(result.percent).toBe(100);
    expect(result.firstTry).toBe(result.total);
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
