import { RichText } from "../widgets/MathBlock";
import { Icon } from "../common/Icon";

interface FeedbackPanelProps {
  message: string;
  isCorrect: boolean | null;
  hint?: string;
  hintRevealed?: boolean;
  onRevealHint?: () => void;
  prominentHint?: boolean;
  /**
   * Offer the hint proactively (before any submission), used by the "hints"
   * assistance level so the learner can ask for guidance while still working —
   * not only after a wrong answer.
   */
  proactive?: boolean;
}

export function FeedbackPanel({
  message,
  isCorrect,
  hint,
  hintRevealed,
  onRevealHint,
  prominentHint,
  proactive,
}: FeedbackPanelProps) {
  if (isCorrect === null && !hint) return null;

  return (
    <div
      className={`rounded-xl p-4 text-base ${
        isCorrect === true
          ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
          : isCorrect === false
            ? "bg-amber-50 border border-amber-200 text-amber-900"
            : "bg-slate-50 border border-slate-200 text-slate-800"
      } ${prominentHint ? "ring-2 ring-amber-400" : ""}`}
      role="status"
    >
      {message && (
        <p>
          <RichText text={message} />
        </p>
      )}
      {hint && (isCorrect === false || proactive === true) && (
        hintRevealed ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium">
            <Icon
              name="lightbulb"
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            />
            <span>
              Hint: <RichText text={hint} />
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={onRevealHint}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-white active:scale-[0.98] transition"
          >
            <Icon name="lightbulb" className="h-4 w-4" />
            Show hint
          </button>
        )
      )}
    </div>
  );
}
