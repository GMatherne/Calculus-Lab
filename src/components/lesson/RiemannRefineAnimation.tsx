import { useEffect, useMemo, useState } from "react";
import { evalFunction, riemannSum } from "../../lib/feedbackEngine";
import { RIEMANN_REFINE_COUNTS } from "./riemannRefineBeats";

const W = 340;
const H = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

/** Per-beat dwell time (ms) when auto-playing (uncontrolled). */
const BEAT_MS = 1100;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

interface RiemannRefineAnimationProps {
  /** Curve to slice, as an expression in x (e.g. "x^2"). */
  fn: string;
  /** Lower and upper limits of the region. */
  a: number;
  b: number;
  /** The exact area, shown alongside the converging estimate. */
  trueArea: number;
  /** Plot domain; defaults to [a, b]. */
  domain?: [number, number];
  /** Rectangle counts shown per beat; defaults to {@link RIEMANN_REFINE_COUNTS}. */
  counts?: number[];
  /**
   * Controlled mode: render the state for this beat instead of auto-playing, so
   * the manual walkthrough can add rectangles one "Next" at a time.
   */
  beat?: number;
  /** Change this to replay the walkthrough from the start. */
  replayKey?: number | string;
  /** Smaller type for inline contexts. */
  compact?: boolean;
}

/**
 * Animates the integral as a limit of Riemann sums: under-curve rectangles
 * multiply beat by beat (a few wide ones → many thin ones), and the running
 * estimate visibly closes in on the true area. The picture and the estimate
 * share one midpoint sum, exactly as the grader computes it. Decorative
 * (`aria-hidden`); respects `prefers-reduced-motion` by snapping to the finest
 * slicing.
 */
export function RiemannRefineAnimation({
  fn,
  a,
  b,
  trueArea,
  domain,
  counts,
  beat,
  replayKey,
  compact = false,
}: RiemannRefineAnimationProps) {
  const seq = counts ?? [...RIEMANN_REFINE_COUNTS];
  const [domLo, domHi] = domain ?? [a, b];

  // Sample the curve once for the outline and to auto-scale the y-axis.
  const { curvePath, yMin, yMax } = useMemo(() => {
    const pts: Array<[number, number]> = [];
    let lo = 0;
    let hi = 0;
    const N = 140;
    for (let i = 0; i <= N; i++) {
      const x = domLo + ((domHi - domLo) * i) / N;
      try {
        const y = evalFunction(fn, x);
        pts.push([x, y]);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      } catch {
        // Skip points where the curve is undefined.
      }
    }
    const top = hi * 1.12 || 1;
    return {
      curvePath: pts,
      yMin: Math.min(0, lo),
      yMax: Math.max(top, 0.5),
    };
  }, [fn, domLo, domHi]);

  // Auto-play cursor over the beat sequence (controlled mode supplies `beat`).
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (beat !== undefined) return;
    if (prefersReducedMotion()) {
      setCursor(seq.length - 1);
      return;
    }
    setCursor(0);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    seq.forEach((_, idx) => {
      const id = setTimeout(() => {
        if (!cancelled) setCursor(idx);
      }, idx * BEAT_MS);
      timers.push(id);
    });
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, seq.length, beat]);

  const idx =
    beat !== undefined
      ? Math.max(0, Math.min(beat, seq.length - 1))
      : Math.min(cursor, seq.length - 1);
  const n = Math.max(1, Math.round(seq[idx] ?? seq[seq.length - 1] ?? 1));

  const sx = (x: number) =>
    PAD_L + ((x - domLo) / (domHi - domLo)) * (W - PAD_L - PAD_R);
  const sy = (y: number) =>
    PAD_T + ((yMax - y) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const baseY = sy(0);
  const path = curvePath.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");

  // Midpoint rectangles tiling [a, b] — identical to what the grader sums.
  const w = (b - a) / n;
  const rects = Array.from({ length: n }, (_, i) => {
    const x0 = a + i * w;
    const mid = x0 + w / 2;
    let h = 0;
    try {
      h = evalFunction(fn, mid);
    } catch {
      h = 0;
    }
    const yTop = sy(Math.max(0, h));
    const yBot = sy(Math.min(0, h));
    return {
      x: sx(x0),
      width: Math.max(0, sx(x0 + w) - sx(x0)),
      y: Math.min(yTop, yBot),
      height: Math.abs(yBot - yTop),
    };
  });

  const estimate = riemannSum(fn, a, b, n);
  const close = Math.abs(estimate - trueArea) <= Math.max(0.15, Math.abs(trueArea) * 0.05);

  return (
    <div
      className={`pr-anim${compact ? " pr-anim--compact" : ""}`}
      aria-hidden="true"
    >
      <div className="rr-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth={1} />
          <line x1={PAD_L} y1={baseY} x2={W - PAD_R} y2={baseY} stroke="#cbd5e1" strokeWidth={1} />

          {/* rectangles (re-keyed by n so each refinement fades in) */}
          <g key={n} className="rr-rects">
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="rgba(99,102,241,0.22)"
                stroke="rgba(79,70,229,0.55)"
                strokeWidth={0.75}
              />
            ))}
          </g>

          {/* curve */}
          <polyline points={path} fill="none" stroke="#4338ca" strokeWidth={2} />
        </svg>
      </div>

      <div className="rr-readout">
        <span>
          Rectangles:{" "}
          <span className="rr-num">{n}</span>
        </span>
        <span>
          True area = <span className="rr-num">{trueArea.toFixed(2)}</span>
        </span>
        <span>
          Estimate ≈{" "}
          <span className={`rr-num${close ? " rr-num--close" : ""}`}>
            {estimate.toFixed(2)}
          </span>
        </span>
      </div>
    </div>
  );
}
