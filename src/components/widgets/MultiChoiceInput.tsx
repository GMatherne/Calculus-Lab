import { useMemo } from "react";
import type { MultiChoiceAnswer } from "../../types/content";
import { RichText } from "./MathBlock";

/**
 * A permutation of [0, n) that differs from the identity order when possible, so
 * a row authored with the correct answer first doesn't always show it first.
 */
function shuffledIndices(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return order;
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  return order;
}

interface MultiChoiceInputProps {
  spec: MultiChoiceAnswer;
  /** Chosen option index per row (null where a row is unanswered). */
  value: (number | null)[] | undefined;
  onChange: (value: (number | null)[]) => void;
  disabled?: boolean;
  /** When true, color each row's chosen option by that row's own correctness. */
  reveal?: boolean;
  /** Whether the whole answer was correct (rows self-color, so unused here). */
  isCorrect?: boolean;
}

/**
 * A stack of independent multiple-choice rows. Each row carries its own prompt
 * and options and is selected separately; the parent grades them together. On
 * reveal, only the option a row actually picked is colored — green if that row
 * is right, red if wrong — so a wrong row never gives away its correct choice.
 */
export function MultiChoiceInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
}: MultiChoiceInputProps) {
  const picks: (number | null)[] = spec.parts.map((_, i) => value?.[i] ?? null);

  // Randomize each row's option order so the correct choice isn't always first.
  // Indices (not options) are shuffled and every interaction maps back to the
  // original index, so grading, persistence, and the tutor are unaffected. The
  // spec is stable within a step, so the order holds across retries and only
  // reshuffles when the step changes.
  const orders = useMemo(
    () =>
      spec.parts.map((part) =>
        shuffledIndices((part.options ?? spec.options ?? []).length),
      ),
    [spec],
  );

  const select = (rowIndex: number, optionIndex: number) => {
    const next = spec.parts.map((_, i) => picks[i]);
    next[rowIndex] = optionIndex;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {spec.parts.map((part, ri) => {
        const options = part.options ?? spec.options ?? [];
        const chosen = picks[ri];
        const rowCorrect = chosen != null && chosen === part.correctIndex;

        return (
          <div
            key={ri}
            className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
          >
            <div className="mb-2 text-base font-semibold text-slate-800">
              <RichText text={part.prompt} />
            </div>
            <div className="flex flex-wrap gap-2">
              {orders[ri].map((oi) => {
                const opt = options[oi];
                const isChosen = chosen === oi;
                let stateClasses: string;

                if (reveal && isChosen) {
                  stateClasses = rowCorrect
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-rose-500 bg-rose-50 text-rose-900";
                } else if (isChosen) {
                  stateClasses = "border-indigo-600 bg-indigo-50 text-indigo-900";
                } else {
                  stateClasses =
                    "border-slate-200 bg-white text-slate-700 hover:border-indigo-300";
                }

                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={disabled}
                    onClick={() => select(ri, oi)}
                    className={`min-h-[44px] flex-1 min-w-[96px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${stateClasses}`}
                  >
                    <RichText text={opt} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
