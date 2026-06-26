import {
  contentToText,
  describeAnswer,
  describeCorrectAnswer,
  buildStepContext,
  isQuotaError,
} from "./aiTutor";
import type {
  AnswerSpec,
  ContentBlock,
  Step,
  StepFeedback,
} from "../types/content";

const feedback: StepFeedback = {
  correct: "Correct!",
  incorrect: "Not quite.",
  hint: "Think about the power rule.",
};

function stepWith(
  answer: AnswerSpec | undefined,
  content: ContentBlock[] = [],
  conceptTag = "power_rule",
): Step {
  return {
    id: "s1",
    type: answer ? "multiple_choice" : "read",
    conceptTag,
    content,
    interaction: answer ? { answer } : undefined,
    feedback,
  };
}

describe("contentToText", () => {
  it("flattens text and wraps math blocks in inline $…$", () => {
    expect(
      contentToText([
        { type: "text", body: "Differentiate" },
        { type: "math", latex: "x^2" },
      ]),
    ).toBe("Differentiate $x^2$");
  });

  it("collapses whitespace and trims", () => {
    expect(contentToText([{ type: "text", body: "  a   b  " }])).toBe("a b");
  });
});

describe("describeAnswer", () => {
  it("multiple_choice maps an index to its option, guarding bad indices", () => {
    const spec: AnswerSpec = {
      type: "multiple_choice",
      options: ["A", "B", "C", "D"],
      correctIndex: 2,
    };
    expect(describeAnswer(spec, 1)).toBe("B");
    expect(describeAnswer(spec, null)).toBe("(no selection)");
    expect(describeAnswer(spec, 9)).toBe("(no selection)");
  });

  it("multi_choice describes each row with its chosen option", () => {
    const spec: AnswerSpec = {
      type: "multi_choice",
      options: ["Max", "Min", "Neither"],
      parts: [
        { prompt: "$x=0$", correctIndex: 0 },
        { prompt: "$x=2$", correctIndex: 1 },
      ],
    };
    expect(describeAnswer(spec, [2, 1])).toBe("$x=0$ → Neither; $x=2$ → Min");
  });

  it("numeric and slider stringify finite numbers only", () => {
    expect(describeAnswer({ type: "numeric", value: 4 }, 3)).toBe("3");
    expect(describeAnswer({ type: "numeric", value: 4 }, "x")).toBe("(no answer)");
    expect(describeAnswer({ type: "slider", value: 1.5 }, 2.25)).toBe("2.25");
  });

  it("graph_point reports the tapped x", () => {
    expect(describeAnswer({ type: "graph_point", x: 2 }, 2)).toBe("x = 2");
    expect(describeAnswer({ type: "graph_point", x: 2 }, null)).toBe(
      "(no point selected)",
    );
  });

  it("power_term formats the built term and handles edge coefficients/exponents", () => {
    const spec: AnswerSpec = { type: "power_term", coefficient: 3, exponent: 2 };
    expect(describeAnswer(spec, { coefficient: 3, exponent: 3 })).toBe("3x^3");
    expect(describeAnswer(spec, { coefficient: 0, exponent: 5 })).toBe("0");
    expect(describeAnswer(spec, { coefficient: 4, exponent: 1 })).toBe("4x");
    expect(describeAnswer(spec, { coefficient: 4, exponent: 0 })).toBe("4");
    expect(describeAnswer(spec, {})).toBe("(incomplete term)");
  });

  it("drag_drop assembles placed tiles with connectors and a prefix", () => {
    const spec: AnswerSpec = {
      type: "drag_drop",
      prefix: "f'(x) =",
      blanks: [{ accept: "2x" }, { accept: "3", connector: "-" }],
      bank: ["2x", "3", "x^2"],
    };
    expect(describeAnswer(spec, ["2x", "3"])).toBe("f'(x) = 2x - 3");
    expect(describeAnswer(spec, ["2x", null])).toBe("f'(x) = 2x - _");
  });

  it("match pairs each prompt with its placed option", () => {
    const spec: AnswerSpec = {
      type: "match",
      pairs: [
        { prompt: "$x^2$", match: "$\\frac{x^3}{3}$" },
        { prompt: "$x$", match: "$\\frac{x^2}{2}$" },
      ],
    };
    expect(describeAnswer(spec, ["$\\frac{x^3}{3}$", null])).toBe(
      "$x^2$ ↔ $\\frac{x^3}{3}$; $x$ ↔ (unmatched)",
    );
  });

  it("sign_chart labels each region by index", () => {
    const spec: AnswerSpec = {
      type: "sign_chart",
      points: [0],
      options: ["Increasing", "Decreasing"],
      regions: [{ correctIndex: 1 }, { correctIndex: 0 }],
    };
    expect(describeAnswer(spec, [0, 0])).toBe(
      "region 1: Increasing; region 2: Increasing",
    );
  });

  it("order_list joins the chosen order", () => {
    const spec: AnswerSpec = { type: "order_list", items: ["a", "b", "c"] };
    expect(describeAnswer(spec, ["b", "a", "c"])).toBe("b → a → c");
    expect(describeAnswer(spec, [])).toBe("(empty order)");
  });

  it("riemann reports the rectangle count", () => {
    const spec: AnswerSpec = {
      type: "riemann",
      fn: "x^2",
      a: 0,
      b: 2,
      trueArea: 2.667,
      targetWithin: 0.1,
    };
    expect(describeAnswer(spec, 8)).toBe("8 rectangles");
    expect(describeAnswer(spec, 0)).toBe("(no rectangles)");
  });
});

