import { Link, Navigate, useParams } from "react-router-dom";
import {
  canAccessLesson,
  getLesson,
  getPracticeSession,
  hasPractice,
} from "../lib/contentLoader";
import { useProgress } from "../contexts/ProgressContext";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { SessionRunner } from "../components/lesson/SessionRunner";
import { useQuizSession } from "../hooks/useQuizSession";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function PracticePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { progress, loading: progressLoading } = useProgress();

  const lesson = lessonId ? getLesson(lessonId) : undefined;

  const session = useQuizSession({
    ready:
      !!lessonId &&
      !!lesson &&
      hasPractice(lessonId) &&
      !progressLoading &&
      canAccessLesson(lessonId, progress),
    lesson: {
      id: lesson?.id ?? "practice",
      title: `Practice: ${lesson?.title ?? ""}`,
      order: lesson?.order ?? 0,
    },
    // A fresh random draw from the lesson's practice bank for this attempt.
    buildSteps: () => (lessonId ? getPracticeSession(lessonId) : []),
    resampleKey: [lessonId],
  });

  if (!lesson || !lessonId || !hasPractice(lessonId) || !session.lesson) {
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

  if (session.result) {
    return (
      <PracticeResults
        result={session.result}
        title={lesson.title}
        reviewLessonId={lesson.id}
        onRetry={session.retry}
      />
    );
  }

  return (
    <SessionRunner
      lesson={session.lesson}
      playerKey={session.playerKey}
      onComplete={session.complete}
      exitGuard={session.exitGuard}
      leaveTitle="Leave practice?"
      cancelLabel="Keep practicing"
    />
  );
}
