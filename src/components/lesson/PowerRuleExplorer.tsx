import { useState } from "react";
import { MathBlock } from "../widgets/MathBlock";

/** The three forms the power rule moves through, shown as a general derivation. */
const STEPS: { latex: string; caption: string }[] = [
  {
    latex: "\\dfrac{d}{dx}\\left(a\\,x^{n}\\right)",
    caption: "Differentiate a general term — any coefficient a, any power n.",
  },
  {
    latex: "n\\left(a\\,x^{\\,n-1}\\right)",
    caption: "Bring the power n down in front, and lower the exponent by one.",
  },
  {
    latex: "a\\,n\\,x^{\\,n-1}",
    caption: "Multiply n into the coefficient — the derivative is a·n·xⁿ⁻¹.",
  },
];

/**
 * The `power_rule` concept sandbox: the power rule in GENERAL form, stepped
 * through one beat at a time — d/dx(a·xⁿ) → n(a·xⁿ⁻¹) → a·n·xⁿ⁻¹. Because it uses
 * the symbols a and n rather than the question's numbers, it states the rule
 * without ever computing (and so never revealing) a concrete answer; the learner
 * still substitutes their own coefficient and power. Pulling n out in front as a
 * factor, then combining, also avoids the awkward "number beside the coefficient"
 * of a literal drop.
 */
export function PowerRuleExplorer() {
  const [beat, setBeat] = useState(0);
  const lastBeat = STEPS.length - 1;
  const atEnd = beat >= lastBeat;

  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-4 text-center">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`transition-all duration-300 ${
              i <= beat ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            } ${i === lastBeat && beat >= lastBeat ? "font-semibold text-emerald-700" : ""}`}
            aria-hidden={i > beat}
          >
            <div className="text-lg">
              <MathBlock latex={i === 0 ? step.latex : `=\\; ${step.latex}`} />
            </div>
            {i === beat && (
              <p className="mt-1 text-xs font-normal text-slate-500">{step.caption}</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setBeat(atEnd ? 0 : beat + 1)}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition"
        >
          {atEnd ? "Replay" : "Next step"}
        </button>
      </div>
    </div>
  );
}
