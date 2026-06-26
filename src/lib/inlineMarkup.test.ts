import {
  normalizeMathDelimiters,
  stripListMarker,
  tokenizeInline,
  type InlineToken,
} from "./inlineMarkup";

const text = (value: string): InlineToken => ({ type: "text", value });
const math = (value: string): InlineToken => ({ type: "math", value });

describe("normalizeMathDelimiters", () => {
  it("rewrites \\(…\\) inline math to $…$", () => {
    expect(normalizeMathDelimiters("the slope \\(3x^2\\) here")).toBe(
      "the slope $3x^2$ here",
    );
  });

  it("rewrites \\[…\\] display math to $…$", () => {
    expect(normalizeMathDelimiters("\\[\\frac{x^3}{3}\\]")).toBe("$\\frac{x^3}{3}$");
  });

  it("rewrites $$…$$ to $…$ and trims the inner LaTeX", () => {
    expect(normalizeMathDelimiters("$$ x^2 + 1 $$")).toBe("$x^2 + 1$");
  });

  it("leaves existing $…$ untouched and keeps two adjacent inline maths intact", () => {
    expect(normalizeMathDelimiters("$a$ and $b$")).toBe("$a$ and $b$");
  });
});

describe("tokenizeInline", () => {
  it("returns a single text token for plain prose", () => {
    expect(tokenizeInline("just words")).toEqual([text("just words")]);
  });

  it("extracts inline math and trims its body", () => {
    expect(tokenizeInline("derivative is $ 3x^2 $ today")).toEqual([
      text("derivative is "),
      math("3x^2"),
      text(" today"),
    ]);
  });

  it("treats * inside math as math, never emphasis", () => {
    expect(tokenizeInline("$2*x + 1$")).toEqual([math("2*x + 1")]);
  });

  it("parses **bold** and *italic*, recursing into nested math", () => {
    expect(tokenizeInline("**key** point")).toEqual([
      { type: "bold", children: [text("key")] },
      text(" point"),
    ]);
    expect(tokenizeInline("the *slope $m$* matters")).toEqual([
      text("the "),
      { type: "italic", children: [text("slope "), math("m")] },
      text(" matters"),
    ]);
  });

  it("prefers bold over italic for doubled asterisks", () => {
    expect(tokenizeInline("**bold**")).toEqual([
      { type: "bold", children: [text("bold")] },
    ]);
  });

  it("leaves spaced-out products and lone asterisks as literal text", () => {
    expect(tokenizeInline("compute 2 * 3 here")).toEqual([text("compute 2 * 3 here")]);
    expect(tokenizeInline("a*b with no pair")).toEqual([text("a*b with no pair")]);
  });

  it("parses inline `code` spans", () => {
    expect(tokenizeInline("call `f(x)` now")).toEqual([
      text("call "),
      { type: "code", value: "f(x)" },
      text(" now"),
    ]);
  });

  it("handles back-to-back math and emphasis", () => {
    expect(tokenizeInline("$x$ is **big**")).toEqual([
      math("x"),
      text(" is "),
      { type: "bold", children: [text("big")] },
    ]);
  });
});

describe("stripListMarker", () => {
  it("removes leading bullet markers", () => {
    expect(stripListMarker("* first idea")).toBe("first idea");
    expect(stripListMarker("- second idea")).toBe("second idea");
    expect(stripListMarker("  • indented")).toBe("indented");
  });

  it("keeps ordered markers and bare negatives", () => {
    expect(stripListMarker("1. first step")).toBe("1. first step");
    expect(stripListMarker("-3 is the minimum")).toBe("-3 is the minimum");
  });
});
