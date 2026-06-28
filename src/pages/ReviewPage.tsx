import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTargetedReviewSession } from "../lib/reviewPlanner";
import { useProgress } from "../contexts/ProgressContext";
import type { Lesson, PracticeResult } from "../types/content";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useSessionExitGuard } from "../hooks/useSessionExitGuard";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function ReviewPage() {
  const { progress, profile } = useProgress();

  const [result, setResult] = useState<PracticeResult | null>(null);
  // Bumping this re-samples a new targeted set and remounts the player.
  const [attempt, setAttempt] = useState(0);

  // A fresh targeted draw for this attempt — weighted toward weak and stale
  // concepts (using mastery that now reflects past review), backfilled from the
  // wider pool when those can't fill it.
  const sessionSteps = useMemo(
    () => getTargetedReviewSession(progress, undefined, profile?.conceptStats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );

  // Synthetic lesson so the player can run the targeted set in practice mode
  // without touching any real lesson's saved progress.
  const reviewLesson: Lesson | undefined = useMemo(
    () =>
      sessionSteps.length > 0
        ? {
            id: "targeted-review",
            title: "Targeted Review",
            order: 0,
            estimatedMinutes: 0,
            conceptTags: [],
            published: true,
            steps: sessionSteps,
          }
        : undefined,
    [sessionSteps],
  );

  // Active while the player is on screen: a session exists and hasn't reached
  // its results screen. Warn before navigating away from an unfinished review.
  const sessionActive = !!reviewLesson && result === null;
  const exitGuard = useSessionExitGuard(sessionActive);

  if (!reviewLesson) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="p-4 text-center">
          <p className="text-slate-700">
            Start a lesson first — targeted review pulls from what you've learned.
          </p>
          <Link to="/lessons" className="text-indigo-600">
            Back to lessons
          </Link>
        </main>
      </SafeArea>
    );
  }

  if (result) {
    return (
      <PracticeResults
        result={result}
        title="Targeted review"
        retryLabel="New targeted set"
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
          key={`targeted-review-${attempt}`}
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
