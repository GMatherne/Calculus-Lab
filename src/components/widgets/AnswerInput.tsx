import type { AnswerSpec } from "../../types/content";
import { MathBlock, RichText } from "./MathBlock";
import { DragDropInput } from "./DragDropInput";
import { MultiChoiceInput } from "./MultiChoiceInput";
import { MatchInput } from "./MatchInput";
import { SignChartInput } from "./SignChartInput";
import { OrderListInput } from "./OrderListInput";
import { RiemannInput } from "./RiemannInput";

const COEFF_MIN = 0;
const COEFF_MAX = 99;
const EXP_MIN = 0;
const EXP_MAX = 9;

/** Render a single power term a·xⁿ as LaTeX, collapsing trivial cases. */
function termToLatex(coefficient: number, exponent: number): string {
  if (coefficient === 0) return "0";
  if (exponent === 0) return `${coefficient}`;
  const c = coefficient === 1 ? "" : coefficient === -1 ? "-" : `${coefficient}`;
  const p = exponent === 1 ? "x" : `x^{${exponent}}`;
  return `${c}${p}`;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(Math.round(v), lo), hi);
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/** A labeled −/+ integer control sized for touch. */
function Stepper({ label, value, min, max, disabled, onChange }: StepperProps) {
  const btn =
    "h-11 w-11 shrink-0 rounded-lg border border-slate-300 bg-white text-2xl font-semibold leading-none text-slate-700 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:border-slate-300 disabled:hover:text-slate-700 active:scale-95 transition";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className={btn}
        >
          −
        </button>
        <span className="w-10 text-center text-2xl font-bold tabular-nums text-slate-900">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className={btn}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface AnswerInputProps {
  spec: AnswerSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  /** When true, reveal correctness coloring on the chosen answer. */
  reveal?: boolean;
  /** Whether the submitted answer was correct (only meaningful when reveal is true). */
  isCorrect?: boolean;
  /**
   * Live (continuous) grading is active: tint the field green the moment its
   * value matches, before any commit. Used by `liveCheck` steps; only the
   * scalar inputs (numeric, power_term) act on it.
   */
  live?: boolean;
}

export function AnswerInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
  live,
}: AnswerInputProps) {
  if (spec.type === "multiple_choice") {
    return (
      <div className="space-y-2">
        {spec.options.map((opt, i) => {
          const selected = value === i;
          let stateClasses: string;

          if (reveal && isCorrect && i === spec.correctIndex) {
            // A correct submission confirms the chosen option in green.
            stateClasses = "border-emerald-500 bg-emerald-50 text-emerald-900";
          } else if (reveal && !isCorrect && selected) {
            // A wrong submission only flags the chosen option; the correct
            // answer is never revealed so the learner can try again.
            stateClasses = "border-rose-500 bg-rose-50 text-rose-900";
          } else if (selected) {
            stateClasses = "border-indigo-600 bg-indigo-50 text-indigo-900";
          } else {
            stateClasses = "border-slate-200 bg-white hover:border-indigo-300";
          }

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(i)}
              className={`w-full min-h-[44px] rounded-xl border px-4 py-3 text-left text-base transition-colors ${stateClasses}`}
            >
              <RichText text={opt} />
            </button>
          );
        })}
      </div>
    );
  }

  if (spec.type === "numeric") {
    const liveMatch =
      live === true &&
      value !== "" &&
      value != null &&
      Math.abs(Number(value) - spec.value) <= (spec.tolerance ?? 0.01);
    const revealClasses = reveal
      ? isCorrect
        ? "border-emerald-500 bg-emerald-50 focus:border-emerald-500 focus:ring-emerald-200"
        : "border-rose-500 bg-rose-50 focus:border-rose-500 focus:ring-rose-200"
      : liveMatch
        ? "border-emerald-400 bg-emerald-50/60 focus:border-emerald-500 focus:ring-emerald-200"
        : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200";

    return (
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value === undefined || value === null ? "" : String(value)}
        disabled={disabled}
        placeholder="Enter a number"
        className={`w-full min-h-[44px] rounded-xl border px-4 text-base focus:ring-2 outline-none ${revealClasses}`}
        onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
        onFocus={(e) => e.target.scrollIntoView({ block: "center", behavior: "smooth" })}
      />
    );
  }

  if (spec.type === "power_term") {
    const v = value as { coefficient?: number; exponent?: number } | undefined;
    const coefficient = clampInt(
      Number.isFinite(Number(v?.coefficient))
        ? Number(v?.coefficient)
        : spec.startCoefficient ?? 1,
      COEFF_MIN,
      COEFF_MAX,
    );
    const exponent = clampInt(
      Number.isFinite(Number(v?.exponent))
        ? Number(v?.exponent)
        : spec.startExponent ?? 1,
      EXP_MIN,
      EXP_MAX,
    );
    const set = (c: number, e: number) =>
      onChange({
        coefficient: clampInt(c, COEFF_MIN, COEFF_MAX),
        exponent: clampInt(e, EXP_MIN, EXP_MAX),
      });

    const liveMatch =
      live === true &&
      (spec.coefficient === 0
        ? coefficient === 0
        : coefficient === spec.coefficient && exponent === spec.exponent);
    const previewClasses = reveal
      ? isCorrect
        ? "border-emerald-500 bg-emerald-50"
        : "border-rose-500 bg-rose-50"
      : liveMatch
        ? "border-emerald-400 bg-emerald-50/60"
        : "border-slate-200 bg-slate-50";

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-center gap-8 py-1">
          <Stepper
            label="Coefficient"
            value={coefficient}
            min={COEFF_MIN}
            max={COEFF_MAX}
            disabled={disabled}
            onChange={(c) => set(c, exponent)}
          />
          <Stepper
            label="Exponent"
            value={exponent}
            min={EXP_MIN}
            max={EXP_MAX}
            disabled={disabled}
            onChange={(e) => set(coefficient, e)}
          />
        </div>
        <div
          className={`rounded-xl border px-4 py-3 text-center text-lg ${previewClasses}`}
        >
          <MathBlock
            latex={`${spec.previewPrefix ?? "f'(x) ="} ${termToLatex(coefficient, exponent)}`}
          />
        </div>
      </div>
    );
  }

  if (spec.type === "multi_choice") {
    return (
      <MultiChoiceInput
        spec={spec}
        value={value as (number | null)[] | undefined}
        onChange={onChange}
        disabled={disabled}
        reveal={reveal}
        isCorrect={isCorrect}
      />
    );
  }

  if (spec.type === "drag_drop") {
    return (
      <DragDropInput
        spec={spec}
        value={value as (string | null)[] | undefined}
        onChange={onChange}
        disabled={disabled}
        reveal={reveal}
        isCorrect={isCorrect}
      />
    );
  }

  if (spec.type === "match") {
    return (
      <MatchInput
        spec={spec}
        value={value as (string | null)[] | undefined}
        onChange={onChange}
        disabled={disabled}
        reveal={reveal}
        isCorrect={isCorrect}
      />
    );
  }

  if (spec.type === "sign_chart") {
    return (
      <SignChartInput
        spec={spec}
        value={value as (number | null)[] | undefined}
        onChange={onChange}
        disabled={disabled}
        reveal={reveal}
        isCorrect={isCorrect}
      />
    );
  }

  if (spec.type === "order_list") {
    return (
      <OrderListInput
        spec={spec}
        value={value as string[] | undefined}
        onChange={onChange}
        disabled={disabled}
        reveal={reveal}
        isCorrect={isCorrect}
      />
    );
  }

  if (spec.type === "riemann") {
    return (
      <RiemannInput
        spec={spec}
        value={value as number | undefined}
        onChange={onChange}
        disabled={disabled}
        reveal={reveal}
        isCorrect={isCorrect}
      />
    );
  }

  return null;
}
