import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { PracticeResult } from "../../types/content";
import { XP_PER_PRACTICE_CORRECT } from "../../lib/constants";
import { useProgress } from "../../contexts/ProgressContext";
import { useCountUp } from "../../hooks/useCountUp";
import { playSound } from "../../lib/sound";
import { AppHeader } from "../layout/AppHeader";
import { SafeArea } from "../layout/SafeArea";
import { Sparkles } from "../habit/Sparkles";
import { Icon, type IconName } from "../common/Icon";

interface PracticeResultsProps {
  result: PracticeResult;
  /** Heading eyebrow, e.g. the lesson title or "Mixed review". */
  title: string;
  onRetry: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
  /** When set, shows a "Review the lesson" link to this lesson. */
  reviewLessonId?: string;
  /** When set, shows a secondary outline button (e.g. "Change topics"). */
  secondaryAction?: { label: string; onClick: () => void };
}

export function PracticeResults({
  result,
  title,
  onRetry,
  retryLabel = "Practice again",
  reviewLessonId,
  secondaryAction,
}: PracticeResultsProps) {
  const { correct, total, bonusXp = 0, conceptResults } = result;
  const allCorrect = total > 0 && correct === total;
  const passed = correct >= Math.ceil(total / 2);

  // Bank XP and count progress toward the practice-question achievements for
  // questions cleared on the first try only. Recorded once per results screen
  // (the ref guards against React's double-invoked effects in dev); the session
  // itself still registers as activity even on a zero-first-try round. Multi-part
  // questions cleared first-try add a flat bonus on top of the per-correct base.
  const { addXp } = useProgress();
  const xpGained = correct * XP_PER_PRACTICE_CORRECT + bonusXp;
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current || total <= 0) return;
    recordedRef.current = true;
    void addXp(xpGained, correct, conceptResults);
  }, [addXp, xpGained, correct, total, conceptResults]);

  // Sound the result once on mount, scaled to how it went (the earned-XP coin is
  // layered on separately by the SoundProvider as the total ticks up).
  const soundedRef = useRef(false);
  useEffect(() => {
    if (soundedRef.current || total <= 0) return;
    soundedRef.current = true;
    playSound(allCorrect ? "perfect" : passed ? "pass" : "fail");
  }, [allCorrect, passed, total]);

  const animatedGain = useCountUp(xpGained, { initial: 0 });

  const resultIcon: IconName = allCorrect
    ? "celebrate"
    : passed
      ? "thumbsUp"
      : "dumbbell";
  const resultIconColor = allCorrect
    ? "text-amber-500"
    : passed
      ? "text-indigo-500"
      : "text-indigo-400";
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
        <div className="mt-3 mb-4 flex justify-center xp-bounce-in">
          <Icon name={resultIcon} className={`h-16 w-16 ${resultIconColor}`} />
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
          <span className="relative mt-4 inline-flex">
            <span
              className={`xp-bounce-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                xpGained > 0
                  ? "bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-900 shadow-sm ring-1 ring-amber-300/60"
                  : "bg-slate-100 text-slate-500"
              }`}
              aria-label={
                xpGained > 0 ? `Plus ${xpGained} XP earned` : "No XP this round"
              }
            >
              <Icon
                name="zap"
                fill="currentColor"
                className={`h-4 w-4 ${
                  xpGained > 0
                    ? "xp-bolt-wiggle text-amber-600"
                    : "text-slate-400"
                }`}
              />
              <span aria-hidden>
                {xpGained > 0
                  ? `+${animatedGain} XP earned`
                  : "No XP this round"}
              </span>
            </span>
            {xpGained > 0 && <Sparkles trigger={1} />}
          </span>
        </div>

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={onRetry}
            className="block w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-[0.98] transition"
          >
            {retryLabel}
          </button>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="block w-full min-h-[48px] rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 active:scale-[0.98] transition"
            >
              {secondaryAction.label}
            </button>
          )}
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
