import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getLevel,
  getLevelReviewSession,
  getLevelStatus,
} from "../lib/contentLoader";
import type { Lesson, PracticeResult } from "../types/content";
import { useProgress } from "../contexts/ProgressContext";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useSessionExitGuard } from "../hooks/useSessionExitGuard";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function LevelReviewPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const { progress, loading: progressLoading } = useProgress();
  const level = levelId ? getLevel(levelId) : undefined;

  const [result, setResult] = useState<PracticeResult | null>(null);
  // Bumping this re-samples a new mixed set and remounts the player.
  const [attempt, setAttempt] = useState(0);

  // A fresh cross-lesson draw from this level's lessons for the attempt.
  const sessionSteps = useMemo(
    () => (levelId ? getLevelReviewSession(levelId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelId, attempt],
  );

  // Synthetic lesson so the player can run the mixed set in practice mode
  // without touching any real lesson's saved progress.
  const reviewLesson: Lesson | undefined = useMemo(
    () =>
      level && sessionSteps.length > 0
        ? {
            id: `${level.id}-review`,
            title: `Review: ${level.title}`,
            order: level.order,
            estimatedMinutes: 0,
            conceptTags: [],
            published: true,
            steps: sessionSteps,
          }
        : undefined,
    [level, sessionSteps],
  );

  // True only when the player is on screen — every guard below has passed and
  // the session hasn't reached its results screen. Warn before navigating away.
  const sessionActive =
    !!level &&
    !!reviewLesson &&
    !progressLoading &&
    getLevelStatus(level, progress) === "complete" &&
    result === null;
  const exitGuard = useSessionExitGuard(sessionActive);

  if (!level || !reviewLesson) {
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

  if (result) {
    return (
      <PracticeResults
        result={result}
        title={`${level.title} review`}
        retryLabel="New review set"
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
          key={`${level.id}-review-${attempt}`}
          lesson={reviewLesson}
          practiceMode
          onComplete={(r) =>
            setResult(r ?? { correct: 0, total: sessionSteps.length })
          }
        />
      </main>
      <ConfirmDialog
        open={exitGuard.open}
        title="Leave review?"
        message="You'll lose your progress in this session and won't earn any XP. Are you sure you want to leave?"
        confirmLabel="Leave"
        cancelLabel="Keep reviewing"
        onConfirm={exitGuard.confirmLeave}
        onCancel={exitGuard.cancelLeave}
      />
    </SafeArea>
  );
}
