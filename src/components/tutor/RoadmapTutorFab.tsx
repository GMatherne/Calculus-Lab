import { useCallback, useMemo, useRef, useState } from "react";
import {
  createGeneralTutorChat,
  isAiAvailable,
  isQuotaError,
  type GeneralContext,
  type TutorChat,
} from "../../lib/aiTutor";
import {
  getCompletionPercent,
  getLevels,
  getLevelStatus,
} from "../../lib/contentLoader";
import { getWeakConcepts } from "../../lib/masteryService";
import { useProgress } from "../../contexts/ProgressContext";
import { Icon } from "../common/Icon";
import { TutorChatModal, type ChatTurn } from "./TutorChatModal";

/** Shown when the per-user tutor rate limit (or an upstream provider limit) is hit. */
const QUOTA_MESSAGE =
  "You've reached the AI tutor limit for now — it resets within a day. Your lessons and instant grading keep working in the meantime.";

/**
 * Floating "chat with the AI tutor" button for the roadmap. Opens a free-form
 * {@link TutorChatModal} the learner can ask anything calculus-related. Owns the
 * conversation (so it survives closing/reopening on the roadmap) and assembles
 * the light, PII-free learner context that personalizes the tutor's suggestions.
 *
 * Renders nothing when the AI backend isn't configured, exactly like the
 * per-step {@link ../lesson/TutorPanel}.
 */
export function RoadmapTutorFab() {
  const { progress, profile } = useProgress();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);

  const chatRef = useRef<TutorChat | null>(null);

  // Coarse, PII-free signals so the tutor can tailor "what should I review?"
  // style answers: where the learner is and the concepts they're shakiest on.
  const general = useMemo<GeneralContext>(() => {
    const levels = getLevels();
    const currentLevel =
      levels.find((l) => getLevelStatus(l, progress) !== "complete") ??
      levels[levels.length - 1];
    const weakConcepts = getWeakConcepts(progress, 3, profile?.conceptStats).map(
      (c) => ({ label: c.label, percent: c.percent }),
    );
    return {
      completionPercent: getCompletionPercent(progress),
      ...(currentLevel ? { currentLevelTitle: currentLevel.title } : {}),
      ...(weakConcepts.length > 0 ? { weakConcepts } : {}),
    };
  }, [progress, profile?.conceptStats]);

  // Always read the freshest context when the chat is first created.
  const generalRef = useRef(general);
  generalRef.current = general;

  const handleSend = useCallback(
    async (text: string) => {
      if (busy) return;
      setBusy(true);
      setMessages((m) => [
        ...m,
        { role: "user", text },
        { role: "tutor", text: "" },
      ]);
      try {
        if (!chatRef.current) {
          chatRef.current = createGeneralTutorChat(generalRef.current);
        }
        let acc = "";
        for await (const piece of chatRef.current.send(text)) {
          acc += piece;
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "tutor", text: acc };
            return next;
          });
        }
      } catch (err) {
        console.error("[AI tutor] general chat failed:", err);
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "tutor",
            text: isQuotaError(err)
              ? QUOTA_MESSAGE
              : "Sorry, I couldn't answer that one. Please try again.",
          };
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  // The tutor only exists when the proxy is configured; otherwise the roadmap is
  // unaffected and no button appears.
  if (!isAiAvailable) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask the AI tutor"
          className="fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 active:scale-95"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Icon name="sparkle" className="h-6 w-6" fill="currentColor" />
        </button>
      )}
      <TutorChatModal
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        busy={busy}
        onSend={handleSend}
      />
    </>
  );
}
