/**
 * The lesson-status values that count as "finished".
 *
 * A lesson only ever reaches `"complete"` today; `"mastered"` is recognized for
 * forward compatibility (see OVERVIEW) but never written. This predicate is the
 * single source of truth, kept in its own tiny module so both the progress layer
 * (`progressService`) and the mastery layer (`masteryService`) can share it —
 * neither can import the other without creating a cycle
 * (`progressService → masteryService`).
 */
export function isLessonComplete(status: string | undefined): boolean {
  return status === "complete" || status === "mastered";
}
