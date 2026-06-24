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
});

describe("verifyNumericWithMathJs", () => {
  it("respects the tolerance", () => {
    expect(verifyNumericWithMathJs(6, 6.005)).toBe(true);
    expect(verifyNumericWithMathJs(6, 6.5)).toBe(false);
    expect(verifyNumericWithMathJs(6, 6.5, 0.6)).toBe(true);
  });
});
