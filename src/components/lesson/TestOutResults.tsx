import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PracticeResult } from "../../types/content";
import { TEST_OUT_PASS_RATIO } from "../../lib/constants";
import { useProgress } from "../../contexts/ProgressContext";
import { conceptLabel } from "../../lib/masteryService";
import { useCountUp } from "../../hooks/useCountUp";
import { playSound } from "../../lib/sound";
import { AppHeader } from "../layout/AppHeader";
import { SafeArea } from "../layout/SafeArea";
import { Sparkles } from "../habit/Sparkles";
import { Icon } from "../common/Icon";

interface TestOutResultsProps {
  result: PracticeResult;
  /** Eyebrow text — the title of the level being skipped. */
  title: string;
  /** Lessons to mark complete when the learner passes. */
  lessonIds: string[];
  /** Where the "Start the level" link points on a failed attempt. */
  learnHref: string;
  /** Re-sample a fresh set and retake. */
  onRetry: () => void;
}

export function TestOutResults({
  result,
  title,
  lessonIds,
  learnHref,
  onRetry,
}: TestOutResultsProps) {
  const { correct, total, conceptResults } = result;
  const ratio = total > 0 ? correct / total : 0;
  const passed = total > 0 && ratio >= TEST_OUT_PASS_RATIO;
  const passPercent = Math.round(TEST_OUT_PASS_RATIO * 100);
  const scopeNoun = "this whole level";

  // On a pass, mark the covered lesson(s) complete exactly once — the ref guards
  // against React's double-invoked effects in dev, mirroring PracticeResults.
  // The returned XP (first-time lesson XP for any not-yet-finished lesson) drives
  // the celebratory count-up.
  const { completeLessonsTestedOut } = useProgress();
  const recordedRef = useRef(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  useEffect(() => {
    if (!passed || recordedRef.current || total <= 0) return;
    recordedRef.current = true;
    void completeLessonsTestedOut(lessonIds, conceptResults).then(setXpAwarded);
  }, [passed, total, lessonIds, conceptResults, completeLessonsTestedOut]);

  // Sound the outcome once on mount; a passing skip also banks XP, whose coin is
  // layered on by the SoundProvider when the total updates.
  const soundedRef = useRef(false);
  useEffect(() => {
    if (soundedRef.current || total <= 0) return;
    soundedRef.current = true;
    playSound(passed ? "pass" : "fail");
  }, [passed, total]);

  const animatedXp = useCountUp(xpAwarded ?? 0, { initial: 0 });

  // Concepts answered wrong at least once this attempt, for the "brush up on"
  // list shown when the learner falls short.
  const missed = Object.entries(conceptResults ?? {})
    .filter(([, r]) => r.seen > r.firstTryCorrect)
    .map(([concept]) => conceptLabel(concept));

  if (passed) {
    const gainedXp = (xpAwarded ?? 0) > 0;
    return (
      <SafeArea>
        <AppHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full text-center">
          <p className="text-sm font-semibold text-indigo-600">
            Skip ahead: {title}
          </p>
          <div className="mt-3 mb-4 flex justify-center xp-bounce-in">
            <Icon name="graduationCap" className="h-16 w-16 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Skipped ahead!</h1>
          <p className="text-slate-500 mt-2">
            You proved you know {scopeNoun} — we've marked it complete and
            unlocked what's next.
          </p>

          <div className="my-8">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              First-try score
            </p>
            <p className="text-5xl font-bold text-emerald-600 mt-1">
              {correct}
              <span className="text-2xl text-slate-400"> / {total}</span>
            </p>
            <span className="relative mt-4 inline-flex">
              <span
                className={`xp-bounce-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  gainedXp
                    ? "bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-900 shadow-sm ring-1 ring-amber-300/60"
                    : "bg-emerald-100 text-emerald-700"
                }`}
                aria-label={
                  gainedXp ? `Plus ${xpAwarded} XP earned` : "Progress unlocked"
                }
              >
                <Icon
                  name={gainedXp ? "zap" : "check"}
                  fill={gainedXp ? "currentColor" : "none"}
                  className={`h-4 w-4 ${
                    gainedXp ? "xp-bolt-wiggle text-amber-600" : "text-emerald-600"
                  }`}
                />
                <span aria-hidden>
                  {gainedXp ? `+${animatedXp} XP earned` : "Unlocked"}
                </span>
              </span>
              {gainedXp && <Sparkles trigger={1} />}
            </span>
          </div>

          <Link
            to="/lessons"
            className="block w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold leading-[48px] hover:bg-indigo-700 active:scale-[0.98] transition"
          >
            Back to lessons
          </Link>
        </main>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full text-center">
        <p className="text-sm font-semibold text-indigo-600">
          Skip ahead: {title}
        </p>
        <div className="mt-3 mb-4 flex justify-center xp-bounce-in">
          <Icon name="dumbbell" className="h-16 w-16 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Not quite yet</h1>
        <p className="text-slate-500 mt-2">
          You need {passPercent}% on the first try to skip {scopeNoun}.{" "}
          {missed.length > 0
            ? "Brush up on these, then try again:"
            : "Work through it, then give it another go."}
        </p>

        {missed.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {missed.map((label) => (
              <li
                key={label}
                className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700 ring-1 ring-rose-200"
              >
                {label}
              </li>
            ))}
          </ul>
        )}

        <div className="my-8">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            First-try score
          </p>
          <p className="text-5xl font-bold text-indigo-600 mt-1">
            {correct}
            <span className="text-2xl text-slate-400"> / {total}</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">Needed {passPercent}%</p>
        </div>

        <div className="w-full space-y-3">
          <Link
            to={learnHref}
            className="block w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold leading-[48px] hover:bg-indigo-700 active:scale-[0.98] transition"
          >
            Start the level
          </Link>
          <button
            type="button"
            onClick={onRetry}
            className="block w-full min-h-[48px] rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 active:scale-[0.98] transition"
          >
            Try again
          </button>
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
