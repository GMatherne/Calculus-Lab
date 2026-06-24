import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getLesson } from "../lib/contentLoader";
import { useAuth } from "../contexts/AuthContext";
import { useProgress, isLessonDone } from "../contexts/ProgressContext";
import { LessonPlayer } from "../components/lesson/LessonPlayer";
import { LessonComplete } from "../components/lesson/LessonComplete";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();
  const {
    progress,
    profile,
    completeLesson,
    loading: progressLoading,
  } = useProgress();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  // XP earned on this finish; non-null drives the celebration screen.
  const [xpGained, setXpGained] = useState<number | null>(null);

  const lesson = lessonId ? getLesson(lessonId) : undefined;
  const lessonProgress = lessonId ? progress[lessonId] : undefined;
  const lastStepIndex = lesson ? lesson.steps.length - 1 : 0;
  const initialStep = isLessonDone(lessonProgress?.status)
    ? 0
    : Math.min(lessonProgress?.currentStepIndex ?? 0, lastStepIndex);

  useEffect(() => {
    if (!progressLoading && user) setReady(true);
  }, [progressLoading, user]);

  if (!lesson) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="p-4 text-center">
          <p>Lesson not found.</p>
          <Link to="/lessons" className="text-indigo-600">
            Back to lessons
          </Link>
        </main>
      </SafeArea>
    );
  }

  // First-time completion earns XP and shows the reward screen; replaying or
  // reviewing a finished lesson earns nothing and returns straight to lessons.
  if (xpGained !== null) {
    return (
      <LessonComplete
        lessonTitle={lesson.title}
        xpGained={xpGained}
        totalXp={profile?.xp}
        onContinue={() => navigate("/lessons")}
      />
    );
  }

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col px-4 py-4 max-w-3xl mx-auto w-full min-h-0">
        {!ready ? (
          <p className="text-slate-500 text-center py-12">Loading lesson…</p>
        ) : (
          <LessonPlayer
            key={lesson.id}
            lesson={lesson}
            initialStepIndex={initialStep}
            onComplete={() => {
              void completeLesson(lesson.id).then((gained) => {
                if (gained > 0) setXpGained(gained);
                else navigate("/lessons");
              });
            }}
          />
        )}
      </main>
    </SafeArea>
  );
}
