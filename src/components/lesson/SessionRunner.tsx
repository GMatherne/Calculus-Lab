import type { Lesson, PracticeResult } from "../../types/content";
import type { SessionExitGuard } from "../../hooks/useSessionExitGuard";
import { LessonPlayer } from "./LessonPlayer";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { AppHeader } from "../layout/AppHeader";
import { SafeArea } from "../layout/SafeArea";

const DEFAULT_LEAVE_MESSAGE =
  "You'll lose your progress in this session and won't earn any XP. Are you sure you want to leave?";

interface SessionRunnerProps {
  /** The synthetic lesson to play (already confirmed non-empty by the page). */
  lesson: Lesson;
  /** Remount key so a new attempt restarts the player. */
  playerKey: string;
  onComplete: (result?: PracticeResult) => void;
  exitGuard: SessionExitGuard;
  /** Copy for the "leave the session?" confirmation. */
  leaveTitle: string;
  leaveMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * The on-screen shell shared by every quiz-style page: the app chrome, the
 * {@link LessonPlayer} running the session in practice mode, and the
 * exit-confirmation dialog wired to the page's {@link SessionExitGuard}.
 */
export function SessionRunner({
  lesson,
  playerKey,
  onComplete,
  exitGuard,
  leaveTitle,
  leaveMessage = DEFAULT_LEAVE_MESSAGE,
  confirmLabel = "Leave",
  cancelLabel = "Keep going",
}: SessionRunnerProps) {
  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 flex flex-col px-4 py-4 max-w-3xl mx-auto w-full min-h-0">
        <LessonPlayer
          key={playerKey}
          lesson={lesson}
          practiceMode
          onComplete={onComplete}
        />
      </main>
      <ConfirmDialog
        open={exitGuard.open}
        title={leaveTitle}
        message={leaveMessage}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={exitGuard.confirmLeave}
        onCancel={exitGuard.cancelLeave}
      />
    </SafeArea>
  );
}
