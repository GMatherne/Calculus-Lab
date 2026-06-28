import {
  evalFunction,
  secantSlope,
  derivativeAt,
  riemannSum,
  checkAnswer,
  verifyNumericWithMathJs,
} from "./feedbackEngine";
import type { AnswerSpec, Step, StepFeedback } from "../types/content";

const feedback: StepFeedback = {
  correct: "Correct!",
  incorrect: "Not quite.",
  hint: "A helpful hint.",
};

/** Build a minimal interactive step around a given answer spec. */
function stepWith(answer: AnswerSpec): Step {
  return {
    id: "s",
    type: "multiple_choice",
    content: [],
    interaction: { answer },
    feedback,
  };
}

describe("evalFunction", () => {
  it("evaluates expressions using ^ for powers", () => {
    expect(evalFunction("x^2", 3)).toBe(9);
    expect(evalFunction("2*x + 1", 4)).toBe(9);
  });

  it("throws on non-finite results", () => {
    expect(() => evalFunction("1/x", 0)).toThrow();
  });
});

describe("secantSlope", () => {
  it("computes rise over run between two points", () => {
    // (f(3) - f(2)) / 1 = (9 - 4) / 1
    expect(secantSlope("x^2", 2, 1)).toBe(5);
  });

  it("returns NaN when h is effectively zero", () => {
    expect(Number.isNaN(secantSlope("x^2", 2, 0))).toBe(true);
  });
});

describe("derivativeAt", () => {
  it("approximates the derivative via a central difference", () => {
    expect(derivativeAt("x^2", 2)).toBeCloseTo(4, 3);
    expect(derivativeAt("x^3", 1)).toBeCloseTo(3, 3);
  });
});

