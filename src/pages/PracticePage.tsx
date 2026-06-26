import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  canAccessLesson,
  getLesson,
  getPracticeSession,
  hasPractice,
} from "../lib/contentLoader";
import type { Lesson, PracticeResult } from "../types/content";
import { useProgress } from "../contexts/ProgressContext";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useSessionExitGuard } from "../hooks/useSessionExitGuard";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function PracticePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { progress, loading: progressLoading } = useProgress();

  const lesson = lessonId ? getLesson(lessonId) : undefined;

  const [result, setResult] = useState<PracticeResult | null>(null);
  // Bumping this remounts the player AND re-samples the bank, so each attempt
  // starts fresh with a (potentially) different set of questions.
  const [attempt, setAttempt] = useState(0);

  // A fresh random draw from the lesson's practice bank for this attempt.
  const sessionSteps = useMemo(
    () => (lessonId ? getPracticeSession(lessonId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessonId, attempt],
  );

  // A lightweight lesson whose steps are the sampled questions, so we can reuse
  // the existing player and grader without touching real lesson progress.
  const practiceLesson: Lesson | undefined = useMemo(
    () =>
      lesson && sessionSteps.length > 0
        ? { ...lesson, title: `Practice: ${lesson.title}`, steps: sessionSteps }
        : undefined,
    [lesson, sessionSteps],
  );

  // True only when the player itself is on screen — i.e. every guard below has
  // passed and the session hasn't reached its results screen yet. Warn before
  // an in-app navigation or tab close abandons that unfinished session.
  const sessionActive =
    !!lessonId &&
    !!lesson &&
    hasPractice(lessonId) &&
    !!practiceLesson &&
    !progressLoading &&
    canAccessLesson(lessonId, progress) &&
    result === null;
  const exitGuard = useSessionExitGuard(sessionActive);

  if (!lesson || !lessonId || !hasPractice(lessonId) || !practiceLesson) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="p-4 text-center">
          <p className="text-slate-700">No practice is available for this lesson.</p>
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
          <p className="text-slate-500 text-center py-12">Loading practice…</p>
        </main>
      </SafeArea>
    );
  }

  // Practice draws from a lesson's question bank, so a locked lesson must not be
  // practiceable via a hand-edited URL either.
  if (!canAccessLesson(lessonId, progress)) {
    return <Navigate to="/lessons" replace />;
  }

  if (result) {
    return (
      <PracticeResults
        result={result}
        title={lesson.title}
        reviewLessonId={lesson.id}
        onRetry={() => {
          setResult(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col px-4 py-4 max-w-3xl mx-auto w-full min-h-0">
        <LessonPlayer
          key={`${lesson.id}-practice-${attempt}`}
          lesson={practiceLesson}
          practiceMode
          onComplete={(r) =>
            setResult(r ?? { correct: 0, total: sessionSteps.length })
          }
        />
      </main>
      <ConfirmDialog
        open={exitGuard.open}
        title="Leave practice?"
        message="You'll lose your progress in this session and won't earn any XP. Are you sure you want to leave?"
        confirmLabel="Leave"
        cancelLabel="Keep practicing"
        onConfirm={exitGuard.confirmLeave}
        onCancel={exitGuard.cancelLeave}
      />
    </SafeArea>
  );
}
