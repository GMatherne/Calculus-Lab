import { MathBlock } from "../widgets/MathBlock";
import type { PowerRuleTerm } from "../../types/content";
import { PolynomialSolveAnimation } from "./PolynomialSolveAnimation";
import {
  antiderivativeLatex,
  antiderivativeValueAt,
  formatSolveNumber,
} from "./polynomialBeats";

interface FtcEvaluateAnimationProps {
  /** Integrand terms a·xⁿ; the animation builds F(x) from them. */
  terms: PowerRuleTerm[];
  /** Lower limit of the definite integral. */
  a: number;
  /** Upper limit of the definite integral. */
  b: number;
  /** Controlled beat from the solve walkthrough. */
  beat: number;
}

/**
 * "Evaluate a definite integral" walkthrough. First it builds the antiderivative
 * F(x) term by term (delegating to {@link PolynomialSolveAnimation} in integrate
 * mode), then — once the build beats finish — it reveals the Fundamental Theorem
 * substitution F(b) − F(a) and the resulting number, one beat at a time. Driven
 * by `beat` from the lesson player so the learner steps through it manually. The
 * build phase runs over beats 0…terms.length; the substitution appears at
 * beat terms.length + 1 and the numeric result at beat terms.length + 2.
 */
export function FtcEvaluateAnimation({ terms, a, b, beat }: FtcEvaluateAnimationProps) {
  // Freeze the term-build animation on its assembled F once the eval beats begin.
  const buildBeat = Math.min(beat, terms.length);
  const showSubstitution = beat >= terms.length + 1;
  const showResult = beat >= terms.length + 2;

  const F = antiderivativeLatex(terms);
  const Fb = antiderivativeValueAt(terms, b);
  const Fa = antiderivativeValueAt(terms, a);
  const result = Fb - Fa;

  return (
    <div className="ftc-eval" aria-hidden="true">
      <PolynomialSolveAnimation terms={terms} direction="integrate" beat={buildBeat} />
      {showSubstitution && (
        <div className="pr-poly ftc-eval-rows">
          <div className="pr-poly-row pr-pop">
            <MathBlock
              latex={`\\left[\\, ${F} \\,\\right]_{${a}}^{${b}} = F(${b}) - F(${a})`}
            />
          </div>
          {showResult && (
            <div className="pr-poly-row pr-poly-row--done pr-pop">
              <MathBlock
                latex={`= ${formatSolveNumber(Fb)} - ${formatSolveNumber(Fa)} = ${formatSolveNumber(result)}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
