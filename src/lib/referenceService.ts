import type { ReferenceFact } from "../types/content";
import {
  getLevels,
  getLevelStatus,
  getPublishedLessons,
  type ResolvedLevel,
} from "./contentLoader";
import { assertValidReferenceFacts } from "./validateReference";

import referenceData from "../../content/reference.json";

/**
 * Minimal shape of saved progress this module needs to gate unlocks. Matches
 * what {@link getLevelStatus} reads, so the object the app already holds can be
 * passed straight through.
 */
type ProgressInput = Record<string, { status: string }>;

let cached: ReferenceFact[] | null = null;

/**
 * The authored Reference facts, validated against the published course and
 * cached. Throws at first access if the deck is malformed (an authoring bug),
 * matching how lessons are asserted at import time in the content loader.
 */
export function getReferenceFacts(): ReferenceFact[] {
  if (cached) return cached;
  const facts = (referenceData as { facts: ReferenceFact[] }).facts;
  assertValidReferenceFacts(
    facts,
    getPublishedLessons().map((l) => l.id),
  );
  cached = facts;
  return facts;
}

/** A fact paired with whether the learner has unlocked it. */
export interface ReferenceFactStatus {
  fact: ReferenceFact;
  /** True once the fact's level is unlocked (the previous level is finished). */
  unlocked: boolean;
  /**
   * When locked, the title of the level that must be finished first (the
   * preceding level), for the card's "Complete X to unlock" hint. Empty once
   * unlocked and for the always-available first level.
   */
  unlockAfter: string;
}

/** Reference facts for one course level, in authored order. */
export interface ReferenceGroup {
  levelId: string;
  levelTitle: string;
  /** 1-based level position within the course. */
  order: number;
  facts: ReferenceFactStatus[];
}

/**
 * Facts grouped by the level that teaches them, in level order, each annotated
 * with whether it's unlocked yet. Levels with no facts are omitted, and facts
 * keep their authored order within a level.
 */
export function getReferenceGroups(progress: ProgressInput): ReferenceGroup[] {
  const facts = getReferenceFacts();
  const levels = getLevels();

  const levelByLesson = new Map<string, ResolvedLevel>();
  for (const level of levels) {
    for (const meta of level.lessons) levelByLesson.set(meta.id, level);
  }

  // A level's facts unlock together the moment the level is reachable (i.e. the
  // previous level is finished). The preceding level's title is the "finish this
  // first" hint shown on a still-locked card.
  const unlockedByLevel = new Map<string, boolean>();
  const unlockAfterByLevel = new Map<string, string>();
  levels.forEach((level, i) => {
    unlockedByLevel.set(level.id, getLevelStatus(level, progress) !== "locked");
    const prev = i > 0 ? levels[i - 1] : undefined;
    unlockAfterByLevel.set(level.id, prev?.title ?? "");
  });

  const groups: ReferenceGroup[] = levels.map((level) => ({
    levelId: level.id,
    levelTitle: level.title,
    order: level.order,
    facts: [],
  }));
  const groupById = new Map(groups.map((g) => [g.levelId, g]));

  for (const fact of facts) {
    const level = levelByLesson.get(fact.lessonId);
    if (!level) continue; // unreachable for valid data; guards against bad ids
    const unlocked = unlockedByLevel.get(level.id) ?? false;
    groupById.get(level.id)!.facts.push({
      fact,
      unlocked,
      unlockAfter: unlocked ? "" : unlockAfterByLevel.get(level.id) ?? "",
    });
  }

  return groups.filter((g) => g.facts.length > 0);
}

/** How many facts are unlocked out of the whole deck, for summary badges. */
export function getReferenceUnlockedCount(progress: ProgressInput): {
  unlocked: number;
  total: number;
} {
  const facts = getReferenceFacts();
  const levels = getLevels();

  const unlockedByLevel = new Map<string, boolean>();
  const levelByLesson = new Map<string, string>();
  for (const level of levels) {
    unlockedByLevel.set(level.id, getLevelStatus(level, progress) !== "locked");
    for (const meta of level.lessons) levelByLesson.set(meta.id, level.id);
  }

  const unlocked = facts.filter((f) => {
    const levelId = levelByLesson.get(f.lessonId);
    return levelId ? unlockedByLevel.get(levelId) === true : false;
  }).length;
  return { unlocked, total: facts.length };
}
