import { validateLesson, assertValidLesson } from "./validateLesson";
import type { Lesson, Step, MultiChoicePart, Sandbox } from "../types/content";

const solution = [{ type: "text" as const, body: "Worked solution." }];

function numericStep(id: string): Step {
  return {
    id,
    type: "numeric",
    content: [],
    interaction: { answer: { type: "numeric", value: 1 } },
    solution,
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
    solution,
    feedback: { correct: "c", incorrect: "i", hint: "h" },
  };
}

function dragDropStep(id: string): Step {
  return {
    id,
    type: "drag_drop",
    content: [],
    interaction: {
      answer: {
        type: "drag_drop",
        blanks: [{ accept: "3x^2" }, { accept: "2x" }],
        bank: ["3x^2", "2x", "x^2"],
      },
    },
    solution,
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

  describe("drag_drop", () => {
    it("accepts a valid drag_drop step", () => {
      const lesson = validLesson();
      lesson.steps[1] = dragDropStep("s2");
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("flags a blank whose tile is not in the bank", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...dragDropStep("s2"),
        interaction: {
          answer: {
            type: "drag_drop",
            blanks: [{ accept: "3x^2" }, { accept: "missing" }],
            bank: ["3x^2", "2x", "x^2"],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /not in the bank/)).toBe(true);
    });

    it("flags duplicate bank tiles", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...dragDropStep("s2"),
        interaction: {
          answer: {
            type: "drag_drop",
            blanks: [{ accept: "3x^2" }, { accept: "2x" }],
            bank: ["3x^2", "2x", "2x"],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /duplicate tiles/)).toBe(true);
    });

    it("requires at least one distractor beyond the blanks", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...dragDropStep("s2"),
        interaction: {
          answer: {
            type: "drag_drop",
            blanks: [{ accept: "3x^2" }, { accept: "2x" }],
            bank: ["3x^2", "2x"],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /distractor/)).toBe(true);
    });
  });

  describe("multi_choice", () => {
    function withMultiChoice(parts: MultiChoicePart[], options?: string[]): Lesson {
      const lesson = validLesson();
      lesson.steps[1] = {
        id: "s2",
        type: "multi_choice",
        content: [],
        interaction: { answer: { type: "multi_choice", options, parts } },
        solution,
        feedback: { correct: "c", incorrect: "i", hint: "h" },
      };
      return lesson;
    }

    it("accepts a valid multi_choice step", () => {
      const lesson = withMultiChoice(
        [
          { prompt: "x = 0", correctIndex: 0 },
          { prompt: "x = 2", correctIndex: 1 },
        ],
        ["Maximum", "Minimum", "Neither"],
      );
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("flags fewer than two parts", () => {
      const lesson = withMultiChoice([{ prompt: "x = 0", correctIndex: 0 }], [
        "Maximum",
        "Minimum",
      ]);
      expect(hasError(validateLesson(lesson), /at least two parts/)).toBe(true);
    });

    it("flags a row with too few options", () => {
      const lesson = withMultiChoice(
        [
          { prompt: "x = 0", correctIndex: 0 },
          { prompt: "x = 2", correctIndex: 0 },
        ],
        ["only-one"],
      );
      expect(hasError(validateLesson(lesson), /at least two options/)).toBe(true);
    });

    it("flags a correctIndex outside the row's options", () => {
      const lesson = withMultiChoice(
        [
          { prompt: "x = 0", correctIndex: 0 },
          { prompt: "x = 2", correctIndex: 9 },
        ],
        ["Maximum", "Minimum", "Neither"],
      );
      expect(hasError(validateLesson(lesson), /correctIndex outside/)).toBe(true);
    });

    it("lets a row override the shared options", () => {
      const lesson = withMultiChoice([
        { prompt: "x = 0", correctIndex: 1, options: ["Rising", "Falling"] },
        { prompt: "x = 2", correctIndex: 0, options: ["Rising", "Falling"] },
      ]);
      expect(validateLesson(lesson)).toEqual([]);
    });
  });

  describe("match", () => {
    function matchStep(id: string): Step {
      return {
        id,
        type: "match",
        content: [],
        interaction: {
          answer: {
            type: "match",
            pairs: [
              { prompt: "$x^2$", match: "x^3/3" },
              { prompt: "$x$", match: "x^2/2" },
            ],
            distractors: ["x^3/2"],
          },
        },
        solution,
        feedback: { correct: "c", incorrect: "i", hint: "h" },
      };
    }

    it("accepts a valid match step", () => {
      const lesson = validLesson();
      lesson.steps[1] = matchStep("s2");
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("flags fewer than two pairs", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...matchStep("s2"),
        interaction: {
          answer: { type: "match", pairs: [{ prompt: "$x$", match: "x^2/2" }] },
        },
      };
      expect(hasError(validateLesson(lesson), /at least 2 pairs/)).toBe(true);
    });

    it("flags a pair missing its prompt or match", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...matchStep("s2"),
        interaction: {
          answer: {
            type: "match",
            pairs: [
              { prompt: "$x^2$", match: "x^3/3" },
              { prompt: "", match: "x^2/2" },
            ],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /both a prompt and a match/)).toBe(true);
    });

    it("allows a distractor that mirrors a correct match (plausible duplicate)", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...matchStep("s2"),
        interaction: {
          answer: {
            type: "match",
            pairs: [
              { prompt: "$1+1$", match: "2" },
              { prompt: "$2+2$", match: "4" },
            ],
            distractors: ["2"],
          },
        },
      };
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("allows two prompts that share the same correct answer", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...matchStep("s2"),
        interaction: {
          answer: {
            type: "match",
            pairs: [
              { prompt: "$1+1$", match: "2" },
              { prompt: "$4-2$", match: "2" },
            ],
          },
        },
      };
      expect(validateLesson(lesson)).toEqual([]);
    });
  });

  describe("predict_point", () => {
    function predictStep(id: string): Step {
      return {
        id,
        type: "predict",
        content: [],
        interaction: {
          graph: { fn: "x^2 - 2*x", domain: [-1, 3] },
          answer: {
            type: "predict_point",
            x: 1,
            tolerance: 0.3,
            reveal: { tangent: true },
          },
        },
        solution,
        feedback: { correct: "c", incorrect: "i", hint: "h" },
      };
    }

    it("accepts a valid predict step", () => {
      const lesson = validLesson();
      lesson.steps[1] = predictStep("s2");
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("requires a graph config", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...predictStep("s2"),
        interaction: {
          answer: { type: "predict_point", x: 1, reveal: { tangent: true } },
        },
      };
      expect(
        hasError(validateLesson(lesson), /predict_point answer but has no graph/),
      ).toBe(true);
    });

    it("flags a non-positive tolerance", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...predictStep("s2"),
        interaction: {
          graph: { fn: "x^2", domain: [-1, 3] },
          answer: {
            type: "predict_point",
            x: 1,
            tolerance: 0,
            reveal: { tangent: true },
          },
        },
      };
      expect(hasError(validateLesson(lesson), /tolerance must be positive/)).toBe(
        true,
      );
    });
  });

  describe("select_region", () => {
    function selectRegionStep(id: string): Step {
      return {
        id,
        type: "select_region",
        content: [],
        interaction: {
          answer: {
            type: "select_region",
            fn: "x^2",
            domain: [0, 4],
            bands: [
              { from: 0, to: 1, correct: true },
              { from: 1, to: 2 },
              { from: 2, to: 3 },
            ],
          },
        },
        solution,
        feedback: { correct: "c", incorrect: "i", hint: "h" },
      };
    }

    it("accepts a valid single-select region step", () => {
      const lesson = validLesson();
      lesson.steps[1] = selectRegionStep("s2");
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("flags fewer than two bands", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...selectRegionStep("s2"),
        interaction: {
          answer: {
            type: "select_region",
            fn: "x^2",
            domain: [0, 4],
            bands: [{ from: 0, to: 1, correct: true }],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /at least two bands/)).toBe(true);
    });

    it("requires exactly one correct band for single-select", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...selectRegionStep("s2"),
        interaction: {
          answer: {
            type: "select_region",
            fn: "x^2",
            domain: [0, 4],
            bands: [
              { from: 0, to: 1, correct: true },
              { from: 1, to: 2, correct: true },
              { from: 2, to: 3 },
            ],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /exactly one correct band/)).toBe(true);
    });

    it("flags overlapping bands", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...selectRegionStep("s2"),
        interaction: {
          answer: {
            type: "select_region",
            fn: "x^2",
            domain: [0, 4],
            bands: [
              { from: 0, to: 2, correct: true },
              { from: 1, to: 3 },
            ],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /without overlapping/)).toBe(true);
    });

    it("flags a band outside the domain", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...selectRegionStep("s2"),
        interaction: {
          answer: {
            type: "select_region",
            fn: "x^2",
            domain: [0, 4],
            bands: [
              { from: 0, to: 1, correct: true },
              { from: 1, to: 5 },
            ],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /within the domain/)).toBe(true);
    });

    it("rejects an accompanying graph config (the widget draws its own)", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...selectRegionStep("s2"),
        interaction: {
          graph: { fn: "x^2", domain: [0, 4] },
          answer: {
            type: "select_region",
            fn: "x^2",
            domain: [0, 4],
            bands: [
              { from: 0, to: 1, correct: true },
              { from: 1, to: 2 },
            ],
          },
        },
      };
      expect(hasError(validateLesson(lesson), /must not also define a graph/)).toBe(
        true,
      );
    });

    it("accepts a valid multi-select region step", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        ...selectRegionStep("s2"),
        interaction: {
          answer: {
            type: "select_region",
            fn: "x^3 - 3*x",
            domain: [-2, 2],
            multi: true,
            bands: [
              { from: -2, to: -1, correct: true },
              { from: -1, to: 1 },
              { from: 1, to: 2, correct: true },
            ],
          },
        },
      };
      expect(validateLesson(lesson)).toEqual([]);
    });
  });

  describe("multi-part questions", () => {
    function multiPartStep(id: string): Step {
      return {
        id,
        type: "numeric",
        content: [],
        interaction: { answer: { type: "numeric", value: 6 } },
        solution,
        feedback: { correct: "c", incorrect: "i", hint: "h" },
        parts: [
          {
            id: `${id}-b`,
            content: [],
            interaction: { answer: { type: "numeric", value: 2 } },
            feedback: { correct: "c", incorrect: "i", hint: "h" },
          },
        ],
      };
    }

    it("accepts a valid multi-part step", () => {
      const lesson = validLesson();
      lesson.steps[1] = multiPartStep("s2");
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("flags a follow-up part with no answer spec", () => {
      const lesson = validLesson();
      const step = multiPartStep("s2");
      step.parts![0].interaction = {};
      lesson.steps[1] = step;
      expect(hasError(validateLesson(lesson), /must have an answer spec/)).toBe(true);
    });

    it("flags a follow-up part missing feedback fields", () => {
      const lesson = validLesson();
      const step = multiPartStep("s2");
      step.parts![0].feedback = { correct: "", incorrect: "", hint: "" };
      lesson.steps[1] = step;
      expect(hasError(validateLesson(lesson), /part .* is missing feedback/)).toBe(true);
    });

    it("flags duplicate part ids", () => {
      const lesson = validLesson();
      const step = multiPartStep("s2");
      step.parts!.push({ ...step.parts![0] });
      lesson.steps[1] = step;
      expect(hasError(validateLesson(lesson), /duplicate part id/)).toBe(true);
    });

    it("rejects follow-up parts on a read step", () => {
      const lesson = validLesson();
      lesson.steps[1] = {
        id: "s2",
        type: "read",
        content: [],
        feedback: { correct: "", incorrect: "", hint: "" },
        parts: [
          {
            id: "s2-b",
            content: [],
            interaction: { answer: { type: "numeric", value: 2 } },
            feedback: { correct: "c", incorrect: "i", hint: "h" },
          },
        ],
      };
      expect(hasError(validateLesson(lesson), /cannot have follow-up parts/)).toBe(true);
    });

    it("requires a graph for a slider follow-up part", () => {
      const lesson = validLesson();
      const step = multiPartStep("s2");
      step.parts![0].interaction = { answer: { type: "slider", value: 2 } };
      lesson.steps[1] = step;
      expect(hasError(validateLesson(lesson), /slider answer but has no graph/)).toBe(true);
    });
  });

  describe("concept sandbox", () => {
    function withSandbox(sandbox: Sandbox): Lesson {
      const lesson = validLesson();
      lesson.steps[0] = {
        ...sliderGraphStep("s1"),
        interaction: {
          graph: { fn: "x^2", domain: [0, 4] },
          answer: { type: "slider", value: 2 },
          sandbox,
        },
      };
      return lesson;
    }

    it("accepts a slope_explorer sandbox on a different curve", () => {
      const lesson = withSandbox({
        preset: "slope_explorer",
        fn: "-x^2 + 4*x",
        domain: [-1, 5],
      });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("rejects a sandbox that reuses the graded fn", () => {
      const lesson = withSandbox({ preset: "slope_explorer", fn: "x^2" });
      expect(hasError(validateLesson(lesson), /sandbox fn must differ/)).toBe(true);
    });

    it("requires exactly one of preset or graph", () => {
      const lesson = withSandbox({
        preset: "slope_explorer",
        fn: "x^3",
        graph: { fn: "x^3", domain: [-2, 2], showSlopeValue: true },
      });
      expect(hasError(validateLesson(lesson), /exactly one of preset or graph/)).toBe(
        true,
      );
    });

    it("requires an fn for the slope_explorer preset", () => {
      const lesson = withSandbox({ preset: "slope_explorer" });
      expect(hasError(validateLesson(lesson), /needs an fn/)).toBe(true);
    });

    it("requires a custom sandbox graph to keep its slope readout on", () => {
      const lesson = withSandbox({
        graph: { fn: "x^3", domain: [-2, 2], showSlopeValue: false },
      });
      expect(hasError(validateLesson(lesson), /slope readout on/)).toBe(true);
    });

    it("accepts a power_rule sandbox (it shows the rule in general form)", () => {
      const lesson = withSandbox({ preset: "power_rule" });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("accepts a riemann sandbox on a different curve", () => {
      const lesson = withSandbox({ preset: "riemann", fn: "x", a: 0, b: 4 });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("rejects a riemann sandbox that reuses the graded fn", () => {
      const lesson = withSandbox({ preset: "riemann", fn: "x^2", a: 0, b: 2 });
      expect(hasError(validateLesson(lesson), /sandbox fn must differ/)).toBe(true);
    });

    it("rejects a riemann sandbox with b <= a", () => {
      const lesson = withSandbox({ preset: "riemann", fn: "x", a: 2, b: 1 });
      expect(hasError(validateLesson(lesson), /needs b > a/)).toBe(true);
    });

    it("accepts a shape_explorer sandbox on a different curve", () => {
      const lesson = withSandbox({
        preset: "shape_explorer",
        fn: "x^3 - 3*x",
        domain: [-2.5, 2.5],
      });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("rejects a shape_explorer sandbox that reuses the graded fn", () => {
      const lesson = withSandbox({ preset: "shape_explorer", fn: "x^2" });
      expect(hasError(validateLesson(lesson), /sandbox fn must differ/)).toBe(true);
    });

    it("accepts a reverse_power_rule sandbox (general form, no fields)", () => {
      const lesson = withSandbox({ preset: "reverse_power_rule" });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("accepts an area_explorer sandbox on a different curve", () => {
      const lesson = withSandbox({
        preset: "area_explorer",
        fn: "x + 1",
        a: 0,
        b: 4,
      });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("rejects an area_explorer sandbox that reuses the graded fn", () => {
      const lesson = withSandbox({
        preset: "area_explorer",
        fn: "x^2",
        a: 0,
        b: 2,
      });
      expect(hasError(validateLesson(lesson), /sandbox fn must differ/)).toBe(true);
    });

    it("rejects an area_explorer sandbox missing its interval", () => {
      const lesson = withSandbox({ preset: "area_explorer", fn: "x + 1" });
      expect(hasError(validateLesson(lesson), /needs finite a and b/)).toBe(true);
    });

    it("accepts an ftc_explorer sandbox on a different curve", () => {
      const lesson = withSandbox({
        preset: "ftc_explorer",
        fn: "x - 1",
        a: 1,
        b: 3,
        domain: [-1, 4],
      });
      expect(validateLesson(lesson)).toEqual([]);
    });

    it("rejects an ftc_explorer sandbox with b <= a", () => {
      const lesson = withSandbox({
        preset: "ftc_explorer",
        fn: "x - 1",
        a: 3,
        b: 1,
      });
      expect(hasError(validateLesson(lesson), /needs b > a/)).toBe(true);
    });
  });

  describe("worked solution (solve assistance)", () => {
    it("flags a graded lesson step missing a worked solution", () => {
      const lesson = validLesson();
      const step = numericStep("s2");
      delete step.solution;
      lesson.steps[1] = step;
      expect(hasError(validateLesson(lesson), /missing a worked solution/)).toBe(true);
    });

    it("does not require a worked solution on practice questions", () => {
      const lesson = validLesson();
      const practice = (id: string): Step => {
        const s = numericStep(id);
        delete s.solution;
        return s;
      };
      lesson.practiceBank = [practice("p1"), practice("p2"), practice("p3")];
      expect(hasError(validateLesson(lesson), /missing a worked solution/)).toBe(false);
    });
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
