import { useEffect, useRef, useState } from "react";
import { MathBlock, RichText } from "../widgets/MathBlock";
import type { PowerRuleTerm } from "../../types/content";
import { PHASES, POWER_RULE_BEAT_COUNT, captionFor } from "./powerRuleBeats";
import { prefersReducedMotion } from "../../lib/reducedMotion";

/** Per-beat dwell time (ms) when the derivation auto-plays. */
const STEP_MS = 950;
/** Extra hold after a term finishes before the montage moves to the next one. */
const MONTAGE_HOLD_MS = 1100;

/** Render a single power term a·xⁿ as LaTeX, collapsing trivial cases. */
function termLatex(a: number, n: number): string {
  if (a === 0) return "0";
  if (n === 0) return `${a}`;
  const coeff = a === 1 ? "" : a === -1 ? "-" : `${a}`;
  const power = n === 1 ? "x" : `x^{${n}}`;
  return `${coeff}${power}`;
}

/**
 * The three LaTeX lines the power rule moves through for a·xⁿ: differentiate
 * `d/dx(a xⁿ)`, factor out the power `n(a xⁿ⁻¹)`, then combine `a·n xⁿ⁻¹`. A
 * constant (n = 0) collapses straight to 0. The leading d/dx keeps the `=` chain
 * honest (the term itself is not equal to its derivative).
 */
function statesFor(a: number, n: number): string[] {
  const start = `\\dfrac{d}{dx}\\left(${termLatex(a, n)}\\right)`;
  const factor = n === 0 ? "0" : `${n}\\left(${termLatex(a, n - 1)}\\right)`;
  const combine = termLatex(a * n, n - 1);
  return [start, factor, combine];
}

interface PowerRuleAnimationProps {
  /** Source coefficient a of a·xⁿ (used for the single drop; ignored in montage). */
  coefficient: number;
  /** Source exponent n of a·xⁿ (used for the single drop; ignored in montage). */
  exponent: number;
  /** "drop" plays one term once; "montage" cycles `terms`. */
  mode?: "drop" | "montage";
  /** Terms cycled in montage mode, each animated through the same derivation. */
  terms?: PowerRuleTerm[];
  /**
   * Montage only: let the learner step through the terms with a button instead of
   * auto-looping (a calmer recap that doesn't move on its own).
   */
  manual?: boolean;
  /** Change this to replay the animation from the start (e.g. on a fresh solve). */
  replayKey?: number | string;
  /**
   * Controlled mode: reveal the derivation up to the given beat
   * (0…{@link POWER_RULE_BEAT_COUNT}-1) instead of auto-playing, so the learner
   * steps through it one line at a time.
   */
  beat?: number;
  /** Smaller type for inline contexts (e.g. above a graph). */
  compact?: boolean;
  /** Route each beat's caption to an external banner (the solve walkthrough). */
  onCaption?: (text: string) => void;
  /** Caption overrides for the solve walkthrough, indexed by beat. */
  captionsOverride?: string[];
  /** Render the component's own caption line (used by the montage). */
  showCaption?: boolean;
}

/**
 * Animates the power rule on a single term as a three-line derivation,
 * d/dx(a·xⁿ) → n(a·xⁿ⁻¹) → a·n·xⁿ⁻¹: the power is pulled out in front as a factor
 * (with the exponent lowered), then multiplied into the coefficient. In
 * controlled mode (`beat`) the learner steps through it one line at a time;
 * otherwise it plays on a timer, and `mode="montage"` cycles `terms` (auto-looping,
 * or learner-paced with `manual`). Respects `prefers-reduced-motion` by snapping
 * to the finished derivative.
 */
