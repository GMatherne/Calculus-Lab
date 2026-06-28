import { useMemo } from "react";
import type { MultipleChoiceAnswer } from "../../types/content";
import { RichText } from "./MathBlock";

interface MultipleChoiceInputProps {
  spec: MultipleChoiceAnswer;
  /** Chosen option index, into the spec's original `options` (undefined if unpicked). */
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** When true, reveal correctness coloring on the chosen answer. */
  reveal?: boolean;
  /** Whether the submitted answer was correct (only meaningful when reveal is true). */
  isCorrect?: boolean;
}

/**
 * A permutation of [0, n) that differs from the identity order when possible, so
 * a question authored with the correct answer first doesn't always show it
 * first.
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

/**
 * Single-answer multiple choice. The displayed order is randomized per question
 * so the correct option isn't always first, but only the *display* order moves:
 * the indices are shuffled while every click and the reveal coloring map back to
 * the original index, so grading, persistence, and the tutor (all keyed off the
 * authored `correctIndex`) are unaffected. The spec is stable within a step, so
 * the order holds across retries and only reshuffles when the step changes.
 */
export function MultipleChoiceInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: MultipleChoiceInputProps) {
  const order = useMemo(() => shuffledIndices(spec.options.length), [spec]);

  return (
    <div className="space-y-2">
      {order.map((optionIndex) => {
        const selected = value === optionIndex;
        let stateClasses: string;

        if (reveal && isCorrect && optionIndex === spec.correctIndex) {
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
            key={optionIndex}
            type="button"
            disabled={disabled}
            onClick={() => onChange(optionIndex)}
            className={`w-full min-h-[44px] rounded-xl border px-4 py-3 text-left text-base transition-colors ${stateClasses}`}
          >
            <RichText text={spec.options[optionIndex]} />
          </button>
        );
      })}
    </div>
  );
}
