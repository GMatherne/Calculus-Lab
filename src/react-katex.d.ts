declare module "react-katex" {
  import type { ComponentType, ReactNode } from "react";

  /**
   * Subset of KaTeX render options forwarded to `katex.renderToString`. We pin
   * the security-relevant `trust` flag (see {@link KatexProps.settings}).
   */
  interface KatexSettings {
    /**
     * When false (KaTeX's default), commands that can emit arbitrary URLs or
     * markup (`\href`, `\url`, `\includegraphics`, `\htmlClass`, …) are
     * disabled, preventing `javascript:`-style injection from untrusted LaTeX.
     */
    trust?: boolean | ((context: { command: string; url?: string }) => boolean);
    strict?: boolean | string;
    throwOnError?: boolean;
  }

  interface KatexProps {
    math: string;
    /** Render fallback for invalid LaTeX instead of KaTeX's red error text. */
    renderError?: (error: Error) => ReactNode;
    /** KaTeX render options (we use it to force `trust: false`). */
    settings?: KatexSettings;
  }

  export const InlineMath: ComponentType<KatexProps>;
  export const BlockMath: ComponentType<KatexProps>;
}
