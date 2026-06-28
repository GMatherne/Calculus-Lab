import type { AnswerSpec, ContentBlock } from "../types/content";

/**
 * Render an answer spec (and a submitted value) into a short, human/LaTeX string.
 * These formatters are deliberately framework-free and depend only on the domain
 * types, so both the AI tutor (`aiTutor.ts`, to describe what the learner did)
 * and the deterministic "Solve it" panel (`solutionService.ts`, to state the
 * answer) can share them without the latter reaching into the tutor module.
 */

/** Flatten content blocks to plain text, wrapping math blocks in inline `$…$`. */
export function contentToText(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => (b.type === "text" ? b.body : `$${b.latex}$`))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse to a finite number, treating null/undefined/""/NaN as "no value". */
function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionAt(options: string[] | undefined, index: unknown): string {
  if (
    typeof index !== "number" ||
    !options ||
    index < 0 ||
    index >= options.length
  ) {
    return "(no selection)";
  }
  return options[index];
}

function formatPowerTerm(
  coefficient: number,
  exponent: number,
  denominator?: number,
): string {
  if (coefficient === 0) return "0";
  // Fraction mode (reverse power rule): write the coefficient as a fraction.
  if (denominator != null && denominator !== 1) {
    const x = exponent === 0 ? "" : exponent === 1 ? "x" : `x^${exponent}`;
    return `(${coefficient}/${denominator})${x}`;
  }
  if (exponent === 0) return `${coefficient}`;
  if (exponent === 1) return `${coefficient}x`;
  return `${coefficient}x^${exponent}`;
}

function formatAssembled(
  prefix: string | undefined,
  parts: { connector?: string; tile: string }[],
): string {
  const body = parts
    .map((p, i) => (i === 0 ? p.tile : `${p.connector ?? "+"} ${p.tile}`))
    .join(" ");
  return prefix ? `${prefix} ${body}`.trim() : body;
}

/**
 * Render an arbitrary submitted value for a given answer spec into a readable
 * string (used for both the learner's answer and, via {@link
 * describeCorrectAnswer}, the correct one).
 */
export function describeAnswer(spec: AnswerSpec, value: unknown): string {
  switch (spec.type) {
    case "multiple_choice":
      return optionAt(spec.options, value);
    case "multi_choice": {
      const picks = Array.isArray(value) ? (value as (number | null)[]) : [];
      return spec.parts
        .map((p, i) => `${p.prompt} → ${optionAt(p.options ?? spec.options, picks[i])}`)
        .join("; ");
    }
    case "numeric":
    case "slider": {
      const n = asFiniteNumber(value);
      return n === null ? "(no answer)" : String(n);
    }
    case "graph_point": {
      const n = asFiniteNumber(value);
      return n === null ? "(no point selected)" : `x = ${n}`;
    }
    case "power_term": {
      const v = (value ?? {}) as {
        coefficient?: number;
        exponent?: number;
        denominator?: number;
      };
      const coef = Number(v.coefficient);
      const exp = Number(v.exponent);
      if (!Number.isFinite(coef) || !Number.isFinite(exp)) {
        return "(incomplete term)";
      }
      const den = spec.denominator != null ? Number(v.denominator) : undefined;
      return formatPowerTerm(coef, exp, den);
    }
    case "drag_drop": {
      const placed = Array.isArray(value) ? (value as (string | null)[]) : [];
      return formatAssembled(
        spec.prefix,
        spec.blanks.map((b, i) => ({
          connector: i === 0 ? undefined : b.connector,
          tile: placed[i] ?? "_",
        })),
      );
    }
    case "match": {
      const picks = Array.isArray(value) ? (value as (string | null)[]) : [];
      return spec.pairs
        .map((p, i) => `${p.prompt} ↔ ${picks[i] ?? "(unmatched)"}`)
        .join("; ");
    }
    case "sign_chart": {
      const picks = Array.isArray(value) ? (value as (number | null)[]) : [];
      return spec.regions
        .map((_, i) => `region ${i + 1}: ${optionAt(spec.options, picks[i])}`)
        .join("; ");
    }
    case "order_list": {
      const order = Array.isArray(value) ? (value as string[]) : [];
      return order.length ? order.join(" → ") : "(empty order)";
    }
    case "riemann": {
      const n = asFiniteNumber(value);
      return n !== null && n > 0 ? `${Math.round(n)} rectangles` : "(no rectangles)";
    }
    case "construct_graph": {
      const ys = Array.isArray(value) ? (value as (number | null)[]) : [];
      return spec.nodes
        .map((node, i) => {
          const y = ys[i];
          return `x=${node.x}: ${typeof y === "number" ? y : "—"}`;
        })
        .join(", ");
    }
    case "paint_intervals": {
      const picks = Array.isArray(value) ? (value as boolean[]) : [];
      const shaded = picks
        .map((v, i) => (v ? i + 1 : null))
        .filter((v): v is number => v !== null);
      return shaded.length ? `shaded segments ${shaded.join(", ")}` : "(nothing shaded)";
    }
    case "tangent_line": {
      const n = asFiniteNumber(value);
      return n === null ? "(no line set)" : `slope = ${n}`;
    }
    case "integral_bounds": {
      const v = (value ?? {}) as { a?: number; b?: number };
      const a = asFiniteNumber(v.a);
      const b = asFiniteNumber(v.b);
      if (a === null || b === null) return "(bounds not set)";
      return `a = ${Math.min(a, b)}, b = ${Math.max(a, b)}`;
    }
    case "simulate":
      return Array.isArray(value) && value.length > 1
        ? "a real-time traced curve"
        : "(no run yet)";
    case "select_region": {
      if (spec.multi) {
        const picks = Array.isArray(value) ? (value as boolean[]) : [];
        const chosen = picks
          .map((v, i) => (v ? i + 1 : null))
          .filter((v): v is number => v !== null);
        return chosen.length ? `regions ${chosen.join(", ")}` : "(no region selected)";
      }
      const idx = typeof value === "number" ? value : -1;
      if (idx < 0 || idx >= spec.bands.length) return "(no region selected)";
      const b = spec.bands[idx];
      return `region ${idx + 1} (x from ${b.from} to ${b.to})`;
    }
    default:
      return "(unknown)";
  }
}

