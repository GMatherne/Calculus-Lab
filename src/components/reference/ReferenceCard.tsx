import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReferenceFact } from "../../types/content";
import { ContentBlocks, MathBlock, RichText } from "../widgets/MathBlock";
import { Icon } from "../common/Icon";

interface ReferenceCardProps {
  fact: ReferenceFact;
  unlocked: boolean;
  /** When locked, the level to finish first (previous level title) for the unlock hint. */
  unlockAfter: string;
}

/** Small muted caption that labels a card section (Equation, Definition, …). */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

/**
 * A single cheat-sheet card in the Reference section. When unlocked it lays the
 * fact out in labeled sections — the term as the heading, then its Equation and
 * Definition (plus an expandable Explanation) — so each piece is easy to scan,
 * with the lesson link pinned to the bottom so cards in a row line up. When
 * locked it shows only the title plus which level unlocks it, matching the muted
 * "locked" convention used on the roadmap's lesson cards.
 */
export function ReferenceCard({ fact, unlocked, unlockAfter }: ReferenceCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const hasDetail = Boolean(fact.detail && fact.detail.length > 0);

  if (!unlocked) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 opacity-60">
        <div className="flex items-center gap-2">
          <Icon name="lock" className="h-4 w-4 shrink-0 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-500">{fact.title}</h3>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {unlockAfter ? (
            <>
              Complete <span className="font-medium">{unlockAfter}</span> to
              unlock.
            </>
          ) : (
            "Complete the previous level to unlock."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{fact.title}</h3>

      {fact.formula && (
        <div className="mt-3">
          <SectionLabel>Equation</SectionLabel>
          <div className="mt-1.5 overflow-x-auto rounded-lg bg-slate-50 px-3 py-1.5 text-center">
            <MathBlock latex={fact.formula} display />
          </div>
        </div>
      )}

      {fact.summary && (
        <div className="mt-3">
          <SectionLabel>Definition</SectionLabel>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            <RichText text={fact.summary} />
          </p>
        </div>
      )}

      {hasDetail && showDetail && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <SectionLabel>Explanation</SectionLabel>
          <div className="mt-1">
            <ContentBlocks blocks={fact.detail!} compact />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 text-xs">
        {hasDetail && (
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            {showDetail ? "Hide explanation" : "Show explanation"}
          </button>
        )}
        <Link
          to={`/lesson/${fact.lessonId}`}
          className="font-medium text-slate-500 hover:text-indigo-600"
        >
          Learn more →
        </Link>
      </div>
    </div>
  );
}
