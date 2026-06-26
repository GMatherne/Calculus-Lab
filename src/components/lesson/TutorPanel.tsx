import { useCallback, useRef, useState } from "react";
import type { Step } from "../../types/content";
import { isAiAvailable } from "../../lib/firebase";
import {
  buildStepContext,
  createTutorChat,
  explainStep,
  isQuotaError,
  MAX_FOLLOWUPS,
  type TutorChat,
  type TutorContext,
} from "../../lib/aiTutor";
import { RichText } from "../widgets/MathBlock";
import { Icon } from "../common/Icon";
import { stripListMarker } from "../../lib/inlineMarkup";

/** Shown when Gemini's free-tier quota (or billing limit) is exhausted. */
const QUOTA_MESSAGE =
  "You're out of free AI tutor responses for now. The free-tier limit resets around midnight Pacific — or enable billing on the Firebase project to remove the cap.";

interface TutorPanelProps {
  step: Step;
  /** The exact value the learner submitted for this step. */
  answer: unknown;
  /** 1-based attempt count for tone (best-effort; not required for grounding). */
  attempts: number;
  /** The deterministic engine's verdict for the submitted answer. */
  isCorrect: boolean;
}

type Phase = "idle" | "streaming" | "done" | "error";

interface Turn {
  role: "user" | "tutor";
  text: string;
}

/** Render tutor text: split into lines, each with inline math + light Markdown. */
function TutorText({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((l) => stripListMarker(l).trim())
    .filter((l) => l.length > 0);
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => (
        <p key={i}>
          <RichText text={line} />
        </p>
      ))}
    </div>
  );
}

export function TutorPanel({ step, answer, attempts, isCorrect }: TutorPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [explanation, setExplanation] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [followups, setFollowups] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [quotaHit, setQuotaHit] = useState(false);

  const chatRef = useRef<TutorChat | null>(null);
  const ctxRef = useRef<TutorContext | null>(null);
  // Monotonic id so a stream that outlives its relevance can't update state.
  const runIdRef = useRef(0);

  const start = useCallback(async () => {
    const runId = ++runIdRef.current;
    setPhase("streaming");
    setExplanation("");
    setTurns([]);
    setFollowups(0);
    setInput("");
    setErrorMsg("");
    setQuotaHit(false);
    chatRef.current = null;
    const ctx = buildStepContext(step, answer, attempts, isCorrect);
    ctxRef.current = ctx;
    try {
      let acc = "";
      for await (const piece of explainStep(ctx)) {
        if (runIdRef.current !== runId) return;
        acc += piece;
        setExplanation(acc);
      }
      if (runIdRef.current !== runId) return;
      setPhase("done");
    } catch (err) {
      console.error("[AI tutor] explainStep failed:", err);
      if (runIdRef.current !== runId) return;
      setQuotaHit(isQuotaError(err));
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [step, answer, attempts, isCorrect]);

  const send = useCallback(async () => {
    const text = input.trim();
    const ctx = ctxRef.current;
    if (!text || busy || !ctx || followups >= MAX_FOLLOWUPS) return;
    const runId = runIdRef.current;
    setBusy(true);
    setInput("");
    setFollowups((n) => n + 1);
    setTurns((t) => [...t, { role: "user", text }, { role: "tutor", text: "" }]);
    try {
      if (!chatRef.current) {
        chatRef.current = createTutorChat(ctx, explanation);
      }
      let acc = "";
      for await (const piece of chatRef.current.send(text)) {
        if (runIdRef.current !== runId) return;
        acc += piece;
        setTurns((t) => {
          const next = [...t];
          next[next.length - 1] = { role: "tutor", text: acc };
          return next;
        });
      }
    } catch (err) {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = {
          role: "tutor",
          text: isQuotaError(err)
            ? QUOTA_MESSAGE
            : "Sorry, I couldn't answer that one. Please try again.",
        };
        return next;
      });
    } finally {
      if (runIdRef.current === runId) setBusy(false);
    }
  }, [input, busy, followups, explanation]);

  // The tutor only exists when Firebase AI Logic is configured; otherwise the
  // authored feedback stands on its own and this renders nothing.
  if (!isAiAvailable) return null;

  const triggerLabel = isCorrect ? "Why does this work?" : "Walk me through it";
  const atFollowupLimit = followups >= MAX_FOLLOWUPS;

  if (phase === "idle") {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
        <button
          type="button"
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition"
        >
          <Icon name="sparkle" className="h-4 w-4" fill="currentColor" />
          {triggerLabel}
        </button>
        <p className="mt-2 text-xs text-indigo-700/70">
          Ask the AI tutor to explain the idea behind this step.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-base text-slate-800">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-800">
        <Icon name="sparkle" className="h-4 w-4" fill="currentColor" />
        AI tutor
      </div>

      {phase === "error" ? (
        <div className="text-sm text-slate-700">
          <p>
            {quotaHit
              ? QUOTA_MESSAGE
              : "Sorry, the tutor couldn't load an explanation right now."}
          </p>
          {import.meta.env.DEV && errorMsg && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900/90 p-2 text-[11px] leading-snug text-rose-200">
              {errorMsg}
            </pre>
          )}
          <button
            type="button"
            onClick={() => void start()}
            className="mt-2 inline-flex items-center rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 active:scale-[0.98] transition"
          >
            {quotaHit ? "Try again later" : "Try again"}
          </button>
        </div>
      ) : (
        <>
          {explanation ? (
            <TutorText text={explanation} />
          ) : (
            <p className="text-sm text-slate-500" role="status">
              Thinking…
            </p>
          )}

          {turns.length > 0 && (
            <div className="mt-3 space-y-3 border-t border-indigo-200/70 pt-3">
              {turns.map((turn, i) =>
                turn.role === "user" ? (
                  <p key={i} className="text-sm font-medium text-slate-600">
                    <span className="text-slate-400">You:</span> {turn.text}
                  </p>
                ) : (
                  <div key={i} className="text-slate-800">
                    {turn.text ? (
                      <TutorText text={turn.text} />
                    ) : (
                      <p className="text-sm text-slate-500" role="status">
                        Thinking…
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="mt-3 border-t border-indigo-200/70 pt-3">
              {atFollowupLimit ? (
                <p className="text-xs text-slate-500">
                  That's the follow-up limit for this step.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    disabled={busy}
                    placeholder="Ask a follow-up…"
                    className="min-h-[40px] flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={busy || input.trim().length === 0}
                    className="min-h-[40px] rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 active:scale-[0.98] transition"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] leading-snug text-slate-400">
        AI-generated guidance — your answer was graded by the app, not the tutor.
        Explanations can occasionally be imperfect.
      </p>
    </div>
  );
}
