import { correctAnswerValue, solutionBlocks } from "./solutionService";
import { checkAnswer } from "./feedbackEngine";
import type { Step } from "../types/content";

function makeStep(interaction?: Step["interaction"]): Step {
  return {
    id: "t",
    type: "numeric",
    content: [],
    interaction,
    feedback: { correct: "c", incorrect: "i", hint: "h" },
  };
}

const cases: { name: string; interaction: Step["interaction"] }[] = [
  {
    name: "multiple_choice",
    interaction: {
      answer: { type: "multiple_choice", options: ["a", "b", "c", "d"], correctIndex: 2 },
    },
  },
  {
    name: "multi_choice",
    interaction: {
      answer: {
        type: "multi_choice",
        options: ["X", "Y"],
        parts: [
          { prompt: "a", correctIndex: 0 },
          { prompt: "b", correctIndex: 1 },
        ],
      },
    },
  },
  { name: "numeric", interaction: { answer: { type: "numeric", value: 7 } } },
  { name: "slider", interaction: { answer: { type: "slider", value: 2 } } },
  { name: "graph_point", interaction: { answer: { type: "graph_point", x: 3 } } },
  {
    name: "predict_point",
    interaction: { answer: { type: "predict_point", x: 1, reveal: { point: true } } },
  },
  {
    name: "power_term",
    interaction: { answer: { type: "power_term", coefficient: 6, exponent: 1 } },
  },
  {
    name: "drag_drop",
    interaction: {
      answer: {
        type: "drag_drop",
        blanks: [{ accept: "a" }, { accept: "b" }],
        bank: ["a", "b", "c"],
      },
    },
  },
  {
    name: "match",
    interaction: {
      answer: {
        type: "match",
        pairs: [
          { prompt: "p", match: "m1" },
          { prompt: "q", match: "m2" },
        ],
      },
    },
  },
  {
    name: "sign_chart",
    interaction: {
      answer: {
        type: "sign_chart",
        points: [0],
        options: ["Increasing", "Decreasing"],
        regions: [{ correctIndex: 1 }, { correctIndex: 0 }],
      },
    },
  },
  {
    name: "order_list",
    interaction: { answer: { type: "order_list", items: ["a", "b", "c"] } },
  },
  {
    name: "riemann",
    interaction: {
      answer: {
        type: "riemann",
        fn: "x^2",
        a: 0,
        b: 2,
        trueArea: 2.6667,
        targetWithin: 0.2,
      },
    },
  },
  {
    name: "construct_graph",
    interaction: {
      answer: {
        type: "construct_graph",
        domain: [-2, 2],
        yDomain: [-4, 4],
        nodes: [{ x: -1 }, { x: 0 }, { x: 1 }],
        targetFn: "2*x",
      },
    },
  },
  {
    name: "paint_intervals",
    interaction: {
      answer: {
        type: "paint_intervals",
        fn: "x",
        domain: [-2, 2],
        breakpoints: [0],
        correct: [false, true],
      },
    },
  },
  {
    name: "tangent_line",
    interaction: {
      answer: { type: "tangent_line", fn: "x^2", domain: [-1, 3], x0: 1, slope: 2 },
    },
  },
  {
    name: "integral_bounds",
    interaction: {
      answer: { type: "integral_bounds", fn: "x", domain: [0, 4], a: 1, b: 3 },
    },
  },
  {
    name: "simulate",
    interaction: {
      answer: {
        type: "simulate",
        control: "velocity",
        match: "integral",
        target: "t",
        duration: 4,
        yDomain: [0, 5],
      },
    },
  },
  {
    name: "power_term_fraction",
    interaction: {
      answer: { type: "power_term", coefficient: 5, denominator: 3, exponent: 3 },
    },
  },
];

describe("correctAnswerValue", () => {
  it("returns undefined for a step with no answer", () => {
    expect(correctAnswerValue(makeStep())).toBeUndefined();
  });

  it("returns the chosen index for multiple_choice", () => {
    expect(correctAnswerValue(makeStep(cases[0].interaction))).toBe(2);
  });

  it("returns the coefficient/exponent pair for power_term", () => {
    const value = correctAnswerValue(makeStep(cases[6].interaction));
    expect(value).toEqual({ coefficient: 6, exponent: 1 });
  });

  it("includes the denominator for a fraction-mode power_term", () => {
    const fractionCase = cases.find((c) => c.name === "power_term_fraction")!;
    const value = correctAnswerValue(makeStep(fractionCase.interaction));
    expect(value).toEqual({ coefficient: 5, denominator: 3, exponent: 3 });
  });

  for (const c of cases) {
    it(`produces an answer that checkAnswer grades correct for ${c.name}`, () => {
      const step = makeStep(c.interaction);
      const value = correctAnswerValue(step);
      expect(checkAnswer(step, value).correct).toBe(true);
    });
  }
});

describe("solutionBlocks", () => {
  it("returns the authored solution when present", () => {
    const blocks = [{ type: "text" as const, body: "Because reasons." }];
    const step = makeStep({ answer: { type: "numeric", value: 1 } });
    step.solution = blocks;
    expect(solutionBlocks(step)).toBe(blocks);
  });

  it("falls back to stating the correct answer when none is authored", () => {
    const step = makeStep({ answer: { type: "numeric", value: 42 } });
    const blocks = solutionBlocks(step);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].type === "text" && blocks[0].body).toContain("42");
  });

  it("returns an empty list for a step with no answer", () => {
    expect(solutionBlocks(makeStep())).toEqual([]);
  });
});
