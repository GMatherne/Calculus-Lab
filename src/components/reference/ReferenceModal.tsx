import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useProgress } from "../../contexts/ProgressContext";
import {
  getReferenceGroups,
  getReferenceUnlockedCount,
} from "../../lib/referenceService";
import { ReferenceCard } from "./ReferenceCard";

interface ReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The Reference cheat sheet as a popup. Opening it overlays the current page
 * (a lesson, practice session, the roadmap, ...) rather than navigating away, so
 * a learner can glance at a formula without losing their place. Level tabs let
 * them jump straight to a stage of the course; each tab shows that level's facts
 * (reusing {@link ReferenceCard}), still gated by lesson completion.
 */
export function ReferenceModal({ open, onClose }: ReferenceModalProps) {
  const { progress, loading } = useProgress();
  const groups = getReferenceGroups(progress);
  const { unlocked, total } = getReferenceUnlockedCount(progress);

  const [activeId, setActiveId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Keep a live ref to onClose so the effects below don't need it as a
  // dependency (which would re-run them every render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close when the route changes — e.g. tapping a card's "Learn more" link — so
  // the popup never lingers over a page it wasn't opened from. Tracks the path
  // and fires only on an actual change, never on open/close.
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      onCloseRef.current();
    }
  }, [pathname]);

  // While open: focus the dialog, lock background scroll, and let Escape close.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
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

  if (!open) return null;

  const activeGroup =
    groups.find((g) => g.levelId === activeId) ?? groups[0];

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
        className="flex h-dvh w-full flex-col bg-white shadow-xl outline-none sm:h-[90vh] sm:max-w-5xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              Reference
            </h2>
            {!loading && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {unlocked} of {total} unlocked
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reference"
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

        {loading ? (
          <div className="p-6 text-slate-500">Loading…</div>
        ) : !activeGroup ? (
          <div className="p-6 text-slate-500">No reference facts yet.</div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Course levels"
              className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2"
            >
              {groups.map((group) => {
                const isActive = group.levelId === activeGroup.levelId;
                return (
                  <button
                    key={group.levelId}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveId(group.levelId)}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Level {group.order}
                  </button>
                );
              })}
            </div>

            <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {activeGroup.levelTitle}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activeGroup.facts.map(({ fact, unlocked, unlockAfter }) => (
                  <ReferenceCard
                    key={fact.id}
                    fact={fact}
                    unlocked={unlocked}
                    unlockAfter={unlockAfter}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