describe("describeCorrectAnswer", () => {
  it("derives the correct answer for every spec variant", () => {
    expect(
      describeCorrectAnswer({
        type: "multiple_choice",
        options: ["A", "B", "C", "D"],
        correctIndex: 2,
      }),
    ).toBe("C");
    expect(
      describeCorrectAnswer({
        type: "multi_choice",
        options: ["Max", "Min", "Neither"],
        parts: [
          { prompt: "$x=0$", correctIndex: 0 },
          { prompt: "$x=2$", correctIndex: 1 },
        ],
      }),
    ).toBe("$x=0$ → Max; $x=2$ → Min");
    expect(describeCorrectAnswer({ type: "numeric", value: 4 })).toBe("4");
    expect(describeCorrectAnswer({ type: "slider", value: 1.5 })).toBe("1.5");
    expect(describeCorrectAnswer({ type: "graph_point", x: 3 })).toBe("x = 3");
    expect(
      describeCorrectAnswer({ type: "power_term", coefficient: 3, exponent: 2 }),
    ).toBe("3x^2");
    expect(
      describeCorrectAnswer({
        type: "drag_drop",
        prefix: "f'(x) =",
        blanks: [{ accept: "2x" }, { accept: "3", connector: "+" }],
        bank: ["2x", "3"],
      }),
    ).toBe("f'(x) = 2x + 3");
    expect(
      describeCorrectAnswer({
        type: "match",
        pairs: [
          { prompt: "$x^2$", match: "$\\frac{x^3}{3}$" },
          { prompt: "$x$", match: "$\\frac{x^2}{2}$" },
        ],
      }),
    ).toBe("$x^2$ ↔ $\\frac{x^3}{3}$; $x$ ↔ $\\frac{x^2}{2}$");
    expect(
      describeCorrectAnswer({
        type: "sign_chart",
        points: [0],
        options: ["Increasing", "Decreasing"],
        regions: [{ correctIndex: 1 }, { correctIndex: 0 }],
      }),
    ).toBe("region 1: Decreasing; region 2: Increasing");
    expect(
      describeCorrectAnswer({ type: "order_list", items: ["a", "b", "c"] }),
    ).toBe("a → b → c");
    expect(
      describeCorrectAnswer({
        type: "riemann",
        fn: "x^2",
        a: 0,
        b: 2,
        trueArea: 2.667,
        targetWithin: 0.1,
      }),
    ).toContain("true area = 2.667");
  });
});

describe("isQuotaError", () => {
  it("flags the Gemini free-tier daily quota 429", () => {
    const err = new Error(
      "Error fetching from .../gemini-2.5-flash:streamGenerateContent: [429 ] " +
        "You exceeded your current quota, please check your plan and billing details. " +
        "Quota exceeded for metric: generativelanguage.googleapis.com/" +
        "generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash",
    );
    expect(isQuotaError(err)).toBe(true);
  });

  it("flags RESOURCE_EXHAUSTED and quota strings without a status code", () => {
    expect(isQuotaError(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isQuotaError("please check your plan and billing details")).toBe(true);
  });

  it("does not flag transient overload or unrelated errors", () => {
    expect(isQuotaError(new Error("[503] The model is overloaded"))).toBe(false);
    expect(isQuotaError(new Error("network timeout"))).toBe(false);
  });
});

describe("buildStepContext", () => {
  it("assembles a grounded, PII-free context from a graded step", () => {
    const step = stepWith(
      { type: "multiple_choice", options: ["A", "B", "C", "D"], correctIndex: 2 },
      [{ type: "text", body: "Pick C" }],
    );
    const ctx = buildStepContext(step, 1, 2, false);
    expect(ctx).toEqual({
      conceptTag: "power_rule",
      answerType: "multiple_choice",
      questionText: "Pick C",
      correctAnswer: "C",
      learnerAnswer: "B",
      attempts: 2,
      isCorrect: false,
      authoredFeedback: feedback,
    });
  });

  it("handles a step with no answer spec", () => {
    const ctx = buildStepContext(stepWith(undefined), undefined, 1, true);
    expect(ctx.answerType).toBe("read");
    expect(ctx.correctAnswer).toBe("(no answer required)");
    expect(ctx.learnerAnswer).toBe("(none)");
  });

  it("falls back to a sane attempt count and default concept", () => {
    const step = stepWith(
      { type: "numeric", value: 4 },
      [{ type: "text", body: "2+2" }],
    );
    step.conceptTag = undefined;
    expect(buildStepContext(step, 4, 0, true).attempts).toBe(1);
    expect(buildStepContext(step, 4, Number.NaN, true).attempts).toBe(1);
    expect(buildStepContext(step, 4, 1, true).conceptTag).toBe("calculus");
  });
});
