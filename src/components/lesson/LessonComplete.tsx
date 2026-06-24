import { AppHeader } from "../layout/AppHeader";
import { SafeArea } from "../layout/SafeArea";

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
  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-indigo-600">{lessonTitle}</p>
          <div className="text-6xl mt-3 mb-4" aria-hidden>
            🎉
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lesson complete!</h1>
          <p className="text-slate-500 mt-2">
            Great work — here's the XP you just earned.
          </p>

          <div className="my-8 flex flex-col items-center gap-1 rounded-2xl bg-amber-100 text-amber-800 px-10 py-6">
            <span className="flex items-center gap-2 text-5xl font-bold">
              <span aria-hidden>⚡</span>+{xpGained}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide">
              XP earned
            </span>
          </div>

          {typeof totalXp === "number" && (
            <p className="text-sm text-slate-500">
              Total XP:{" "}
              <span className="font-semibold text-slate-700">
                {totalXp.toLocaleString()}
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
