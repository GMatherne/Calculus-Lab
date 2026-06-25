import { useMemo } from "react";
import type { RiemannAnswer } from "../../types/content";
import { evalFunction, riemannSum } from "../../lib/feedbackEngine";

interface RiemannInputProps {
  spec: RiemannAnswer;
  /** Current rectangle count n (seeded to 1 by the player). */
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** When true, color the estimate readout by correctness. */
  reveal?: boolean;
  isCorrect?: boolean;
}

const W = 340;
const H = 230;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

/**
 * Interactive Riemann sum: the learner drags a slider to lay down more midpoint
 * rectangles under a curve and watches the estimate close in on the true area.
 * It makes "the integral is a limit of rectangle sums" something you do with your
 * thumb — the picture, the running estimate, and the grader all share one sum, so
 * what you see is exactly what gets checked.
 */
export function RiemannInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: RiemannInputProps) {
  const n = Math.max(1, Math.round(value ?? 1));
  const maxRects = spec.maxRects ?? 40;
  const [domLo, domHi] = spec.domain ?? [spec.a, spec.b];

  // Sample the curve once per spec for the outline and to auto-scale the y-axis.
  const { points, yMin, yMax } = useMemo(() => {
    const pts: Array<[number, number]> = [];
    let lo = 0;
    let hi = 0;
    const N = 140;
    for (let i = 0; i <= N; i++) {
      const x = domLo + ((domHi - domLo) * i) / N;
      try {
        const y = evalFunction(spec.fn, x);
        pts.push([x, y]);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      } catch {
        // Skip points where the curve is undefined.
      }
    }
    const top = spec.yMax ?? (hi * 1.12 || 1);
    return { points: pts, yMin: Math.min(0, lo), yMax: Math.max(top, 0.5) };
  }, [spec.fn, domLo, domHi, spec.yMax]);

  const sx = (x: number) =>
    PAD_L + ((x - domLo) / (domHi - domLo)) * (W - PAD_L - PAD_R);
  const sy = (y: number) =>
    PAD_T + ((yMax - y) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const baseY = sy(0);
  const curvePath = points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");

  // Midpoint rectangles tiling [a, b] — identical to what the grader sums.
  const w = (spec.b - spec.a) / n;
  const rects = Array.from({ length: n }, (_, i) => {
    const x0 = spec.a + i * w;
    const mid = x0 + w / 2;
    let h = 0;
    try {
      h = evalFunction(spec.fn, mid);
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

  const estimate = riemannSum(spec.fn, spec.a, spec.b, n);
  const within = Math.abs(estimate - spec.trueArea) <= spec.targetWithin;

  let estimateCls = "text-slate-900";
  if (reveal) estimateCls = isCorrect ? "text-emerald-700" : "text-rose-700";
  else if (within) estimateCls = "text-emerald-700";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Curve with ${n} rectangles approximating the area`}
        >
          {/* axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth={1} />
          <line x1={PAD_L} y1={baseY} x2={W - PAD_R} y2={baseY} stroke="#cbd5e1" strokeWidth={1} />

          {/* rectangles */}
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

          {/* curve */}
          <polyline points={curvePath} fill="none" stroke="#4338ca" strokeWidth={2} />

          {/* interval endpoints */}
          <line x1={sx(spec.a)} y1={baseY - 4} x2={sx(spec.a)} y2={baseY + 4} stroke="#475569" strokeWidth={1.5} />
          <line x1={sx(spec.b)} y1={baseY - 4} x2={sx(spec.b)} y2={baseY + 4} stroke="#475569" strokeWidth={1.5} />
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rectangles
        </span>
        <input
          type="range"
          min={1}
          max={maxRects}
          step={1}
          value={n}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
          aria-label="Number of rectangles"
        />
        <span className="w-8 text-center text-lg font-bold tabular-nums text-slate-900">
          {n}
        </span>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <span className="text-slate-600">
          True area ={" "}
          <span className="font-semibold text-slate-900 tabular-nums">
            {spec.trueArea.toFixed(2)}
          </span>
        </span>
        <span className="text-slate-600">
          Estimate ≈{" "}
          <span className={`font-bold tabular-nums ${estimateCls}`}>
            {estimate.toFixed(2)}
          </span>
        </span>
      </div>
    </div>
  );
}
