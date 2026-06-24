import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { validateLesson } from "../src/lib/validateLesson";
import type { Lesson } from "../src/types/content";

const dir = join(process.cwd(), "content");
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "course.json");

let hasErrors = false;
for (const file of files) {
  const lesson = JSON.parse(readFileSync(join(dir, file), "utf-8")) as Lesson;
  const errors = validateLesson(lesson);
  if (errors.length) {
    hasErrors = true;
    console.error(`\n${file}:`);
    errors.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`✓ ${file} (${lesson.steps.length} steps)`);
  }
}

if (hasErrors) process.exit(1);
console.log("\nAll lessons valid.");
