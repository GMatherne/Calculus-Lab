import { Link } from "react-router-dom";
import type { LessonMeta } from "../../types/content";
import {
  isLessonUnlocked,
  getLessonStepCount,
  getLessonProgressPercent,
  hasPractice,
} from "../../lib/contentLoader";

interface LessonCardProps {
  meta: LessonMeta;
  status: string;
  progress: Record<string, { status: string; currentStepIndex?: number }>;
  recommended?: boolean;
}

export function LessonCard({ meta, status, progress, recommended }: LessonCardProps) {
  const unlocked = isLessonUnlocked(meta.id, progress);
  const isDone = status === "complete" || status === "mastered";
  const inProgress = status === "in_progress";
  const totalSteps = getLessonStepCount(meta.id);
  const percent = getLessonProgressPercent(meta.id, progress);
  const stepsDone = isDone
    ? totalSteps
    : Math.min(progress[meta.id]?.currentStepIndex ?? 0, totalSteps);
  const showProgress = unlocked && (isDone || inProgress);

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        recommended
          ? "border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/50"
          : "border-slate-200 bg-white"
      } ${!unlocked ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Lesson {meta.order}
          </p>
          <h3 className="font-semibold text-lg text-slate-900">{meta.title}</h3>
          <p className="text-sm text-slate-500 mt-1">~{meta.estimatedMinutes} min</p>
        </div>
        <span className="text-2xl" aria-hidden>
          {isDone ? "✅" : status === "in_progress" ? "📖" : unlocked ? "○" : "🔒"}
        </span>
      </div>

      {showProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span className={isDone ? "text-emerald-700" : "text-slate-500"}>
              {isDone
                ? "Completed"
                : `${stepsDone} of ${totalSteps} steps`}
            </span>
            <span className={isDone ? "text-emerald-700" : "text-slate-500"}>
              {percent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isDone ? "bg-emerald-500" : "bg-indigo-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {recommended && (
        <p className="text-sm text-indigo-600 font-medium mt-2">Recommended next</p>
      )}

      <div className="mt-4">
        {!unlocked ? (
          <span className="block w-full min-h-[44px] rounded-xl bg-slate-100 text-slate-400 text-center leading-[44px] text-sm">
            Complete previous lesson to unlock
          </span>
        ) : isDone && hasPractice(meta.id) ? (
          <div className="flex gap-2">
            <Link
              to={`/lesson/${meta.id}/practice`}
              className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 text-white text-center leading-[44px] font-medium hover:bg-indigo-700"
            >
              Practice
            </Link>
            <Link
              to={`/lesson/${meta.id}`}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-slate-700 text-center leading-[44px] font-medium hover:bg-slate-50"
            >
              Review
            </Link>
          </div>
        ) : (
          <Link
            to={`/lesson/${meta.id}`}
            className="block w-full min-h-[44px] rounded-xl bg-indigo-600 text-white text-center leading-[44px] font-medium hover:bg-indigo-700"
          >
            {isDone ? "Review" : status === "in_progress" ? "Continue" : "Start"}
          </Link>
        )}
      </div>
    </div>
  );
}
