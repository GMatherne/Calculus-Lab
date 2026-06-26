/**
 * Pure, framework-free helpers that turn the loosely-formatted inline text the
 * AI tutor (and, defensively, authored content) produces into a structured
 * token tree the renderer can typeset reliably.
 *
 * The KaTeX renderer in {@link ../components/widgets/MathBlock} understands
 * exactly one form of mathematics — inline `$…$`. Language models, however,
 * routinely reach for other shapes (`\(…\)`, `\[…\]`, `$$…$$`) and sprinkle in
 * Markdown emphasis (`**bold**`, `*italic*`) and bullet markers. Left as-is
 * those leak through as literal `$`, `\(`, or `*` characters. {@link
 * normalizeMathDelimiters} folds the math variants into `$…$`, {@link
 * tokenizeInline} splits a line into typed runs (text / math / emphasis /
 * code), and {@link stripListMarker} removes leading bullet punctuation.
 *
 * Everything here is intentionally side-effect free and DOM-free so it can be
 * unit-tested in the Node test environment without React or KaTeX.
 */

/** A single inline run produced by {@link tokenizeInline}. */
export type InlineToken =
  | { type: "text"; value: string }
  /** LaTeX source with its `$…$` delimiters already stripped. */
  | { type: "math"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] };

/**
 * Collapse the assorted delimiters used for mathematics into the single inline
 * `$…$` form the renderer understands: `$$…$$`, `\[…\]` (display) and `\(…\)`
 * (inline) all become `$…$`. Text that already uses `$…$` is untouched, so this
 * is a no-op for the hand-authored lessons and purely a safety net for model
 * output. The inner LaTeX is trimmed so `\( x \)` and `$x$` typeset identically.
 */
export function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => `$${body.trim()}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, body: string) => `$${body.trim()}$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, body: string) => `$${body.trim()}$`);
}

interface Rule {
  type: "math" | "code" | "bold" | "italic";
  re: RegExp;
}

// Patterns are tried at every position; the match with the smallest start index
// wins, with ties broken by this declaration order (math > code > bold >
// italic). Listing math first means `$a*b$` is consumed as one math run before
// its inner `*` could ever be read as emphasis. The emphasis patterns require a
// non-space character just inside the markers (standard Markdown), so spaced-out
// products like "2 * 3" are left strictly alone.
const RULES: readonly Rule[] = [
  { type: "math", re: /\$([^$\n]+?)\$/ },
  { type: "code", re: /`([^`\n]+?)`/ },
  { type: "bold", re: /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/ },
  { type: "italic", re: /\*(?=\S)([^*\n]+?)(?<=\S)\*/ },
];

/**
 * Split a single line into inline tokens. Bold/italic runs are tokenized
 * recursively so nested math (e.g. `**slope $m$**`) still renders. Unbalanced
 * markers (a lone `$` or `*`, common mid-stream while text is still arriving)
 * never match and simply remain literal text until their closing partner shows
 * up, so streaming output heals itself without flashing broken markup.
 */
export function tokenizeInline(text: string): InlineToken[] {
  if (!text) return [];

  let best: { index: number; length: number; type: Rule["type"]; inner: string } | null =
    null;
  for (const rule of RULES) {
    const match = rule.re.exec(text);
    if (match && (best === null || match.index < best.index)) {
      best = {
        index: match.index,
        length: match[0].length,
        type: rule.type,
        inner: match[1],
      };
    }
  }

  if (best === null) return [{ type: "text", value: text }];

  const tokens: InlineToken[] = [];
  if (best.index > 0) {
    tokens.push({ type: "text", value: text.slice(0, best.index) });
  }
  switch (best.type) {
    case "math":
      tokens.push({ type: "math", value: best.inner.trim() });
      break;
    case "code":
      tokens.push({ type: "code", value: best.inner });
      break;
    case "bold":
      tokens.push({ type: "bold", children: tokenizeInline(best.inner) });
      break;
    case "italic":
      tokens.push({ type: "italic", children: tokenizeInline(best.inner) });
      break;
  }
  const rest = text.slice(best.index + best.length);
  if (rest) tokens.push(...tokenizeInline(rest));
  return tokens;
}

/**
 * Strip a single leading Markdown bullet marker (`*`, `-`, `+`, `•` followed by
 * whitespace) from a line so list-y model output reads as clean prose. Ordered
 * markers like "1." and bare negatives like "-3" (no trailing space) are kept.
 */
export function stripListMarker(line: string): string {
  return line.replace(/^\s*[-*+•]\s+/, "");
}
