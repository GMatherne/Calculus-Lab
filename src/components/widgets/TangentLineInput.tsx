import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TangentLineAnswer } from "../../types/content";
import { evalFunction } from "../../lib/feedbackEngine";
import {
  autoRange,
  clamp,
  clientToData,
  fmtNum,
  makeToSvg,
  sampleCurve,
  ticksFor,
  type PlotBox,
} from "./plotGeometry";

interface TangentLineInputProps {
  spec: TangentLineAnswer;
  /** The line's current slope (seeded to 0 by the player). */
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  reveal?: boolean;
  isCorrect?: boolean;
}

const W = 340;
const H = 250;
const PAD = 32;

/**
 * "Rotate the tangent": a line is pinned to the curve at (x0, f(x0)) and the
 * learner drags anywhere to swing it about that pivot, setting its slope from the
 * angle between the pivot and the pointer. On reveal the true tangent is drawn in
 * green so a near miss is easy to see.
 */
export function TangentLineInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: TangentLineInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const clipId = `tan-clip-${useId().replace(/:/g, "")}`;

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

  let y0 = 0;
  try {
    y0 = evalFunction(spec.fn, spec.x0);
  } catch {
    y0 = 0;
  }
  const slope = typeof value === "number" && Number.isFinite(value) ? value : 0;

  const interactive = !disabled && !reveal;
  const minGapX = (d1 - d0) * 0.04;

  const rotateTo = (clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const { x, y } = clientToData(svgRef.current, clientX, clientY, box);
    const dx = x - spec.x0;
    // Ignore the near-vertical zone around the pivot so the slope can't blow up.
    if (Math.abs(dx) < minGapX) return;
    onChange(parseFloat(((y - y0) / dx).toFixed(3)));
  };

  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    rotateTo(e.clientX, e.clientY);
  };
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || !dragging) return;
    e.preventDefault();
    rotateTo(e.clientX, e.clientY);
  };
  const handleUp = () => setDragging(false);

  const lineAt = (m: number) => ({
    A: toSvg(d0, y0 + m * (d0 - spec.x0)),
    B: toSvg(d1, y0 + m * (d1 - spec.x0)),
  });
  const learner = lineAt(slope);
  const truth = reveal ? lineAt(spec.slope) : null;
  const pivot = toSvg(spec.x0, y0);
  const hx = spec.x0 + (d1 - d0) * 0.28;
  const handle = toSvg(hx, y0 + slope * (hx - spec.x0));

  const lineColor = reveal ? (isCorrect ? "#10b981" : "#e11d48") : "#4338ca";

  const originX = clamp(toSvg(0, yLo).sx, PAD, W - PAD);
  const originY = clamp(toSvg(d0, 0).sy, PAD, H - PAD);
  const xTicks = ticksFor(d0, d1);
  const yTicks = ticksFor(yLo, yHi);
  const curvePath = curve
    .map((p, i) => {
      const { sx, sy } = toSvg(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    })
    .join(" ");

  const xLabel = spec.xLabel ?? "x";
  const yLabel = spec.yLabel ?? "y";

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full select-none touch-none ${
            interactive ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          role="img"
          aria-label="Drag to rotate the line until it is tangent to the curve"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
            </clipPath>
          </defs>

          {/* gridlines */}
          {xTicks.map((t) => (
            <line key={`gx-${t}`} x1={toSvg(t, 0).sx} y1={PAD} x2={toSvg(t, 0).sx} y2={H - PAD} stroke="#eef2f7" strokeWidth={1} />
          ))}
          {yTicks.map((t) => (
            <line key={`gy-${t}`} x1={PAD} y1={toSvg(d0, t).sy} x2={W - PAD} y2={toSvg(d0, t).sy} stroke="#eef2f7" strokeWidth={1} />
          ))}

          {/* axes */}
          <line x1={PAD} y1={originY} x2={W - PAD} y2={originY} stroke="#94a3b8" strokeWidth={1.5} />
          <line x1={originX} y1={PAD} x2={originX} y2={H - PAD} stroke="#94a3b8" strokeWidth={1.5} />

          {/* tick labels */}
          {xTicks.map((t) =>
            t === 0 ? null : (
              <text key={`tx-${t}`} x={toSvg(t, 0).sx} y={H - PAD + 13} textAnchor="middle" fontSize={9} fill="#64748b">
                {t}
              </text>
            ),
          )}
          {yTicks.map((t) =>
            t === 0 ? null : (
              <text key={`ty-${t}`} x={PAD - 5} y={toSvg(d0, t).sy + 3} textAnchor="end" fontSize={9} fill="#64748b">
                {t}
              </text>
            ),
          )}
          <text x={W - PAD + 1} y={originY - 5} textAnchor="end" fontSize={11} fontStyle="italic" fill="#475569">
            {xLabel}
          </text>
          <text x={originX + 5} y={PAD - 3} textAnchor="start" fontSize={11} fontStyle="italic" fill="#475569">
            {yLabel}
          </text>

          {/* curve */}
          <path d={curvePath} fill="none" stroke="#4f46e5" strokeWidth={2.5} clipPath={`url(#${clipId})`} />

          {/* true tangent on reveal */}
          {truth && (
            <line x1={truth.A.sx} y1={truth.A.sy} x2={truth.B.sx} y2={truth.B.sy} stroke="#10b981" strokeWidth={2} strokeDasharray="6 4" clipPath={`url(#${clipId})`} />
          )}

          {/* learner's line */}
          <line x1={learner.A.sx} y1={learner.A.sy} x2={learner.B.sx} y2={learner.B.sy} stroke={lineColor} strokeWidth={2.5} clipPath={`url(#${clipId})`} />

          {/* pivot (fixed) */}
          <circle cx={pivot.sx} cy={pivot.sy} r={6} fill="#1e293b" />

          {/* drag handle */}
          {interactive && (
            <>
              <circle cx={handle.sx} cy={handle.sy} r={13} fill={lineColor} fillOpacity={0.15} />
              <circle cx={handle.sx} cy={handle.sy} r={7} fill={lineColor} stroke="#fff" strokeWidth={2.5} />
            </>
          )}
        </svg>
      </div>
      <p className="text-center text-sm text-slate-600 font-mono">
        Slope = <strong>{fmtNum(slope)}</strong>
        {reveal && (
          <span className="text-slate-500">
            {"  ·  actual "}
            {spec.xLabel ? "slope" : "f′(" + fmtNum(spec.x0) + ")"} = {fmtNum(spec.slope)}
          </span>
        )}
      </p>
    </div>
  );
}
