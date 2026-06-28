import { RichText } from "../widgets/MathBlock";
import { stripListMarker } from "../../lib/inlineMarkup";

/**
 * Render a block of tutor text: split it into lines, strip any stray list
 * markers, and typeset each line with inline math + light Markdown via {@link
 * RichText}. Shared by the per-step {@link ../lesson/TutorPanel} and the
 * free-form roadmap chat so both render model output identically.
 */
export function TutorText({ text }: { text: string }) {
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
