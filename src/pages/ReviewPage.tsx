import { Link } from "react-router-dom";
import { getTargetedReviewSession } from "../lib/reviewPlanner";
import { useProgress } from "../contexts/ProgressContext";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { SessionRunner } from "../components/lesson/SessionRunner";
import { useQuizSession } from "../hooks/useQuizSession";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function ReviewPage() {
  const { progress, profile } = useProgress();

  const session = useQuizSession({
    ready: true,
    lesson: { id: "targeted-review", title: "Targeted Review", order: 0 },
    // A fresh targeted draw for this attempt — weighted toward weak and stale
    // concepts (using mastery that now reflects past review), backfilled from the
    // wider pool when those can't fill it.
    buildSteps: () =>
      getTargetedReviewSession(progress, undefined, profile?.conceptStats),
  });

  if (!session.lesson) {
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

  if (session.result) {
    return (
      <PracticeResults
        result={session.result}
        title="Targeted review"
        retryLabel="New targeted set"
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