describe("checkAnswer", () => {
  it("treats a step with no answer spec as correct", () => {
    const step: Step = { id: "s", type: "read", content: [], feedback };
    const res = checkAnswer(step, null);
    expect(res.correct).toBe(true);
    expect(res.message).toBe(feedback.correct);
  });

  describe("multiple_choice", () => {
    const step = stepWith({
      type: "multiple_choice",
      options: ["a", "b", "c", "d"],
      correctIndex: 2,
    });

    it("accepts the correct index", () => {
      expect(checkAnswer(step, 2).correct).toBe(true);
    });

    it("rejects a wrong index and surfaces the hint", () => {
      const res = checkAnswer(step, 0);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });
  });

  describe("multi_choice", () => {
    const step = stepWith({
      type: "multi_choice",
      options: ["Maximum", "Minimum", "Neither"],
      parts: [
        { prompt: "x = 0", correctIndex: 0 },
        { prompt: "x = 1", correctIndex: 2 },
        { prompt: "x = 2", correctIndex: 1 },
      ],
    });

    it("accepts when every row matches its correct option", () => {
      expect(checkAnswer(step, [0, 2, 1]).correct).toBe(true);
    });

    it("rejects when any row is wrong and surfaces the hint", () => {
      const res = checkAnswer(step, [0, 1, 1]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("rejects an incomplete or missing answer", () => {
      expect(checkAnswer(step, [0, 2]).correct).toBe(false);
      expect(checkAnswer(step, [0, null, 1]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });

    it("treats option index 0 as a real selection, not a blank", () => {
      // A row whose correct (and chosen) answer is the first option still counts.
      expect(checkAnswer(step, [0, 2, 1]).correct).toBe(true);
    });
  });

  describe("numeric", () => {
    const step = stepWith({ type: "numeric", value: 6, tolerance: 0.01 });

    it("accepts values within tolerance", () => {
      expect(checkAnswer(step, 6).correct).toBe(true);
      expect(checkAnswer(step, 6.005).correct).toBe(true);
    });

    it("rejects values outside tolerance", () => {
      expect(checkAnswer(step, 6.5).correct).toBe(false);
    });

    it("rejects non-numeric input with a clear message", () => {
      const res = checkAnswer(step, "abc");
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toMatch(/valid number/i);
    });
  });

  describe("graph_point", () => {
    const step = stepWith({ type: "graph_point", x: 0 });

    it("uses a default tolerance of 0.25", () => {
      expect(checkAnswer(step, 0.2).correct).toBe(true);
      expect(checkAnswer(step, 0.3).correct).toBe(false);
    });

    it("accepts any acceptX point (e.g. ±2 both have slope 12 for x³)", () => {
      const multi = stepWith({
        type: "graph_point",
        x: 2,
        acceptX: [-2],
        tolerance: 0.25,
      });
      expect(checkAnswer(multi, 2).correct).toBe(true);
      expect(checkAnswer(multi, -2).correct).toBe(true);
      // Points that satisfy neither root are still wrong.
      expect(checkAnswer(multi, 0).correct).toBe(false);
      expect(checkAnswer(multi, 1).correct).toBe(false);
    });
  });

  describe("predict_point", () => {
    it("uses a default tolerance of 0.3", () => {
      const step = stepWith({
        type: "predict_point",
        x: -1,
        reveal: { tangent: true },
      });
      expect(checkAnswer(step, -1.2).correct).toBe(true);
      expect(checkAnswer(step, -0.5).correct).toBe(false);
    });

    it("accepts any acceptX target and rejects a missing marker", () => {
      const step = stepWith({
        type: "predict_point",
        x: 2,
        acceptX: [-2],
        tolerance: 0.3,
        reveal: { point: true },
      });
      expect(checkAnswer(step, 2).correct).toBe(true);
      expect(checkAnswer(step, -2).correct).toBe(true);
      expect(checkAnswer(step, 0).correct).toBe(false);
      const res = checkAnswer(step, undefined);
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toMatch(/drag the marker/i);
    });
  });

  describe("power_term", () => {
    it("requires both coefficient and exponent to match", () => {
      const step = stepWith({ type: "power_term", coefficient: 6, exponent: 1 });
      expect(checkAnswer(step, { coefficient: 6, exponent: 1 }).correct).toBe(true);
      expect(checkAnswer(step, { coefficient: 6, exponent: 2 }).correct).toBe(false);
      expect(checkAnswer(step, { coefficient: 3, exponent: 1 }).correct).toBe(false);
    });

    it("ignores the exponent when the coefficient is zero", () => {
      const step = stepWith({ type: "power_term", coefficient: 0, exponent: 0 });
      expect(checkAnswer(step, { coefficient: 0, exponent: 7 }).correct).toBe(true);
      expect(checkAnswer(step, { coefficient: 2, exponent: 0 }).correct).toBe(false);
    });

    it("requires numerator, denominator, and exponent in fraction mode", () => {
      // ∫5x² dx = 5/3·x³
      const step = stepWith({
        type: "power_term",
        coefficient: 5,
        denominator: 3,
        exponent: 3,
      });
      expect(
        checkAnswer(step, { coefficient: 5, denominator: 3, exponent: 3 }).correct,
      ).toBe(true);
      // Right numerator/exponent but wrong denominator is incorrect.
      expect(
        checkAnswer(step, { coefficient: 5, denominator: 2, exponent: 3 }).correct,
      ).toBe(false);
      // A missing denominator can't grade correct in fraction mode.
      expect(checkAnswer(step, { coefficient: 5, exponent: 3 }).correct).toBe(false);
    });
  });

  describe("drag_drop", () => {
    const step = stepWith({
      type: "drag_drop",
      prefix: "f'(x) =",
      blanks: [{ accept: "3x^2" }, { accept: "2x" }],
      bank: ["3x^2", "2x", "3x^3", "x^2"],
    });

    it("accepts the correct tiles in each blank", () => {
      expect(checkAnswer(step, ["3x^2", "2x"]).correct).toBe(true);
    });

    it("rejects a wrong tile and surfaces the hint", () => {
      const res = checkAnswer(step, ["3x^3", "2x"]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("accepts the terms in any order (addition is commutative)", () => {
      expect(checkAnswer(step, ["2x", "3x^2"]).correct).toBe(true);
    });

    it("rejects an incomplete or missing answer", () => {
      expect(checkAnswer(step, ["3x^2", null]).correct).toBe(false);
      expect(checkAnswer(step, ["3x^2"]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });

    describe("with a subtraction connector", () => {
      // f'(x) = 3x^2 - 2; the sign is fixed to the slot, so order matters here.
      const subStep = stepWith({
        type: "drag_drop",
        prefix: "f'(x) =",
        blanks: [{ accept: "3x^2" }, { accept: "2", connector: "-" }],
        bank: ["3x^2", "2", "x^2", "3x"],
      });

      it("accepts the correct signed arrangement", () => {
        expect(checkAnswer(subStep, ["3x^2", "2"]).correct).toBe(true);
      });

      it("rejects swapping terms across the minus sign", () => {
        // "2 - 3x^2" is not equal to "3x^2 - 2".
        expect(checkAnswer(subStep, ["2", "3x^2"]).correct).toBe(false);
      });
    });
  });

  describe("match", () => {
    const step = stepWith({
      type: "match",
      pairs: [
        { prompt: "$x^2$", match: "x^3/3" },
        { prompt: "$x$", match: "x^2/2" },
        { prompt: "$x^3$", match: "x^4/4" },
      ],
      distractors: ["x^3/2"],
    });

    it("accepts when every prompt holds its correct match", () => {
      expect(checkAnswer(step, ["x^3/3", "x^2/2", "x^4/4"]).correct).toBe(true);
    });

    it("rejects a wrong pairing and surfaces the hint", () => {
      const res = checkAnswer(step, ["x^3/2", "x^2/2", "x^4/4"]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("is graded by position, so swapped matches are wrong", () => {
      expect(checkAnswer(step, ["x^2/2", "x^3/3", "x^4/4"]).correct).toBe(false);
    });

    it("rejects an incomplete or missing answer", () => {
      expect(checkAnswer(step, ["x^3/3", null, "x^4/4"]).correct).toBe(false);
      expect(checkAnswer(step, ["x^3/3", "x^2/2"]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });

    it("grades a distractor that mirrors a correct value by position", () => {
      // "2" is both the correct answer for 1+1 and a distractor, so placing "2"
      // on 2+2 must still be wrong even though the same label is correct above.
      const dup = stepWith({
        type: "match",
        pairs: [
          { prompt: "$1+1$", match: "2" },
          { prompt: "$2+2$", match: "4" },
        ],
        distractors: ["2"],
      });
      expect(checkAnswer(dup, ["2", "4"]).correct).toBe(true);
      expect(checkAnswer(dup, ["2", "2"]).correct).toBe(false);
    });

    it("accepts two prompts that share the same correct answer", () => {
      const shared = stepWith({
        type: "match",
        pairs: [
          { prompt: "$1+1$", match: "2" },
          { prompt: "$4-2$", match: "2" },
        ],
      });
      expect(checkAnswer(shared, ["2", "2"]).correct).toBe(true);
      expect(checkAnswer(shared, ["2", null]).correct).toBe(false);
    });
  });

  describe("sign_chart", () => {
    // f(x) = x^2 falls on x < 0 and rises on x > 0, so the two regions split at 0.
    const step = stepWith({
      type: "sign_chart",
      points: [0],
      options: ["Increasing", "Decreasing"],
      regions: [{ correctIndex: 1 }, { correctIndex: 0 }],
    });

    it("accepts when every region holds its correct label", () => {
      expect(checkAnswer(step, [1, 0]).correct).toBe(true);
    });

    it("rejects a wrong region and surfaces the hint", () => {
      const res = checkAnswer(step, [0, 0]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("rejects an incomplete or missing answer", () => {
      expect(checkAnswer(step, [1, null]).correct).toBe(false);
      expect(checkAnswer(step, [1]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });

    it("treats option index 0 as a real selection, not a blank", () => {
      const allFirst = stepWith({
        type: "sign_chart",
        points: [0],
        options: ["Increasing", "Decreasing"],
        regions: [{ correctIndex: 0 }, { correctIndex: 0 }],
      });
      expect(checkAnswer(allFirst, [0, 0]).correct).toBe(true);
    });
  });

  describe("order_list", () => {
    const step = stepWith({
      type: "order_list",
      items: ["First", "Second", "Third"],
    });

    it("accepts the exact authored order", () => {
      expect(checkAnswer(step, ["First", "Second", "Third"]).correct).toBe(true);
    });

    it("rejects any other ordering and surfaces the hint", () => {
      const res = checkAnswer(step, ["Second", "First", "Third"]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("rejects an incomplete or missing answer", () => {
      expect(checkAnswer(step, ["First", "Second"]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });
  });

  describe("riemann", () => {
    // ∫₀⁴ x² dx = 64/3 ≈ 21.33; the midpoint rule converges quickly.
    const step = stepWith({
      type: "riemann",
      fn: "x^2",
      a: 0,
      b: 4,
      trueArea: 64 / 3,
      targetWithin: 0.2,
    });

    it("accepts once enough rectangles bring the estimate within tolerance", () => {
      // n = 20 midpoint rectangles is well inside 0.2 of the true area.
      expect(checkAnswer(step, 20).correct).toBe(true);
    });

    it("rejects a coarse estimate that is still too far off", () => {
      const res = checkAnswer(step, 1);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("rejects a non-positive or missing rectangle count", () => {
      expect(checkAnswer(step, 0).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });
  });

  describe("construct_graph", () => {
    // Plot the derivative f'(x) = 2x at sample x-values.
    const step = stepWith({
      type: "construct_graph",
      domain: [-3, 3],
      yDomain: [-6, 6],
      targetFn: "2*x",
      nodes: [{ x: -2 }, { x: -1 }, { x: 0 }, { x: 1 }, { x: 2 }],
    });

    it("accepts when every node is within tolerance of the target", () => {
      expect(checkAnswer(step, [-4, -2, 0, 2, 4]).correct).toBe(true);
      // The default per-node tolerance (0.4) absorbs a little wobble.
      expect(checkAnswer(step, [-4.3, -1.7, 0.2, 2.3, 3.7]).correct).toBe(true);
    });

    it("rejects when any node is too far off and surfaces the hint", () => {
      const res = checkAnswer(step, [-4, -2, 0, 2, 1]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("rejects an incomplete or missing answer", () => {
      expect(checkAnswer(step, [-4, -2, 0, 2]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });

    it("supports explicit per-node targetY with its own tolerance", () => {
      const ty = stepWith({
        type: "construct_graph",
        domain: [0, 3],
        yDomain: [0, 6],
        targetY: [0, 2, 4],
        nodes: [{ x: 0 }, { x: 1 }, { x: 2, tolerance: 0.1 }],
      });
      expect(checkAnswer(ty, [0, 2, 4]).correct).toBe(true);
      // The third node's tight 0.1 tolerance rejects a 0.3 miss.
      expect(checkAnswer(ty, [0, 2, 4.3]).correct).toBe(false);
    });
  });

  describe("paint_intervals", () => {
    // x^3 - 3x increases on the outer intervals and falls in the middle.
    const step = stepWith({
      type: "paint_intervals",
      fn: "x^3 - 3*x",
      domain: [-2.2, 2.2],
      breakpoints: [-1, 1],
      correct: [true, false, true],
    });

    it("accepts an exact match of the shaded segments", () => {
      expect(checkAnswer(step, [true, false, true]).correct).toBe(true);
    });

    it("rejects any mismatch and surfaces the hint", () => {
      const res = checkAnswer(step, [true, true, true]);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("treats missing entries as unshaded", () => {
      expect(checkAnswer(step, [true, false]).correct).toBe(false);
      expect(checkAnswer(step, undefined).correct).toBe(false);
    });
  });

  describe("tangent_line", () => {
    const step = stepWith({
      type: "tangent_line",
      fn: "x^2",
      domain: [-1, 3],
      x0: 1,
      slope: 2,
    });

    it("accepts a slope within the default tolerance (0.3)", () => {
      expect(checkAnswer(step, 2).correct).toBe(true);
      expect(checkAnswer(step, 2.25).correct).toBe(true);
      expect(checkAnswer(step, 1.75).correct).toBe(true);
    });

    it("rejects a slope outside tolerance", () => {
      expect(checkAnswer(step, 3).correct).toBe(false);
      const res = checkAnswer(step, 0);
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toBe(feedback.incorrect);
    });

    it("rejects a missing slope with a clear message", () => {
      const res = checkAnswer(step, undefined);
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toMatch(/slope/i);
    });
  });

  describe("integral_bounds", () => {
    const step = stepWith({
      type: "integral_bounds",
      fn: "x",
      domain: [0, 4],
      a: 1,
      b: 3,
    });

    it("accepts both bounds within the default tolerance (0.25)", () => {
      expect(checkAnswer(step, { a: 1, b: 3 }).correct).toBe(true);
      expect(checkAnswer(step, { a: 1.2, b: 2.8 }).correct).toBe(true);
    });

    it("accepts handles dragged in either order (graded sorted)", () => {
      expect(checkAnswer(step, { a: 3, b: 1 }).correct).toBe(true);
    });

    it("rejects an off bound, or a missing answer", () => {
      expect(checkAnswer(step, { a: 1, b: 3.6 }).correct).toBe(false);
      const res = checkAnswer(step, undefined);
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toMatch(/bounds/i);
    });
  });

  describe("simulate", () => {
    // Target position = t over [0, 4]; the trace is graded at N evenly spaced t.
    const step = stepWith({
      type: "simulate",
      control: "velocity",
      match: "integral",
      target: "t",
      duration: 4,
      yDomain: [0, 5],
      tolerance: 0.5,
      coverage: 0.8,
    });
    const N = 60;
    const seriesFrom = (fn: (t: number) => number): number[] =>
      Array.from({ length: N }, (_, i) => fn((4 * i) / (N - 1)));

    it("accepts a trace that tracks the target within the band", () => {
      expect(checkAnswer(step, seriesFrom((t) => t)).correct).toBe(true);
      expect(checkAnswer(step, seriesFrom((t) => t + 0.3)).correct).toBe(true);
    });

    it("rejects a trace that misses the target throughout", () => {
      const res = checkAnswer(step, seriesFrom((t) => t + 2));
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toBe(feedback.incorrect);
    });

    it("rejects a trace in-band less often than the coverage fraction", () => {
      // In band only for t <= 2 (about half the run) → below the 0.8 requirement.
      expect(
        checkAnswer(step, seriesFrom((t) => (t <= 2 ? t : t + 3))).correct,
      ).toBe(false);
    });

    it("rejects an empty or too-short trace", () => {
      const res = checkAnswer(step, []);
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toMatch(/run/i);
    });
  });

  describe("select_region", () => {
    // Single-select: exactly one band (the second) is correct.
    const single = stepWith({
      type: "select_region",
      fn: "x^2",
      domain: [0, 4],
      bands: [
        { from: 0, to: 1 },
        { from: 1, to: 2, correct: true },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
      ],
    });

    it("accepts the correct band index, including index 0", () => {
      expect(checkAnswer(single, 1).correct).toBe(true);
      const firstCorrect = stepWith({
        type: "select_region",
        fn: "x^2",
        domain: [0, 2],
        bands: [
          { from: 0, to: 1, correct: true },
          { from: 1, to: 2 },
        ],
      });
      expect(checkAnswer(firstCorrect, 0).correct).toBe(true);
    });

    it("rejects a wrong band and surfaces the hint", () => {
      const res = checkAnswer(single, 2);
      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.message).toBe(feedback.incorrect);
        expect(res.hint).toBe(feedback.hint);
      }
    });

    it("rejects a missing, null, or out-of-range selection", () => {
      const res = checkAnswer(single, undefined);
      expect(res.correct).toBe(false);
      if (!res.correct) expect(res.message).toMatch(/select a region/i);
      expect(checkAnswer(single, null).correct).toBe(false);
      expect(checkAnswer(single, 9).correct).toBe(false);
    });

    describe("multi-select", () => {
      const multi = stepWith({
        type: "select_region",
        fn: "x^3 - 3*x",
        domain: [-2, 2],
        multi: true,
        bands: [
          { from: -2, to: -1, correct: true },
          { from: -1, to: 1 },
          { from: 1, to: 2, correct: true },
        ],
      });

      it("accepts an exact match of the correct bands", () => {
        expect(checkAnswer(multi, [true, false, true]).correct).toBe(true);
      });

      it("rejects an extra, missing, or empty selection", () => {
        expect(checkAnswer(multi, [true, true, true]).correct).toBe(false);
        expect(checkAnswer(multi, [true, false, false]).correct).toBe(false);
        expect(checkAnswer(multi, undefined).correct).toBe(false);
      });
    });
  });
});

describe("riemannSum", () => {
  it("approaches the true integral as rectangles increase", () => {
    // ∫₀⁴ x² dx = 64/3 ≈ 21.333…
    const exact = 64 / 3;
    expect(Math.abs(riemannSum("x^2", 0, 4, 4) - exact)).toBeGreaterThan(
      Math.abs(riemannSum("x^2", 0, 4, 40) - exact),
    );
    expect(riemannSum("x^2", 0, 4, 200)).toBeCloseTo(exact, 1);
  });

  it("is exact for a constant function at any rectangle count", () => {
    expect(riemannSum("3", 0, 5, 1)).toBeCloseTo(15, 6);
    expect(riemannSum("3", 0, 5, 7)).toBeCloseTo(15, 6);
  });

  it("returns 0 for a non-positive count", () => {
    expect(riemannSum("x^2", 0, 4, 0)).toBe(0);
  });
});

describe("verifyNumericWithMathJs", () => {
  it("respects the tolerance", () => {
    expect(verifyNumericWithMathJs(6, 6.005)).toBe(true);
    expect(verifyNumericWithMathJs(6, 6.5)).toBe(false);
    expect(verifyNumericWithMathJs(6, 6.5, 0.6)).toBe(true);
  });
});

