import { useEffect, useRef } from "react";
import { AppHeader } from "../layout/AppHeader";
import { SafeArea } from "../layout/SafeArea";
import { Sparkles } from "../habit/Sparkles";
import { Icon } from "../common/Icon";
import { useCountUp } from "../../hooks/useCountUp";
import { playSound } from "../../lib/sound";

interface LessonCompleteProps {
  lessonTitle: string;
  /** XP earned for finishing this lesson. */
  xpGained: number;
  /** New running XP total, shown for context when available. */
  totalXp?: number;
  onContinue: () => void;
}

/**
 * Shown once after a lesson is finished for the first time, celebrating the XP
 * just earned. Reviewing an already-completed lesson earns no XP, so this screen
 * is intentionally skipped in that case.
 */
export function LessonComplete({
  lessonTitle,
  xpGained,
  totalXp,
  onContinue,
}: LessonCompleteProps) {
  const animatedGain = useCountUp(xpGained, { initial: 0 });
  const animatedTotal = useCountUp(totalXp ?? 0, { initial: 0 });

  // Play the finished-lesson fanfare once when this screen appears. The ref
  // guards against React's double-invoked effects in dev.
  const soundedRef = useRef(false);
  useEffect(() => {
    if (soundedRef.current) return;
    soundedRef.current = true;
    playSound("complete");
  }, []);

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-indigo-600">{lessonTitle}</p>
          <div className="mt-3 mb-4 flex justify-center xp-bounce-in">
            <Icon name="celebrate" className="h-16 w-16 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lesson complete!</h1>
          <p className="text-slate-500 mt-2">
            Great work — here's the XP you just earned.
          </p>

          <div className="relative my-8">
            <div
              className="xp-bounce-in flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-200 text-amber-900 px-10 py-6 shadow-md"
              aria-label={`${xpGained} XP earned`}
            >
              <span
                className="flex items-center gap-2 text-5xl font-bold"
                aria-hidden
              >
                <Icon
                  name="zap"
                  className="xp-bolt-wiggle h-12 w-12 text-amber-900"
                  fill="currentColor"
                />
                +{animatedGain}
              </span>
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                aria-hidden
              >
                XP earned
              </span>
            </div>
            <Sparkles trigger={1} />
          </div>

          {typeof totalXp === "number" && (
            <p className="text-sm text-slate-500">
              Total XP:{" "}
              <span className="font-semibold text-slate-700">
                {animatedTotal.toLocaleString()}
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-[0.98] transition"
        >
          Continue
        </button>
      </main>
    </SafeArea>
  );
}
