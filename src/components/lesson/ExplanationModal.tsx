interface ExplanationModalProps {
  isCorrect: boolean;
  message: string;
  hint?: string;
  hintRevealed?: boolean;
  onRevealHint?: () => void;
  continueLabel: string;
  onContinue: () => void;
}

export function ExplanationModal({
  isCorrect,
  message,
  hint,
  hintRevealed,
  onRevealHint,
  continueLabel,
  onContinue,
}: ExplanationModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onContinue} />
      <div
        className={`relative w-full max-w-2xl rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-10 sm:pb-8 shadow-2xl safe-bottom ${
          isCorrect
            ? "bg-emerald-50 border-t-4 sm:border-4 border-emerald-400"
            : "bg-rose-50 border-t-4 sm:border-4 border-rose-400"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ${
              isCorrect ? "bg-emerald-500" : "bg-rose-500"
            }`}
            aria-hidden="true"
          >
            {isCorrect ? "✓" : "✕"}
          </span>
          <h2
            className={`text-xl font-bold ${
              isCorrect ? "text-emerald-900" : "text-rose-900"
            }`}
          >
            {isCorrect ? "Correct!" : "Not quite"}
          </h2>
        </div>

        {message && (
          <p
            className={`text-base ${
              isCorrect ? "text-emerald-900" : "text-rose-900"
            }`}
          >
            {message}
          </p>
        )}

        {hint && !isCorrect && (
          hintRevealed ? (
            <p className="mt-3 text-sm font-medium text-rose-800">
              💡 Hint: {hint}
            </p>
          ) : (
            <button
              type="button"
              onClick={onRevealHint}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white/70 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-white active:scale-[0.98] transition"
            >
              💡 Show hint
            </button>
          )
        )}

        <button
          type="button"
          onClick={onContinue}
          className={`mt-5 w-full min-h-[48px] rounded-xl font-semibold text-base text-white active:scale-[0.98] transition ${
            isCorrect
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
