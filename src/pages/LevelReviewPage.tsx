import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLevel, getLevelReviewSession } from "../lib/contentLoader";
import type { Lesson, PracticeResult } from "../types/content";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function LevelReviewPage() {
  const { levelId } = useParams<{ levelId: string }>();
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
    </SafeArea>
  );
}
