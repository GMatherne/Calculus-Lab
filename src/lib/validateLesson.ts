import type { Lesson, Step } from "../types/content";
import {
  MAX_STEPS,
  MIN_STEPS,
  PRACTICE_STEPS,
  PRACTICE_BANK_MIN,
} from "../types/content";

export function validateLesson(lesson: Lesson): string[] {
  const errors: string[] = [];
  const stepCount = lesson.steps.length;

  if (stepCount < MIN_STEPS || stepCount > MAX_STEPS) {
    errors.push(
      `Lesson "${lesson.id}" has ${stepCount} steps; expected ${MIN_STEPS}-${MAX_STEPS}.`,
    );
  }

  const hasSlider = lesson.steps.some((s) => s.type === "slider_graph");
  if (!hasSlider) {
    errors.push(`Lesson "${lesson.id}" must include at least one slider_graph step.`);
  }

  for (const step of lesson.steps) {
    errors.push(...validateStep(step, lesson.id));
  }

  errors.push(...validatePractice(lesson));
  errors.push(...validatePracticeBank(lesson));

  return errors;
}

/**
 * The practice bank is a pool of interactive questions (no "read" steps) that
 * practice sessions sample from. It must hold at least a session's worth so
 * every session can be filled, and every question id must be unique.
 */
function validatePracticeBank(lesson: Lesson): string[] {
  const errors: string[] = [];
  const bank = lesson.practiceBank;
  if (!bank) return errors;

  if (bank.length < PRACTICE_BANK_MIN) {
    errors.push(
      `Lesson "${lesson.id}" practice bank has ${bank.length} questions; expected at least ${PRACTICE_BANK_MIN}.`,
    );
  }

  const ids = new Set<string>();
  for (const step of bank) {
    if (step.type === "read") {
      errors.push(
        `Practice question "${step.id}" in "${lesson.id}" must be interactive, not a read step.`,
      );
    }
    if (ids.has(step.id)) {
      errors.push(`Duplicate practice question id "${step.id}" in "${lesson.id}".`);
    }
    ids.add(step.id);
    errors.push(...validateStep(step, lesson.id));
  }

  return errors;
}

/**
 * Practice is optional, but when present it must be a short set of interactive
 * questions (no "read" steps) so every item can be answered and graded.
 */
function validatePractice(lesson: Lesson): string[] {
  const errors: string[] = [];
  const practice = lesson.practice;
  if (!practice) return errors;

  if (practice.length !== PRACTICE_STEPS) {
    errors.push(
      `Lesson "${lesson.id}" has ${practice.length} practice questions; expected ${PRACTICE_STEPS}.`,
    );
  }

  const ids = new Set<string>();
  for (const step of practice) {
    if (step.type === "read") {
      errors.push(
        `Practice question "${step.id}" in "${lesson.id}" must be interactive, not a read step.`,
      );
    }
    if (ids.has(step.id)) {
      errors.push(`Duplicate practice question id "${step.id}" in "${lesson.id}".`);
    }
    ids.add(step.id);
    errors.push(...validateStep(step, lesson.id));
  }

  return errors;
}

function validateStep(step: Step, lessonId: string): string[] {
  const errors: string[] = [];
  const interactive = step.type !== "read";

  if (interactive && !step.interaction?.answer) {
    errors.push(`Step "${step.id}" in "${lessonId}" is interactive but has no answer spec.`);
  }

  if (step.type === "slider_graph" && !step.interaction?.graph) {
    errors.push(`Step "${step.id}" in "${lessonId}" is slider_graph but has no graph config.`);
  }

  const answerType = step.interaction?.answer?.type;
  if (
    (answerType === "slider" || answerType === "graph_point") &&
    !step.interaction?.graph
  ) {
    errors.push(
      `Step "${step.id}" in "${lessonId}" uses a ${answerType} answer but has no graph config.`,
    );
  }

  if (step.type === "read") {
    return errors;
  }

  if (!step.feedback?.correct || !step.feedback?.incorrect || !step.feedback?.hint) {
    errors.push(`Step "${step.id}" in "${lessonId}" is missing feedback fields.`);
  }

  return errors;
}

export function assertValidLesson(lesson: Lesson): void {
  const errors = validateLesson(lesson);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
