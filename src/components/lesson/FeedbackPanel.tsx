import { RichText } from "../widgets/MathBlock";

interface FeedbackPanelProps {
  message: string;
  isCorrect: boolean | null;
  hint?: string;
  hintRevealed?: boolean;
  onRevealHint?: () => void;
  prominentHint?: boolean;
}

export function FeedbackPanel({
  message,
  isCorrect,
  hint,
  hintRevealed,
  onRevealHint,
  prominentHint,
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
      {hint && isCorrect === false && (
        hintRevealed ? (
          <p className="mt-2 text-sm font-medium">
            💡 Hint: <RichText text={hint} />
          </p>
        ) : (
          <button
            type="button"
            onClick={onRevealHint}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-white active:scale-[0.98] transition"
          >
            💡 Show hint
          </button>
        )
      )}
    </div>
  );
}
