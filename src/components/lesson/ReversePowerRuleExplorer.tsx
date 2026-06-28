import { useState } from "react";
import { MathBlock } from "../widgets/MathBlock";

/** The forms the reverse power rule moves through, shown as a general derivation. */
const STEPS: { latex: string; caption: string }[] = [
  {
    latex: "\\int a\\,x^{n}\\,dx",
    caption: "Integrate a general term — any coefficient a, any power n.",
  },
  {
    latex: "a\\,\\dfrac{x^{\\,n+1}}{n+1} + C",
    caption: "Raise the exponent by one, then divide by that new exponent.",
  },
  {
    latex: "\\dfrac{a}{\\,n+1\\,}\\,x^{\\,n+1} + C",
    caption: "The coefficient rides over the new exponent — and add + C.",
  },
];

/**
 * The `reverse_power_rule` concept sandbox: the reverse power rule in GENERAL
 * form, stepped through one beat at a time — ∫a·xⁿ dx → a·xⁿ⁺¹/(n+1) + C. Because
 * it uses the symbols a and n rather than the question's numbers, it states the
 * rule without ever computing (and so never revealing) a concrete answer; the
 * learner still substitutes their own coefficient and power. It is the
 * antiderivative mirror of {@link PowerRuleExplorer}, including the always-present
 * constant of integration C.
 */
export function ReversePowerRuleExplorer() {
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
