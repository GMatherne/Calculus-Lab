import { Link, Navigate, useParams } from "react-router-dom";
import {
  getLevel,
  getLevelReviewSession,
  getLevelStatus,
} from "../lib/contentLoader";
import { useProgress } from "../contexts/ProgressContext";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { SessionRunner } from "../components/lesson/SessionRunner";
import { useQuizSession } from "../hooks/useQuizSession";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function LevelReviewPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const { progress, loading: progressLoading } = useProgress();
  const level = levelId ? getLevel(levelId) : undefined;

  const session = useQuizSession({
    ready:
      !!level &&
      !progressLoading &&
      getLevelStatus(level, progress) === "complete",
    lesson: {
      id: `${level?.id ?? "level"}-review`,
      title: `Review: ${level?.title ?? ""}`,
      order: level?.order ?? 0,
    },
    // A fresh cross-lesson draw from this level's lessons for the attempt.
    buildSteps: () => (levelId ? getLevelReviewSession(levelId) : []),
    resampleKey: [levelId],
  });

  if (!level || !session.lesson) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="p-4 text-center">
          <p className="text-slate-700">
            Finish this level's lessons first — its review pulls questions from
            across them.
          </p>
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
          <p className="text-slate-500 text-center py-12">Loading review…</p>
        </main>
      </SafeArea>
    );
  }

  // The review mixes questions from every lesson in the level, so it only opens
  // once the level is complete — including via a hand-edited URL. This mirrors
  // the roadmap, which surfaces the review link only for completed levels.
  if (getLevelStatus(level, progress) !== "complete") {
    return <Navigate to="/lessons" replace />;
  }

  if (session.result) {
    return (
      <PracticeResults
        result={session.result}
        title={`${level.title} review`}
        retryLabel="New review set"
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
      leaveTitle="Leave review?"
      cancelLabel="Keep reviewing"
    />
  );
}
