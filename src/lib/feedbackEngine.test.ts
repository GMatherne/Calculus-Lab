import {
  evalFunction,
  secantSlope,
  derivativeAt,
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
  });
});

describe("verifyNumericWithMathJs", () => {
  it("respects the tolerance", () => {
    expect(verifyNumericWithMathJs(6, 6.005)).toBe(true);
    expect(verifyNumericWithMathJs(6, 6.5)).toBe(false);
    expect(verifyNumericWithMathJs(6, 6.5, 0.6)).toBe(true);
  });
});
