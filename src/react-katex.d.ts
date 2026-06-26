declare module "react-katex" {
  import type { ComponentType, ReactNode } from "react";

  interface KatexProps {
    math: string;
    /** Render fallback for invalid LaTeX instead of KaTeX's red error text. */
    renderError?: (error: Error) => ReactNode;
  }

  export const InlineMath: ComponentType<KatexProps>;
  export const BlockMath: ComponentType<KatexProps>;
}
