import type { AnswerSpec } from "../../types/content";

interface AnswerInputProps {
  spec: AnswerSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  /** When true, reveal correctness coloring on the chosen answer. */
  reveal?: boolean;
  /** Whether the submitted answer was correct (only meaningful when reveal is true). */
  isCorrect?: boolean;
}

export function AnswerInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
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
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (spec.type === "numeric") {
    const revealClasses = reveal
      ? isCorrect
        ? "border-emerald-500 bg-emerald-50 focus:border-emerald-500 focus:ring-emerald-200"
        : "border-rose-500 bg-rose-50 focus:border-rose-500 focus:ring-rose-200"
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

  return null;
}