export function PowerRuleAnimation({
  coefficient,
  exponent,
  mode = "drop",
  terms,
  manual = false,
  replayKey,
  beat,
  compact = false,
  onCaption,
  captionsOverride,
  showCaption = false,
}: PowerRuleAnimationProps) {
  const isMontage = mode === "montage";
  const controlled = beat !== undefined;
  const manualMontage = isMontage && manual && !controlled;
  const effectiveTerms: PowerRuleTerm[] =
    isMontage && terms && terms.length > 0 ? terms : [{ coefficient, exponent }];
  const termsKey = effectiveTerms
    .map((t) => `${t.coefficient}^${t.exponent}`)
    .join("|");

  const [termIdx, setTermIdx] = useState(0);
  const [autoBeat, setAutoBeat] = useState(0);

  // Keep onCaption out of the schedulers' deps so a parent re-render can't
  // restart the timeline mid-flight.
  const onCaptionRef = useRef(onCaption);
  onCaptionRef.current = onCaption;

  // Auto playback: a single term once, or an auto-looping montage. Controlled and
  // manual-montage modes opt out and drive the beat themselves.
  useEffect(() => {
    if (controlled || manualMontage) return;
    const emit = (t: PowerRuleTerm, b: number) =>
      onCaptionRef.current?.(
        captionFor(t.coefficient, t.exponent, PHASES[b], captionsOverride),
      );

    if (prefersReducedMotion()) {
      setTermIdx(0);
      setAutoBeat(POWER_RULE_BEAT_COUNT - 1);
      emit(effectiveTerms[0], POWER_RULE_BEAT_COUNT - 1);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const runTerm = (ti: number) => {
      setTermIdx(ti);
      const t = effectiveTerms[ti];
      for (let b = 0; b < POWER_RULE_BEAT_COUNT; b++) {
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setAutoBeat(b);
            emit(t, b);
          }, b * STEP_MS),
        );
      }
      if (isMontage) {
        timers.push(
          setTimeout(
            () => {
              if (cancelled) return;
              runTerm((ti + 1) % effectiveTerms.length);
            },
            POWER_RULE_BEAT_COUNT * STEP_MS + MONTAGE_HOLD_MS,
          ),
        );
      }
    };
    setAutoBeat(0);
    runTerm(0);
    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, termsKey, isMontage, controlled, manualMontage]);

  // Manual montage: animate the current term's beats; the Next button advances.
  useEffect(() => {
    if (!manualMontage) return;
    const t = effectiveTerms[termIdx] ?? effectiveTerms[0];
    const emit = (b: number) =>
      onCaptionRef.current?.(
        captionFor(t.coefficient, t.exponent, PHASES[b], captionsOverride),
      );
    if (prefersReducedMotion()) {
      setAutoBeat(POWER_RULE_BEAT_COUNT - 1);
      emit(POWER_RULE_BEAT_COUNT - 1);
      return;
    }
    setAutoBeat(0);
    emit(0);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let b = 1; b < POWER_RULE_BEAT_COUNT; b++) {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setAutoBeat(b);
          emit(b);
        }, b * STEP_MS),
      );
    }
    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMontage, termIdx, termsKey, replayKey]);

  const term = effectiveTerms[controlled ? 0 : termIdx] ?? effectiveTerms[0];
  const states = statesFor(term.coefficient, term.exponent);
  const lastBeat = POWER_RULE_BEAT_COUNT - 1;
  const shownBeat = controlled
    ? Math.max(0, Math.min(lastBeat, beat as number))
    : autoBeat;
  const atLastTerm = termIdx >= effectiveTerms.length - 1;

  return (
    <div>
      <div aria-hidden="true">
        <div
          className={`space-y-1 text-center ${compact ? "text-base" : "text-lg"}`}
        >
          {states.map((s, i) => (
            <div
              key={i}
              className={`transition-all duration-300 ${
                i <= shownBeat
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1"
              } ${
                i === lastBeat && shownBeat >= lastBeat
                  ? "font-semibold text-emerald-700"
                  : "text-slate-800"
              }`}
            >
              <MathBlock latex={i === 0 ? s : `=\\; ${s}`} />
            </div>
          ))}
        </div>
        {showCaption && (
          <div className="mt-2 text-center text-xs text-slate-500">
            <RichText
              text={captionFor(
                term.coefficient,
                term.exponent,
                PHASES[shownBeat],
                captionsOverride,
              )}
            />
          </div>
        )}
      </div>
      {manualMontage && effectiveTerms.length > 1 && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() =>
              setTermIdx((ti) => (ti + 1) % effectiveTerms.length)
            }
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition"
          >
            {atLastTerm ? "Replay" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
