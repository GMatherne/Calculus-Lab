import { validateLesson, assertValidLesson } from "./validateLesson";
import type { Lesson, Step } from "../types/content";

function numericStep(id: string): Step {
  return {
    id,
    type: "numeric",
    content: [],
    interaction: { answer: { type: "numeric", value: 1 } },
    feedback: { correct: "c", incorrect: "i", hint: "h" },
  };
}

function sliderGraphStep(id: string): Step {
  return {
    id,
    type: "slider_graph",
    content: [],
    interaction: {
      graph: { fn: "x^2", domain: [0, 4] },
      answer: { type: "slider", value: 2 },
    },
    feedback: { correct: "c", incorrect: "i", hint: "h" },
  };
}

function validLesson(): Lesson {
  return {
    id: "test-lesson",
    title: "Test",
    order: 1,
    estimatedMinutes: 5,
    conceptTags: [],
    published: true,
    steps: [
      sliderGraphStep("s1"),
      numericStep("s2"),
      numericStep("s3"),
      numericStep("s4"),
      numericStep("s5"),
      numericStep("s6"),
    ],
  };
}

const hasError = (errors: string[], re: RegExp) => errors.some((e) => re.test(e));

describe("validateLesson", () => {
  it("returns no errors for a well-formed lesson", () => {
    expect(validateLesson(validLesson())).toEqual([]);
  });

  it("flags lessons with too few steps", () => {
    const lesson = validLesson();
    lesson.steps = lesson.steps.slice(0, 3);
    expect(hasError(validateLesson(lesson), /steps; expected/)).toBe(true);
  });

  it("requires at least one slider_graph step", () => {
    const lesson = validLesson();
    lesson.steps[0] = numericStep("s1");
    expect(hasError(validateLesson(lesson), /slider_graph/)).toBe(true);
  });

  it("flags an interactive step with no answer spec", () => {
    const lesson = validLesson();
    lesson.steps[1] = { ...numericStep("s2"), interaction: {} };
    expect(hasError(validateLesson(lesson), /no answer spec/)).toBe(true);
  });

  it("requires at least four multiple-choice options", () => {
    const lesson = validLesson();
    lesson.steps[1] = {
      id: "s2",
      type: "multiple_choice",
      content: [],
      interaction: {
        answer: { type: "multiple_choice", options: ["a", "b", "c"], correctIndex: 0 },
      },
      feedback: { correct: "c", incorrect: "i", hint: "h" },
    };
    expect(hasError(validateLesson(lesson), /multiple-choice options/)).toBe(true);
  });

  it("requires a graph config for slider answers", () => {
    const lesson = validLesson();
    lesson.steps[1] = {
      id: "s2",
      type: "numeric",
      content: [],
      interaction: { answer: { type: "slider", value: 1 } },
      feedback: { correct: "c", incorrect: "i", hint: "h" },
    };
    expect(hasError(validateLesson(lesson), /slider answer but has no graph/)).toBe(true);
  });

  it("flags missing feedback fields", () => {
    const lesson = validLesson();
    lesson.steps[1] = {
      ...numericStep("s2"),
      feedback: { correct: "", incorrect: "", hint: "" },
    };
    expect(hasError(validateLesson(lesson), /missing feedback/)).toBe(true);
  });

  describe("practiceBank", () => {
    it("requires a minimum number of questions", () => {
      const lesson = validLesson();
      lesson.practiceBank = [numericStep("p1"), numericStep("p2")];
      expect(hasError(validateLesson(lesson), /practice bank has/)).toBe(true);
    });

    it("rejects read steps in the bank", () => {
      const lesson = validLesson();
      lesson.practiceBank = [
        numericStep("p1"),
        numericStep("p2"),
        { id: "p3", type: "read", content: [], feedback: { correct: "", incorrect: "", hint: "" } },
      ];
      expect(hasError(validateLesson(lesson), /must be interactive/)).toBe(true);
    });

    it("rejects duplicate question ids", () => {
      const lesson = validLesson();
      lesson.practiceBank = [numericStep("dup"), numericStep("dup"), numericStep("p3")];
      expect(hasError(validateLesson(lesson), /Duplicate practice question id/)).toBe(true);
    });

    it("accepts a valid bank", () => {
      const lesson = validLesson();
      lesson.practiceBank = [numericStep("p1"), numericStep("p2"), numericStep("p3")];
      expect(validateLesson(lesson)).toEqual([]);
    });
  });
});

describe("assertValidLesson", () => {
  it("does not throw for a valid lesson", () => {
    expect(() => assertValidLesson(validLesson())).not.toThrow();
  });

  it("throws for an invalid lesson", () => {
    const lesson = validLesson();
    lesson.steps = [];
    expect(() => assertValidLesson(lesson)).toThrow();
  });
});
