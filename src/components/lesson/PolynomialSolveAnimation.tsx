import { useEffect, useMemo, useRef, useState } from "react";
import { MathBlock } from "../widgets/MathBlock";
import type { PowerRuleTerm } from "../../types/content";
import {
  isDropped,
  opFor,
  resultCoeff,
  resultTermLatex,
  sourceTermLatex,
  type SolveDirection,
} from "./polynomialBeats";

/**
 * Per-beat dwell times (ms) for a single term's transformation, and the
 * constant's collapse. Tuned so the caption banner and the assembling result can
 * be read. Only used in auto-play; controlled (manual) mode is driven by `beat`.
 */
const BRING_MS = 750;
const MULT_MS = 700;
const REDUCE_MS = 800;
const CONST_BRING_MS = 750;
const CONST_DROP_MS = 950;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** A fully-specified visual state of the walkthrough at one beat. */
interface Frame {
  /** Source term currently being worked (highlighted), or -1 for none. */
  activeIdx: number;
  /** How many transformed terms are shown in the assembling result. */
  revealed: number;
  /** Source terms already transformed (shown dimmed). */
  resolved: Set<number>;
  /** Source terms that have dropped away (differentiated constants). */
  faded: Set<number>;
  caption: string;
  /** True on the final beat: the assembled result tints green. */
  done: boolean;
  ms: number;
}

/**
 * Pre-compute the auto-play timeline: for each term, narrate the rule, then
 * reveal the transformed term; a differentiated constant is highlighted then
 * fades. A final beat tints the assembled result. (Manual/controlled mode
 * supplies its own captions and uses {@link controlledFrame} instead.)
 */
function buildFrames(
  terms: PowerRuleTerm[],
  direction: SolveDirection,
  captions?: string[],
): Frame[] {
  const frames: Frame[] = [];
  const resolved = new Set<number>();
  const faded = new Set<number>();
  let revealed = 0;
  const push = (over: { activeIdx?: number; caption: string; done?: boolean; ms: number }) => {
    frames.push({
      activeIdx: over.activeIdx ?? -1,
      revealed,
      resolved: new Set(resolved),
      faded: new Set(faded),
      caption: over.caption,
      done: over.done ?? false,
      ms: over.ms,
    });
  };

  terms.forEach((t, i) => {
    const n = t.exponent;
    if (isDropped(t, direction)) {
      push({
        activeIdx: i,
        caption: captions?.[i] ?? "A constant term has slope $0$ everywhere",
        ms: CONST_BRING_MS,
      });
      faded.add(i);
      push({
        caption: "The derivative of a constant is $0$, so it drops away",
        ms: CONST_DROP_MS,
      });
      return;
    }
    if (direction === "integrate") {
      push({
        activeIdx: i,
        caption: captions?.[i] ?? `Raise the exponent: $${n} + 1 = ${n + 1}$`,
        ms: BRING_MS,
      });
      revealed += 1;
      resolved.add(i);
      push({
        activeIdx: i,
        caption: `Divide by the new exponent, $${n + 1}$`,
        ms: REDUCE_MS,
      });
      return;
    }
    push({
      activeIdx: i,
      caption: captions?.[i] ?? `Bring the exponent $${n}$ down in front`,
      ms: BRING_MS,
    });
    push({
      activeIdx: i,
      caption:
        t.coefficient === 1
          ? "It becomes the new coefficient"
          : `Multiply by the coefficient: $${t.coefficient} \\cdot ${n} = ${t.coefficient * n}$`,
      ms: MULT_MS,
    });
    revealed += 1;
    resolved.add(i);
    push({
      activeIdx: i,
      caption: `Reduce the power: $${n} - 1 = ${n - 1}$`,
      ms: REDUCE_MS,
    });
  });

  const finalCaption =
    direction === "integrate"
      ? "Add the pieces — that's $F(x)$"
      : "Add the pieces — that's $f'(x)$";
  push({ caption: finalCaption, done: true, ms: 0 });
  return frames;
}

/**
 * The visual state for controlled (manual) mode at a given beat: beat `b` has
 * transformed terms `0…b` (the term at `b` is active and its result just popped
 * in), and the final beat (`b ≥ terms.length`) shows the assembled, settled
 * result.
 */
function controlledFrame(
  terms: PowerRuleTerm[],
  beat: number,
  direction: SolveDirection,
): Frame {
  const total = terms.length;
  const done = beat >= total;
  const through = done ? total - 1 : beat;
  const resolved = new Set<number>();
  const faded = new Set<number>();
  let revealed = 0;
  terms.forEach((t, i) => {
    if (i > through) return;
    if (isDropped(t, direction)) {
      faded.add(i);
    } else {
      revealed += 1;
      if (done || i !== beat) resolved.add(i);
    }
  });
  return {
    activeIdx: done ? -1 : Math.min(beat, total - 1),
    revealed,
    resolved,
    faded,
    caption: "",
    done,
    ms: 0,
  };
}

