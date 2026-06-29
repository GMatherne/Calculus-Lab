import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  canTestOutLevel,
  getContinueLessonId,
  getLevel,
  getLevelStatus,
  getLevelTestOutLessonIds,
  getTestOutSessionForLessons,
} from "../lib/contentLoader";
import { TEST_OUT_PASS_RATIO } from "../lib/constants";
import { useProgress } from "../contexts/ProgressContext";
import { TestOutResults } from "../components/lesson/TestOutResults";
import { SessionRunner } from "../components/lesson/SessionRunner";
import { useQuizSession } from "../hooks/useQuizSession";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { Icon } from "../components/common/Icon";

export function TestOutPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const { progress, loading: progressLoading } = useProgress();
  const level = levelId ? getLevel(levelId) : undefined;

  // The intro must be dismissed before the player runs; gates the exit guard too.
  const [started, setStarted] = useState(false);

  const title = level?.title ?? "";

  // The lessons this skip would bypass: everything up to and including the level
  // that isn't already finished. The questions are drawn from exactly these, and
  // exactly these are marked complete on a pass — finished lessons are never
  // re-tested. Recomputed when progress loads (it starts empty) so we don't quiz
  // the learner on lessons they've already done. A failed attempt sends them to
  // where they should actually resume.
  const lessonIds = useMemo(
    () => (levelId ? getLevelTestOutLessonIds(levelId, progress) : []),
    [levelId, progress],
  );
  const learnHref = `/lesson/${getContinueLessonId(progress) ?? level?.lessons[0]?.id ?? ""}`;

  const eligible = !!levelId && canTestOutLevel(levelId, progress);

  // Nothing to skip once the whole level is already finished.
  const alreadyComplete =
    !!level && getLevelStatus(level, progress) === "complete";

  const session = useQuizSession({
    ready: started,
    lesson: {
      id: `${levelId ?? "level"}-test-out`,
      title: `Skip ahead: ${title}`,
      order: 0,
    },
    buildSteps: () => getTestOutSessionForLessons(lessonIds),
    resampleKey: [lessonIds],
  });

  if (!level) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="p-4 text-center">
          <p className="text-slate-700">That level doesn't exist.</p>
          <Link to="/lessons" className="text-indigo-600">
            Back to lessons
          </Link>
        </main>
      </SafeArea>
    );
  }

  if (progressLoading) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="flex-1 flex flex-col px-4 py-4 max-w-3xl mx-auto w-full min-h-0">
          <p className="text-slate-500 text-center py-12">Loading…</p>
        </main>
      </SafeArea>
    );
  }

  // The results screen is checked before the redirect below, so passing (which
  // marks the level's lessons complete and flips `alreadyComplete`) still lands
  // on the celebration screen instead of bouncing to the roadmap.
  if (session.result) {
    return (
      <TestOutResults
        result={session.result}
        title={title}
        lessonIds={lessonIds}
        learnHref={learnHref}
        onRetry={session.retry}
      />
    );
  }

  // Already complete, or not enough questions to certify: nothing to do here.
  if (alreadyComplete || !eligible || !session.lesson) {
    return <Navigate to="/lessons" replace />;
  }

  if (!started) {
    const passPercent = Math.round(TEST_OUT_PASS_RATIO * 100);
    return (
      <SafeArea>
        <AppHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto w-full text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
              <Icon name="graduationCap" className="h-8 w-8 text-indigo-600" />
            </span>
          </div>
          <p className="text-sm font-semibold text-indigo-600">Skip ahead</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-3 text-slate-500">
            Answer {session.steps.length}{" "}
            {session.steps.length === 1 ? "question" : "questions"} drawn from the
            lessons you haven't finished yet, up to and including this level. Score{" "}
            {passPercent}% or higher on your first try and we'll mark them complete
            and unlock what's next — no walkthrough needed.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Miss too many and nothing changes — you can take the lessons as
            usual.
          </p>

          <div className="mt-8 w-full space-y-3">
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="block w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-[0.98] transition"
            >
              Start questions
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

  return (
    <SessionRunner
      lesson={session.lesson}
      playerKey={session.playerKey}
      onComplete={session.complete}
      exitGuard={session.exitGuard}
      leaveTitle="Leave these questions?"
      leaveMessage="You'll lose your progress in this attempt. Are you sure you want to leave?"
    />
  );
}
