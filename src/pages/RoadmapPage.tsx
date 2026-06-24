import { Link } from "react-router-dom";
import {
  course,
  getContinueLessonId,
  getCompletionPercent,
  getLevels,
  getLevelStatus,
  getLevelCompletion,
  canReview,
} from "../lib/contentLoader";
import { useProgress } from "../contexts/ProgressContext";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { StreakBadge } from "../components/habit/StreakBadge";
import { LevelSection } from "../components/roadmap/LevelSection";
import { DevTools } from "../components/dev/DevTools";
import { MILESTONE_DEFS } from "../types/content";

export function RoadmapPage() {
  const { progress, loading, profile } = useProgress();
  const levels = getLevels();
  const continueId = getContinueLessonId(progress);
  const percent = getCompletionPercent(progress);

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-8">
        <DevTools />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{course.description}</p>
          </div>
          <StreakBadge />
        </div>

        <div className="rounded-2xl bg-indigo-600 text-white p-5 mb-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-indigo-200 text-sm">Course progress</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              <span aria-hidden>⚡</span>
              {(profile?.xp ?? 0).toLocaleString()} XP
            </span>
          </div>
          <p className="text-3xl font-bold mt-1">{percent}%</p>
          <div className="mt-3 h-2 rounded-full bg-indigo-400/50 overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          {continueId && (
            <Link
              to={`/lesson/${continueId}`}
              className="mt-4 block w-full min-h-[44px] rounded-xl bg-white text-indigo-700 font-semibold text-center leading-[44px]"
            >
              Continue learning →
            </Link>
          )}
        </div>

        {!loading && canReview(progress) && (
          <Link
            to="/review"
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-white p-4 hover:border-indigo-400 hover:bg-indigo-50/50 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl"
                aria-hidden
              >
                🔀
              </span>
              <div>
                <p className="font-semibold text-slate-900">Mixed review</p>
                <p className="text-sm text-slate-500">
                  Random questions from lessons you've learned
                </p>
              </div>
            </div>
            <span className="text-indigo-600 font-semibold" aria-hidden>
              →
            </span>
          </Link>
        )}

        {profile && profile.milestones.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {profile.milestones.map((id) => (
              <span
                key={id}
                className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold"
                title={MILESTONE_DEFS[id]?.description}
              >
                🏆 {MILESTONE_DEFS[id]?.title ?? id}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading progress…</p>
        ) : (
          <div className="space-y-8">
            {levels.map((level, i) => (
              <LevelSection
                key={level.id}
                level={level}
                status={getLevelStatus(level, progress)}
                completion={getLevelCompletion(level, progress)}
                progress={progress}
                continueId={continueId}
                isLast={i === levels.length - 1}
              />
            ))}
          </div>
        )}
      </main>
    </SafeArea>
  );
}