interface PolynomialSolveAnimationProps {
  /** Source terms of f(x), in display order. */
  terms: PowerRuleTerm[];
  /** Which way the rule runs; defaults to differentiation. */
  direction?: SolveDirection;
  /** Change this to replay the walkthrough from the start (e.g. a fresh solve). */
  replayKey?: number | string;
  /** Smaller type for inline contexts. */
  compact?: boolean;
  /** Route each beat's caption to an external banner (the solve walkthrough). */
  onCaption?: (text: string) => void;
  /** Caption overrides for each term's headline beat, indexed by term. */
  captionsOverride?: string[];
  /**
   * Controlled mode: render the state for this beat instead of auto-playing, so
   * a manual narrated walkthrough can transform one term per "Next". Beat `i`
   * works `terms[i]`; a beat `≥ terms.length` shows the assembled result. When
   * set, the caption banner is the caller's responsibility (`onCaption` is
   * ignored).
   */
  beat?: number;
}

/**
 * Animates running the power rule across a whole polynomial, term by term —
 * differentiating (a·xⁿ → (a·n)·xⁿ⁻¹) or integrating (a·xⁿ → a/(n+1)·xⁿ⁺¹). Each
 * source term is highlighted in turn and its transformed term pops into the
 * assembling row below f(x); a differentiated constant fades away. Captions
 * narrate each beat (routed via {@link onCaption}). Respects
 * `prefers-reduced-motion` by snapping to the finished result.
 */
export function PolynomialSolveAnimation({
  terms,
  direction = "differentiate",
  replayKey,
  beat,
  compact = false,
  onCaption,
  captionsOverride,
}: PolynomialSolveAnimationProps) {
  const termsKey = terms.map((t) => `${t.coefficient}^${t.exponent}`).join("|");
  const captionsKey = (captionsOverride ?? []).join("|");
  // Keyed memo so a parent re-render (or an unchanged terms reference) can't
  // rebuild the timeline and restart the walkthrough: it intentionally depends on
  // the derived string keys, not the `terms`/`captionsOverride` array references.
  const frames = useMemo(
    () => buildFrames(terms, direction, captionsOverride),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [termsKey, captionsKey, direction],
  );

  const [cursor, setCursor] = useState(0);
  const onCaptionRef = useRef(onCaption);
  onCaptionRef.current = onCaption;

  // Drive the beats with a chained timeout sequence, restarting on replayKey or
  // a change of terms. Reduced motion snaps straight to the finished result.
  // Skipped entirely in controlled mode, where the caller supplies the beat.
  useEffect(() => {
    if (beat !== undefined) return;
    if (frames.length === 0) return;
    if (prefersReducedMotion()) {
      const last = frames.length - 1;
      setCursor(last);
      onCaptionRef.current?.(frames[last].caption);
      return;
    }
    setCursor(0);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    frames.forEach((f, idx) => {
      const id = setTimeout(() => {
        if (cancelled) return;
        setCursor(idx);
        onCaptionRef.current?.(f.caption);
      }, acc);
      timers.push(id);
      acc += f.ms;
    });
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [replayKey, frames, beat]);

  if (terms.length === 0) return null;

  const frame =
    beat !== undefined
      ? controlledFrame(terms, beat, direction)
      : frames[Math.min(cursor, frames.length - 1)] ?? frames[0];
  const resultTerms = terms
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !isDropped(t, direction));
  const resultPrefix = direction === "integrate" ? "F(x) =" : `f${"\u2032"}(x) =`;

  return (
    <div className={`pr-anim${compact ? " pr-anim--compact" : ""}`} aria-hidden="true">
      <div className="pr-poly">
        <div className="pr-poly-row">
          <span className="pr-prefix">f(x) =</span>
          {terms.map((t, i) => {
            const lead = i === 0;
            const active = frame.activeIdx === i;
            // Fade the whole cell (operator + term) so a dropped constant doesn't
            // leave a dangling "+" behind in the source row.
            const cellCls = `pr-poly-cell${frame.faded.has(i) ? " pr-poly-cell--faded" : ""}`;
            const cls = [
              "pr-poly-term",
              active ? "pr-poly-term--active" : "",
              !active && frame.resolved.has(i) ? "pr-poly-term--dim" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <span key={`src-${i}`} className={cellCls}>
                {!lead && <span className="pr-poly-op">{opFor(t.coefficient)}</span>}
                <span className={cls}>
                  <MathBlock latex={sourceTermLatex(t, lead)} />
                </span>
              </span>
            );
          })}
        </div>
        <div className={`pr-poly-row${frame.done ? " pr-poly-row--done" : ""}`}>
          <span className="pr-prefix">{resultPrefix}</span>
          {frame.revealed === 0 ? (
            <span className="pr-poly-pending">{"\u2026"}</span>
          ) : (
            resultTerms.slice(0, frame.revealed).map(({ t, i }, idx) => {
              const lead = idx === 0;
              return (
                <span key={`res-${i}`} className="pr-poly-cell pr-pop">
                  {!lead && (
                    <span className="pr-poly-op">{opFor(resultCoeff(t, direction))}</span>
                  )}
                  <span className="pr-poly-term pr-poly-term--result">
                    <MathBlock latex={resultTermLatex(t, lead, direction)} />
                  </span>
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
