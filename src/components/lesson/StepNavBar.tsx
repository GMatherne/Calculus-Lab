export type StepState = "info" | "done" | "todo";

interface StepNavBarProps {
  /** State for each step, in order. */
  states: StepState[];
  /** Index of the step currently being viewed. */
  currentIndex: number;
  /**
   * Highest step index the learner may jump to. Steps beyond this are locked
   * so a lesson can't be skipped to the end without working through it.
   */
  maxSelectableIndex: number;
  /** Jump to a step. Used for free navigation while reviewing. */
  onSelect: (index: number) => void;
}

const STATE_STYLES: Record<StepState, string> = {
  // Information (read) steps: light gray.
  info: "bg-slate-200 text-slate-600 hover:bg-slate-300",
  // Completed questions: green.
  done: "bg-emerald-500 text-white hover:bg-emerald-600",
  // Unanswered questions: dark gray.
  todo: "bg-slate-600 text-white hover:bg-slate-700",
};

const STATE_LABELS: Record<StepState, string> = {
  info: "information",
  done: "completed",
  todo: "not completed",
};

/**
 * Row of squares — one per step — that doubles as a progress indicator and a
 * navigation control. Learners can revisit any step they've already reached,
 * which makes reviewing a lesson far quicker than answering through it again.
 * Steps past their furthest progress are locked so the lesson can't be skipped
 * straight to the end.
 */
export function StepNavBar({
  states,
  currentIndex,
  maxSelectableIndex,
  onSelect,
}: StepNavBarProps) {
  const base =
    "h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition";

  return (
    <nav aria-label="Lesson steps" className="flex flex-wrap gap-2">
      {states.map((state, index) => {
        const isCurrent = index === currentIndex;
        const locked = index > maxSelectableIndex;
        const className = locked
          ? `${base} bg-slate-100 text-slate-300 cursor-not-allowed`
          : `${base} active:scale-95 ${STATE_STYLES[state]}${
              isCurrent
                ? " ring-2 ring-indigo-500 ring-offset-2 ring-offset-white"
                : ""
            }`;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            disabled={locked}
            aria-current={isCurrent ? "step" : undefined}
            title={
              locked
                ? `Step ${index + 1} (locked — finish earlier steps first)`
                : `Step ${index + 1} (${STATE_LABELS[state]})`
            }
            className={className}
          >
            {index + 1}
          </button>
        );
      })}
    </nav>
  );
}
