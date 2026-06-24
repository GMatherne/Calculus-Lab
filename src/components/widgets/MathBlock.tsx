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

/**
 * Renders a string that may contain inline LaTeX delimited by single dollar
 * signs, e.g. "the antiderivative $\\frac{x^3}{3}$ checks out". Segments inside
 * `$...$` are typeset with KaTeX; everything else renders as plain text.
 * Strings with no `$` are returned unchanged, so existing copy is unaffected.
 */
export function RichText({ text }: { text: string }) {
  if (!text.includes("$")) return <>{text}</>;
  // Capturing group keeps the delimited segments in the split output.
  const segments = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.length > 2 && seg.startsWith("$") && seg.endsWith("$")) {
          const latex = seg.slice(1, -1);
          try {
            return <InlineMath key={i} math={latex} />;
          } catch {
            return <code key={i} className="text-sm">{latex}</code>;
          }
        }
        return seg ? <span key={i}>{seg}</span> : null;
      })}
    </>
  );
}

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-3 text-base leading-relaxed text-slate-800">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          return (
            <p key={i}>
              <RichText text={block.body} />
            </p>
          );
        }
        return <MathBlock key={i} latex={block.latex} display={block.display} />;
      })}
    </div>
  );
}
