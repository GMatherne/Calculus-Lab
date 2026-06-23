import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getReviewSession } from "../lib/contentLoader";
import { useProgress } from "../contexts/ProgressContext";
import type { Lesson, PracticeResult } from "../types/content";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function ReviewPage() {
  const { progress } = useProgress();

  const [result, setResult] = useState<PracticeResult | null>(null);
  // Bumping this re-samples a new mixed set and remounts the player.
  const [attempt, setAttempt] = useState(0);

  // A fresh cross-lesson draw for this attempt.
  const sessionSteps = useMemo(
    () => getReviewSession(progress),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );

  // Synthetic lesson so the player can run the mixed set in practice mode
  // without touching any real lesson's saved progress.
  const reviewLesson: Lesson | undefined = useMemo(
    () =>
      sessionSteps.length > 0
        ? {
            id: "mixed-review",
            title: "Mixed Review",
            order: 0,
            estimatedMinutes: 0,
            conceptTags: [],
            published: true,
            steps: sessionSteps,
          }
        : undefined,
    [sessionSteps],
  );

  if (!reviewLesson) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="p-4 text-center">
          <p className="text-slate-700">
            Start a lesson first — mixed review pulls from what you've learned.
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
        title="Mixed review"
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
          key={`mixed-review-${attempt}`}
          lesson={reviewLesson}
          practiceMode
          onComplete={(r) =>
            setResult(r ?? { correct: 0, total: sessionSteps.length })
          }
        />
      </main>
    </SafeArea>
  );
}
