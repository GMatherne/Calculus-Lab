import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  canTestOutLevel,
  getLevel,
  getLevelStatus,
  getLevelTestOutSession,
} from "../lib/contentLoader";
import type { Lesson, PracticeResult } from "../types/content";
import { TEST_OUT_PASS_RATIO } from "../types/content";
import { useProgress } from "../contexts/ProgressContext";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { TestOutResults } from "../components/lesson/TestOutResults";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useSessionExitGuard } from "../hooks/useSessionExitGuard";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { Icon } from "../components/common/Icon";

export function TestOutPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const { progress, loading: progressLoading } = useProgress();
  const level = levelId ? getLevel(levelId) : undefined;

  const [result, setResult] = useState<PracticeResult | null>(null);
  const [started, setStarted] = useState(false);
  // Bumping this re-samples a fresh coverage set and remounts the player.
  const [attempt, setAttempt] = useState(0);

  const sessionSteps = useMemo(
    () => (levelId ? getLevelTestOutSession(levelId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelId, attempt],
  );

  const title = level?.title ?? "";

  // Every lesson in the level is marked complete on a pass; the "Start the
  // level" fallback on a fail points at its first lesson.
  const lessonIds = useMemo(() => level?.lessons.map((l) => l.id) ?? [], [level]);
  const learnHref = `/lesson/${level?.lessons[0]?.id ?? ""}`;

  const eligible = !!levelId && canTestOutLevel(levelId);

  // Nothing to skip once the whole level is already finished.
  const alreadyComplete =
    !!level && getLevelStatus(level, progress) === "complete";

  // Synthetic lesson so the player runs the coverage set in practice mode
  // without touching any real lesson's saved progress (the same trick the
  // review pages use).
  const testLesson: Lesson | undefined = useMemo(
    () =>
      sessionSteps.length > 0
        ? {
            id: `${levelId}-test-out`,
            title: `Skip ahead: ${title}`,
            order: 0,
            estimatedMinutes: 0,
            conceptTags: [],
            published: true,
            steps: sessionSteps,
          }
        : undefined,
    [sessionSteps, levelId, title],
  );

  // Active only while the player is on screen — the learner has started and the
  // session hasn't reached its results. Warn before abandoning it.
  const sessionActive = started && !!testLesson && result === null;
  const exitGuard = useSessionExitGuard(sessionActive);

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
  if (result) {
    return (
      <TestOutResults
        result={result}
        title={title}
        lessonIds={lessonIds}
        learnHref={learnHref}
        onRetry={() => {
          setResult(null);
          setStarted(true);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }

  // Already complete, or not enough questions to certify: nothing to do here.
  if (alreadyComplete || !eligible || !testLesson) {
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
            Answer {sessionSteps.length}{" "}
            {sessionSteps.length === 1 ? "question" : "questions"} covering this
            level's lessons. Score {passPercent}% or higher on your first try and
            we'll mark every lesson in it complete and unlock the next level — no
            walkthrough needed.
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
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col px-4 py-4 max-w-3xl mx-auto w-full min-h-0">
        <LessonPlayer
          key={`${testLesson.id}-${attempt}`}
          lesson={testLesson}
          practiceMode
          onComplete={(r) =>
            setResult(r ?? { correct: 0, total: sessionSteps.length })
          }
        />
      </main>
      <ConfirmDialog
        open={exitGuard.open}
        title="Leave these questions?"
        message="You'll lose your progress in this attempt. Are you sure you want to leave?"
        confirmLabel="Leave"
        cancelLabel="Keep going"
        onConfirm={exitGuard.confirmLeave}
        onCancel={exitGuard.cancelLeave}
      />
    </SafeArea>
  );
}
