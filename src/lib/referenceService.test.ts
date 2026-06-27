import {
  getReferenceFacts,
  getReferenceGroups,
  getReferenceUnlockedCount,
} from "./referenceService";
import { validateReferenceFacts } from "./validateReference";
import { getLevels, getPublishedLessons } from "./contentLoader";
import type { ReferenceFact } from "../types/content";

const facts = getReferenceFacts();
const publishedIds = getPublishedLessons().map((l) => l.id);
const levels = getLevels();

describe("getReferenceFacts", () => {
  it("loads a non-empty, valid deck", () => {
    expect(facts.length).toBeGreaterThan(1);
    expect(validateReferenceFacts(facts, publishedIds)).toEqual([]);
  });

  it("gives every fact a formula or summary and a real teaching lesson", () => {
    for (const fact of facts) {
      expect(Boolean(fact.formula || fact.summary)).toBe(true);
      expect(publishedIds).toContain(fact.lessonId);
    }
  });

  it("uses unique ids", () => {
    const ids = facts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("validateReferenceFacts", () => {
  it("flags missing fields, duplicate ids, and unknown lessons", () => {
    const bad = [
      { id: "dup", title: "", lessonId: "no-such-lesson" },
      { id: "dup", title: "Has dup id", lessonId: publishedIds[0], summary: "ok" },
    ] as unknown as ReferenceFact[];

    const errors = validateReferenceFacts(bad, publishedIds);
    expect(errors.some((e) => /missing a title/.test(e))).toBe(true);
    expect(errors.some((e) => /formula or a summary/.test(e))).toBe(true);
    expect(errors.some((e) => /unknown lesson/.test(e))).toBe(true);
    expect(errors.some((e) => /Duplicate/.test(e))).toBe(true);
  });

  it("accepts a fact with only a summary (no formula)", () => {
    const ok = [
      { id: "verbal", title: "Verbal fact", lessonId: publishedIds[0], summary: "A statement." },
    ] as unknown as ReferenceFact[];
    expect(validateReferenceFacts(ok, publishedIds)).toEqual([]);
  });
});

describe("getReferenceGroups", () => {
  it("unlocks the first level's facts immediately and locks later ones", () => {
    const groups = getReferenceGroups({});
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.facts).length).toBe(facts.length);

    // The first level is always reachable, so its facts start unlocked.
    const firstGroup = groups.find((g) => g.levelId === levels[0].id)!;
    expect(firstGroup.facts.length).toBeGreaterThan(0);
    expect(firstGroup.facts.every((f) => f.unlocked)).toBe(true);

    // A later level stays locked and surfaces a "finish this first" hint.
    const stillLocked = groups.find((g) => g.facts.some((f) => !f.unlocked));
    expect(stillLocked).toBeDefined();
    const lockedFact = stillLocked!.facts.find((f) => !f.unlocked)!;
    expect(lockedFact.unlockAfter.length).toBeGreaterThan(0);
  });

  it("unlocks a level's facts together once it becomes reachable", () => {
    // The first reference group that starts locked.
    const target = getReferenceGroups({}).find((g) =>
      g.facts.every((f) => !f.unlocked),
    )!;
    expect(target).toBeDefined();

    // Finish every lesson in every level before the target's.
    const progress: Record<string, { status: string }> = {};
    for (const level of levels) {
      if (level.id === target.levelId) break;
      for (const l of level.lessons) progress[l.id] = { status: "complete" };
    }

    const after = getReferenceGroups(progress).find(
      (g) => g.levelId === target.levelId,
    )!;
    expect(after.facts.every((f) => f.unlocked)).toBe(true);
  });

  it("orders groups by level order", () => {
    const orders = getReferenceGroups({}).map((g) => g.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("getReferenceUnlockedCount", () => {
  it("counts facts in reachable levels against the total", () => {
    // With no progress only the first (always-reachable) level's facts count.
    const firstLevelUnlocked = getReferenceGroups({})
      .flatMap((g) => g.facts)
      .filter((f) => f.unlocked).length;
    const none = getReferenceUnlockedCount({});
    expect(none.total).toBe(facts.length);
    expect(none.unlocked).toBe(firstLevelUnlocked);
    expect(none.unlocked).toBeGreaterThan(0);

    // Finishing every lesson reaches every level, unlocking all facts.
    const allDone = Object.fromEntries(
      getPublishedLessons().map((l) => [l.id, { status: "complete" }]),
    );
    expect(getReferenceUnlockedCount(allDone)).toEqual({
      unlocked: facts.length,
      total: facts.length,
    });
  });
});
