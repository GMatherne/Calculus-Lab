import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { validateLesson } from "../src/lib/validateLesson";
import { validateReferenceFacts } from "../src/lib/validateReference";
import type { Lesson, ReferenceFact } from "../src/types/content";

const dir = join(process.cwd(), "content");
const REFERENCE_FILE = "reference.json";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".json") && f !== "course.json" && f !== REFERENCE_FILE,
);

let hasErrors = false;
const lessonIds: string[] = [];
for (const file of files) {
  const lesson = JSON.parse(readFileSync(join(dir, file), "utf-8")) as Lesson;
  lessonIds.push(lesson.id);
  const errors = validateLesson(lesson);
  if (errors.length) {
    hasErrors = true;
    console.error(`\n${file}:`);
    errors.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`✓ ${file} (${lesson.steps.length} steps)`);
  }
}

// Validate the Reference cheat sheet against the lesson ids just loaded, so a
// fact can't point at a lesson that doesn't exist.
const reference = JSON.parse(
  readFileSync(join(dir, REFERENCE_FILE), "utf-8"),
) as { facts: ReferenceFact[] };
const referenceErrors = validateReferenceFacts(reference.facts, lessonIds);
if (referenceErrors.length) {
  hasErrors = true;
  console.error(`\n${REFERENCE_FILE}:`);
  referenceErrors.forEach((e) => console.error(`  - ${e}`));
} else {
  console.log(`✓ ${REFERENCE_FILE} (${reference.facts.length} facts)`);
}

if (hasErrors) process.exit(1);
console.log("\nAll content valid.");
