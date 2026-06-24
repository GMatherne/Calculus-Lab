import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { PracticeResult } from "../../types/content";
import { XP_PER_PRACTICE_CORRECT } from "../../types/content";
import { useProgress } from "../../contexts/ProgressContext";
import { AppHeader } from "../layout/AppHeader";
import { SafeArea } from "../layout/SafeArea";

interface PracticeResultsProps {
  result: PracticeResult;
  /** Heading eyebrow, e.g. the lesson title or "Mixed review". */
  title: string;
  onRetry: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
  /** When set, shows a "Review the lesson" link to this lesson. */
  reviewLessonId?: string;
}

export function PracticeResults({
  result,
  title,
  onRetry,
  retryLabel = "Practice again",
  reviewLessonId,
}: PracticeResultsProps) {
  const { correct, total } = result;
  const allCorrect = total > 0 && correct === total;
  const passed = correct >= Math.ceil(total / 2);

  // XP for the questions cleared on the first try. Awarded once per results
  // screen (the ref guards against React's double-invoked effects in dev).
  const { addXp } = useProgress();
  const xpGained = correct * XP_PER_PRACTICE_CORRECT;
  const awardedRef = useRef(false);
  useEffect(() => {
    if (awardedRef.current || xpGained <= 0) return;
    awardedRef.current = true;
    void addXp(xpGained);
  }, [addXp, xpGained]);

  const emoji = allCorrect ? "🎉" : passed ? "👏" : "💪";
  const heading = allCorrect
    ? "Perfect score!"
    : passed
      ? "Nice work!"
      : "Keep practicing";
  const message = allCorrect
    ? "You answered every question correctly on the first try."
    : passed
      ? "You're getting the hang of this — one more pass will lock it in."
      : "Review the material, then give it another go.";

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full text-center">
        <p className="text-sm font-semibold text-indigo-600">{title}</p>
        <div className="text-6xl mt-3 mb-4" aria-hidden>
          {emoji}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-slate-500 mt-2">{message}</p>

        <div className="my-8">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            First-try score
          </p>
          <p className="text-5xl font-bold text-indigo-600 mt-1">
            {correct}
            <span className="text-2xl text-slate-400"> / {total}</span>
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1.5 text-sm font-semibold">
            <span aria-hidden>⚡</span>
            {xpGained > 0 ? `+${xpGained} XP earned` : "No XP this round"}
          </p>
        </div>

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={onRetry}
            className="block w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-[0.98] transition"
          >
            {retryLabel}
          </button>
          {reviewLessonId && (
            <Link
              to={`/lesson/${reviewLessonId}`}
              className="block w-full min-h-[48px] rounded-xl border border-slate-300 text-slate-700 font-semibold leading-[48px] hover:bg-slate-50"
            >
              Review the lesson
            </Link>
          )}
          <Link
            to="/lessons"
            className="block w-full min-h-[48px] text-slate-500 font-medium leading-[48px] hover:text-indigo-600"
          >
            Back to lessons
          </Link>
        </div>
      </main>
    </SafeArea>
  );
}
