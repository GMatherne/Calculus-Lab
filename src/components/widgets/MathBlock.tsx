import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";
import type { ContentBlock } from "../../types/content";

export function MathBlock({ latex, display }: { latex: string; display?: boolean }) {
  try {
    if (display) {
      return (
        <div className="my-3 overflow-x-auto text-base sm:text-lg">
          <BlockMath math={latex} />
        </div>
      );
    }
    return <InlineMath math={latex} />;
  } catch {
    return <code className="text-sm">{latex}</code>;
  }
}

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-3 text-base leading-relaxed text-slate-800">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          return <p key={i}>{block.body}</p>;
        }
        return <MathBlock key={i} latex={block.latex} display={block.display} />;
      })}
    </div>
  );
}
