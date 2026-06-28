import { useEffect, useState } from "react";
import type { ContentBlock } from "../../types/content";
import { MathBlock, RichText } from "../widgets/MathBlock";
import { Icon } from "../common/Icon";

interface SolutionPanelProps {
  blocks: ContentBlock[];
}

/** Delay between each worked-solution step appearing, in ms. */
const STEP_REVEAL_MS = 550;

/**
 * The worked-solution panel shown in the "solve" assistance level: the
 * hand-authored, concept-to-answer explanation, revealed one step at a time so
 * it reads as a walkthrough alongside the widget animating to its answer.
 * Respects `prefers-reduced-motion` by showing every step at once.
 */
export function SolutionPanel({ blocks }: SolutionPanelProps) {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    setShown(1);
    if (blocks.length <= 1) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setShown(blocks.length);
      return;
    }
    const id = setInterval(() => {
      setShown((s) => {
        if (s >= blocks.length) {
          clearInterval(id);
          return s;
        }
        return s + 1;
      });
    }, STEP_REVEAL_MS);
    return () => clearInterval(id);
  }, [blocks]);

  if (blocks.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-800">
        <Icon name="bookOpen" className="h-4 w-4" />
        Worked solution
      </div>
      <div className="space-y-3 text-base leading-relaxed text-slate-800">
        {blocks.map((block, i) => (
          <div
            key={i}
            className={`transition-all duration-300 ${
              i < shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            }`}
          >
            {block.type === "text" ? (
              <p>
                <RichText text={block.body} />
              </p>
            ) : (
              <MathBlock latex={block.latex} display={block.display} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
