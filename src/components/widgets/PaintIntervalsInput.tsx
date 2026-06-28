import {
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PaintIntervalsAnswer } from "../../types/content";
import {
  autoRange,
  clientToData,
  fmtNum,
  makeToSvg,
  sampleCurve,
  ticksFor,
  type PlotBox,
} from "./plotGeometry";

interface PaintIntervalsInputProps {
  spec: PaintIntervalsAnswer;
  /** Shaded state per segment (seeded all-false by the player). */
  value: boolean[] | undefined;
  onChange: (value: boolean[]) => void;
  disabled?: boolean;
  /** When true, color each segment by correctness (incl. missed segments). */
  reveal?: boolean;
  isCorrect?: boolean;
}

const W = 340;
const H = 240;
const PAD = 32;

/**
 * "Paint the intervals": the learner drags across the plot to brush segments on
 * or off — e.g. shading every stretch where f is increasing. Each pointer-down
 * toggles the segment under it and sets the brush mode (paint vs. erase) for the
 * rest of the drag, so a single stroke can shade several adjacent segments.
 */
export function PaintIntervalsInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
}: PaintIntervalsInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const painting = useRef(false);
  const paintVal = useRef(true);
  const clipId = `paint-clip-${useId().replace(/:/g, "")}`;

  const [d0, d1] = spec.domain;
  const curve = sampleCurve(spec.fn, d0, d1);
  const [yLo, yHi] = autoRange(curve.map((p) => p.y), spec.yDomain);
  const box: PlotBox = {
    domain: spec.domain,
    range: [yLo, yHi],
    width: W,
    height: H,
    pad: PAD,
  };
  const toSvg = makeToSvg(box);

  const edges = [d0, ...spec.breakpoints, d1];
  const segCount = edges.length - 1;
  const selected = spec.correct.map((_, i) => Boolean(value?.[i]));

  const interactive = !disabled && !reveal;

  const segAt = (clientX: number): number | null => {
    if (!svgRef.current) return null;
    const { x } = clientToData(svgRef.current, clientX, 0, box);
    for (let i = 0; i < segCount; i++) {
      if (x >= edges[i] && x <= edges[i + 1]) return i;
    }
    return null;
  };

  const paintSeg = (i: number, val: boolean) => {
    if (selected[i] === val) return;
    const next = selected.slice();
    next[i] = val;
    onChange(next);
  };

  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const i = segAt(e.clientX);
    if (i === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    painting.current = true;
    paintVal.current = !selected[i];
    paintSeg(i, paintVal.current);
  };
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || !painting.current) return;
    const i = segAt(e.clientX);
    if (i === null) return;
    e.preventDefault();
    paintSeg(i, paintVal.current);
  };
  const handleUp = () => {
    painting.current = false;
  };

  const originY = Math.min(Math.max(toSvg(d0, 0).sy, PAD), H - PAD);
  const xTicks = ticksFor(d0, d1);

  const curvePath = curve
    .map((p, i) => {
      const { sx, sy } = toSvg(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    })
    .join(" ");

  // Resolve a segment's band styling: plain shading while answering, and
  // correctness coloring on reveal (including a dashed red band for a segment
  // that should have been shaded but wasn't).
  const bandStyle = (
    i: number,
  ): { fill: string; opacity: number; dashed: boolean } | null => {
    const sel = selected[i];
    if (!reveal) return sel ? { fill: "#6366f1", opacity: 0.18, dashed: false } : null;
    const want = spec.correct[i];
    if (sel && want) return { fill: "#10b981", opacity: 0.22, dashed: false };
    if (sel && !want) return { fill: "#e11d48", opacity: 0.22, dashed: false };
    if (!sel && want) return { fill: "#e11d48", opacity: 0.12, dashed: true };
    return null;
  };

  const xLabel = spec.xLabel ?? "x";
  const yLabel = spec.yLabel ?? "y";

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full select-none touch-none ${interactive ? "cursor-pointer" : ""}`}
          style={{ touchAction: "none" }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          role="img"
          aria-label="Drag across the plot to shade intervals"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
            </clipPath>
          </defs>

          {/* segment bands */}
          {Array.from({ length: segCount }, (_, i) => {
            const style = bandStyle(i);
            if (!style) return null;
            const x = toSvg(edges[i], 0).sx;
            const w = toSvg(edges[i + 1], 0).sx - x;
            return (
              <rect
                key={`band-${i}`}
                x={x}
                y={PAD}
                width={w}
                height={H - 2 * PAD}
                fill={style.fill}
                fillOpacity={style.opacity}
                stroke={style.dashed ? style.fill : "none"}
                strokeWidth={style.dashed ? 1.5 : 0}
                strokeDasharray={style.dashed ? "5 4" : undefined}
              />
            );
          })}

          {/* breakpoint dividers */}
          {spec.breakpoints.map((b) => (
            <line
              key={`bp-${b}`}
              x1={toSvg(b, 0).sx}
              y1={PAD}
              x2={toSvg(b, 0).sx}
              y2={H - PAD}
              stroke="#cbd5e1"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ))}

          {/* x-axis */}
          <line x1={PAD} y1={originY} x2={W - PAD} y2={originY} stroke="#94a3b8" strokeWidth={1.5} />

          {/* tick labels */}
          {xTicks.map((t) =>
            t === 0 ? null : (
              <text key={`tx-${t}`} x={toSvg(t, 0).sx} y={H - PAD + 13} textAnchor="middle" fontSize={9} fill="#64748b">
                {t}
              </text>
            ),
          )}
          <text x={W - PAD + 1} y={originY - 5} textAnchor="end" fontSize={11} fontStyle="italic" fill="#475569">
            {xLabel}
          </text>
          <text x={PAD - 3} y={PAD - 3} textAnchor="start" fontSize={11} fontStyle="italic" fill="#475569">
            {yLabel}
          </text>

          {/* curve */}
          <path d={curvePath} fill="none" stroke="#4f46e5" strokeWidth={2.5} clipPath={`url(#${clipId})`} />
        </svg>
      </div>
      <p className="text-center text-xs text-slate-500">
        {spec.prompt ?? "Drag across the plot to shade the matching intervals."}
        {!reveal && (
          <span className="text-slate-400">
            {" "}
            (x from {fmtNum(d0)} to {fmtNum(d1)})
          </span>
        )}
      </p>
    </div>
  );
}
