import "katex/dist/katex.min.css";
import { Fragment, type ReactNode } from "react";
import { BlockMath, InlineMath } from "react-katex";
import type { ContentBlock } from "../../types/content";
import {
  normalizeMathDelimiters,
  tokenizeInline,
  type InlineToken,
} from "../../lib/inlineMarkup";

/** Fallback when LaTeX fails to parse: show the raw source rather than a crash. */
function mathFallback(latex: string) {
  return <code className="text-sm">{latex}</code>;
}

/**
 * KaTeX render options. `trust: false` is KaTeX's default, but we pin it
 * explicitly because this component typesets UNTRUSTED input — AI tutor output
 * and authored lesson content — and `trust: false` is what disables commands
 * like `\href`/`\url`/`\includegraphics` that could otherwise smuggle a
 * `javascript:` URL or arbitrary markup into the DOM (XSS).
 */
const KATEX_SETTINGS = { trust: false } as const;

export function MathBlock({ latex, display }: { latex: string; display?: boolean }) {
  if (display) {
    return (
      <div className="my-3 overflow-x-auto text-base sm:text-lg">
        <BlockMath
          math={latex}
          settings={KATEX_SETTINGS}
          renderError={() => mathFallback(latex)}
        />
      </div>
    );
  }
  return (
    <InlineMath
      math={latex}
      settings={KATEX_SETTINGS}
      renderError={() => mathFallback(latex)}
    />
  );
}

/** Render a tokenized inline run (text, math, code, and bold/italic emphasis). */
function renderTokens(tokens: InlineToken[], keyPrefix = ""): ReactNode {
  return tokens.map((token, i) => {
    const key = `${keyPrefix}${i}`;
    switch (token.type) {
      case "math":
        return (
          <InlineMath
            key={key}
            math={token.value}
            settings={KATEX_SETTINGS}
            renderError={() => mathFallback(token.value)}
          />
        );
      case "code":
        return (
          <code key={key} className="rounded bg-slate-200/70 px-1 text-[0.9em]">
            {token.value}
          </code>
        );
      case "bold":
        return <strong key={key}>{renderTokens(token.children, `${key}.`)}</strong>;
      case "italic":
        return <em key={key}>{renderTokens(token.children, `${key}.`)}</em>;
      default:
        return <Fragment key={key}>{token.value}</Fragment>;
    }
  });
}

/**
 * Renders a single line of inline text that may mix prose, inline LaTeX, and
 * light Markdown emphasis. Math may arrive as `$…$`, `\(…\)`, `\[…\]`, or
 * `$$…$$` (all normalized to inline `$…$`); `**bold**`/`*italic*`/`` `code` ``
 * render as the corresponding elements rather than leaking literal punctuation.
 * Plain strings with none of these markers pass straight through untouched, so
 * existing authored copy is unaffected.
 */
export function RichText({ text }: { text: string }) {
  if (!/[$*`\\]/.test(text)) return <>{text}</>;
  return <>{renderTokens(tokenizeInline(normalizeMathDelimiters(text)))}</>;
}

/**
 * Renders authored content blocks (prose + math). `compact` shrinks the type to
 * match dense surfaces like the Reference cards; the default keeps the larger
 * lesson-reading size.
 */
export function ContentBlocks({
  blocks,
  compact = false,
}: {
  blocks: ContentBlock[];
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "space-y-2 text-xs leading-relaxed text-slate-600"
          : "space-y-3 text-base leading-relaxed text-slate-800"
      }
    >
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