/** Describe the correct answer encoded in an answer spec. */
export function describeCorrectAnswer(spec: AnswerSpec): string {
  switch (spec.type) {
    case "multiple_choice":
      return describeAnswer(spec, spec.correctIndex);
    case "multi_choice":
      return describeAnswer(spec, spec.parts.map((p) => p.correctIndex));
    case "numeric":
    case "slider":
      return String(spec.value);
    case "graph_point":
      return `x = ${spec.x}`;
    case "power_term":
      return formatPowerTerm(spec.coefficient, spec.exponent, spec.denominator);
    case "drag_drop":
      return formatAssembled(
        spec.prefix,
        spec.blanks.map((b, i) => ({
          connector: i === 0 ? undefined : b.connector,
          tile: b.accept,
        })),
      );
    case "match":
      return describeAnswer(spec, spec.pairs.map((p) => p.match));
    case "sign_chart":
      return describeAnswer(spec, spec.regions.map((r) => r.correctIndex));
    case "order_list":
      return spec.items.join(" → ");
    case "riemann":
      return `true area = ${spec.trueArea} (use enough rectangles to land within ${spec.targetWithin})`;
    case "construct_graph":
      return spec.targetFn
        ? `each point on y = ${spec.targetFn}`
        : `y-values ${(spec.targetY ?? []).join(", ")}`;
    case "paint_intervals": {
      const shaded = spec.correct
        .map((v, i) => (v ? i + 1 : null))
        .filter((v): v is number => v !== null);
      return shaded.length ? `shade segments ${shaded.join(", ")}` : "(shade nothing)";
    }
    case "tangent_line":
      return `slope = ${spec.slope}`;
    case "integral_bounds":
      return `a = ${spec.a}, b = ${spec.b}`;
    case "simulate":
      return `trace the target ${spec.target} over [0, ${spec.duration}]`;
    case "select_region": {
      const correct = spec.bands
        .map((b, i) => (b.correct ? i + 1 : null))
        .filter((v): v is number => v !== null);
      if (spec.multi) {
        return correct.length ? `regions ${correct.join(", ")}` : "(none)";
      }
      const idx = correct[0];
      if (idx === undefined) return "(none)";
      const b = spec.bands[idx - 1];
      return `region ${idx} (x from ${b.from} to ${b.to})`;
    }
    default:
      return "(unknown)";
  }
}
