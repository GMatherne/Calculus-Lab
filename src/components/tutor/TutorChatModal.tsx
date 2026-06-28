import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "../common/Icon";
import { TutorText } from "./TutorText";

/** One turn in the free-form chat transcript. */
export interface ChatTurn {
  role: "user" | "tutor";
  text: string;
}

interface TutorChatModalProps {
  open: boolean;
  onClose: () => void;
  /** The conversation so far (owned by the parent so it survives open/close). */
  messages: ChatTurn[];
  /** True while a reply is streaming, to disable input and show progress. */
  busy: boolean;
  /** Send a message; the parent runs the request and appends to `messages`. */
  onSend: (text: string) => void;
}

/** Inviting starters shown on the empty chat so it's clear what to ask. */
const SUGGESTED_PROMPTS = [
  "Explain the chain rule with an example",
  "What should I review next?",
  "Why does the power rule work?",
  "How do I find the area under a curve?",
];

/**
 * Full-screen-on-mobile / centered-on-desktop overlay that hosts the free-form
 * AI tutor chat. Presentational only: the conversation, streaming, and learner
 * context live in the parent (see {@link ./RoadmapTutorFab}). Modeled on the
 * Reference popup so it overlays the roadmap without navigating away.
 */
export function TutorChatModal({
  open,
  onClose,
  messages,
  busy,
  onSend,
}: TutorChatModalProps) {
  const [input, setInput] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Keep a live ref to onClose so the effects below don't need it as a
  // dependency (which would re-run them every render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close when the route changes so the popup never lingers over a page it
  // wasn't opened from.
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      onCloseRef.current();
    }
  }, [pathname]);

  // While open: focus the input, lock background scroll, and let Escape close.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Keep the latest message in view as the conversation grows / streams.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  if (!open) return null;

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    onSend(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-dvh w-full flex-col bg-white shadow-xl outline-none sm:h-[600px] sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100"
              aria-hidden
            >
              <Icon name="sparkle" className="h-4 w-4 text-indigo-600" fill="currentColor" />
            </span>
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              AI tutor
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutor chat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100"
                aria-hidden
              >
                <Icon
                  name="sparkle"
                  className="h-6 w-6 text-indigo-600"
                  fill="currentColor"
                />
              </span>
              <p className="text-base font-semibold text-slate-900">
                Ask me anything about calculus
              </p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                I can explain a concept, work an example, or help you decide what
                to study next.
              </p>
              <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submit(prompt)}
                    disabled={busy}
                    className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5 text-left text-sm font-medium text-indigo-800 transition hover:border-indigo-400 hover:bg-indigo-50 active:scale-[0.99] disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((turn, i) =>
                turn.role === "user" ? (
                  <div
                    key={i}
                    className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3.5 py-2 text-white"
                  >
                    {turn.text}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2 text-slate-800"
                  >
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
        </div>

        <div className="border-t border-slate-200 p-3 safe-bottom">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit(input);
                }
              }}
              disabled={busy}
              placeholder="Ask the tutor…"
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => submit(input)}
              disabled={busy || input.trim().length === 0}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            AI-generated guidance, scoped to this course. It can occasionally be
            imperfect, so double-check anything important.
          </p>
        </div>
      </div>
    </div>
  );
}
