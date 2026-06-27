import type { ReferenceFact } from "../types/content";

/**
 * Validate the hand-authored Reference cheat sheet. Kept as a pure,
 * dependency-light module (only types) — mirroring {@link ./validateLesson} —
 * so the `validate:lessons` CLI can call it without pulling in the content
 * loader or any browser/Firebase code.
 *
 * `validLessonIds` is the set of lesson ids a fact may point at (the published
 * lessons in the app; every loaded lesson file in the CLI). Each fact must have
 * a unique id, a title, at least one of `formula`/`summary`, and a `lessonId`
 * that resolves to a real lesson.
 */
export function validateReferenceFacts(
  facts: ReferenceFact[],
  validLessonIds: string[],
): string[] {
  const errors: string[] = [];

  if (!Array.isArray(facts)) {
    return ['reference.json must contain a "facts" array.'];
  }

  const valid = new Set(validLessonIds);
  const ids = new Set<string>();

  facts.forEach((fact, i) => {
    const where = fact?.id ? `"${fact.id}"` : `#${i + 1}`;

    if (!fact?.id) {
      errors.push(`Reference fact ${where} is missing an id.`);
    } else if (ids.has(fact.id)) {
      errors.push(`Duplicate reference fact id "${fact.id}".`);
    } else {
      ids.add(fact.id);
    }

    if (!fact?.title?.trim()) {
      errors.push(`Reference fact ${where} is missing a title.`);
    }

    if (!fact?.formula?.trim() && !fact?.summary?.trim()) {
      errors.push(`Reference fact ${where} needs a formula or a summary.`);
    }

    if (!fact?.lessonId) {
      errors.push(`Reference fact ${where} is missing a lessonId.`);
    } else if (!valid.has(fact.lessonId)) {
      errors.push(
        `Reference fact ${where} references unknown lesson "${fact.lessonId}".`,
      );
    }
  });

  return errors;
}

export function assertValidReferenceFacts(
  facts: ReferenceFact[],
  validLessonIds: string[],
): void {
  const errors = validateReferenceFacts(facts, validLessonIds);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
