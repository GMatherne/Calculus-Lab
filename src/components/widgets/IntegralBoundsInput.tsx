import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { IntegralBoundsAnswer } from "../../types/content";
import { evalFunction } from "../../lib/feedbackEngine";
import { MathBlock } from "./MathBlock";
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

interface IntegralBoundsValue {
  a?: number;
  b?: number;
}

interface IntegralBoundsInputProps {
  spec: IntegralBoundsAnswer;
  value: IntegralBoundsValue | undefined;
  onChange: (value: { a: number; b: number }) => void;
  disabled?: boolean;
  reveal?: boolean;
  isCorrect?: boolean;
}

const W = 340;
const H = 250;
const PAD = 32;

/**
 * "Set the bounds": two vertical handles the learner drags to place the limits a
 * and b of a definite integral. The area between them shades live and the running
 * value updates, so the bounds and the integral they define stay tied together.
 */
export function IntegralBoundsInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: IntegralBoundsInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<"a" | "b" | null>(null);
  const clipId = `int-clip-${useId().replace(/:/g, "")}`;

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

  const span = d1 - d0;
  const a = Number.isFinite(Number(value?.a)) ? Number(value?.a) : d0 + span * 0.3;
  const b = Number.isFinite(Number(value?.b)) ? Number(value?.b) : d0 + span * 0.6;

  const interactive = !disabled && !reveal;

  const setBound = (which: "a" | "b", xData: number) => {
    const x = clamp(xData, d0, d1);
    const next = { a, b };
    next[which] = parseFloat(x.toFixed(3));
    onChange(next);
  };
  const pickHandle = (clientX: number): "a" | "b" => {
    if (!svgRef.current) return "a";
    const { x } = clientToData(svgRef.current, clientX, 0, box);
    return Math.abs(x - a) <= Math.abs(x - b) ? "a" : "b";
  };

  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || !svgRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const which = pickHandle(e.clientX);
    setActive(which);
    const { x } = clientToData(svgRef.current, e.clientX, 0, box);
    setBound(which, x);
  };
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || active === null || !svgRef.current) return;
    e.preventDefault();
    const { x } = clientToData(svgRef.current, e.clientX, 0, box);
    setBound(active, x);
  };
  const handleUp = () => setActive(null);

  // Shaded area between the two bounds (closed down to the axis), plus its value.
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let areaPath = "";
  let area = 0;
  if (hi - lo > 1e-6) {
    const n = 80;
    const segs: string[] = [`M ${toSvg(lo, 0).sx} ${toSvg(lo, 0).sy}`];
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      let y = 0;
      try {
        y = evalFunction(spec.fn, x);
      } catch {
        y = 0;
      }
      const p = toSvg(x, y);
      segs.push(`L ${p.sx} ${p.sy}`);
      sum += i === 0 || i === n ? y / 2 : y;
    }
    segs.push(`L ${toSvg(hi, 0).sx} ${toSvg(hi, 0).sy} Z`);
    areaPath = segs.join(" ");
    area = sum * ((hi - lo) / n);
  }

  const handleColor = reveal ? (isCorrect ? "#10b981" : "#e11d48") : "#f59e0b";
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

  const aSvg = toSvg(a, 0).sx;
  const bSvg = toSvg(b, 0).sx;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full select-none touch-none ${
            interactive ? (active ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          role="img"
          aria-label="Drag the two handles to set the integration bounds"
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

          {/* shaded area between the bounds */}
          {areaPath && (
            <path d={areaPath} fill="#6366f1" fillOpacity={0.22} stroke="#6366f1" strokeOpacity={0.4} strokeWidth={1} clipPath={`url(#${clipId})`} />
          )}

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

          {/* bound handles */}
          {(
            [
              { key: "a" as const, sx: aSvg, label: "a" },
              { key: "b" as const, sx: bSvg, label: "b" },
            ]
          ).map(({ key, sx, label }) => (
            <g key={key}>
              <line x1={sx} y1={PAD} x2={sx} y2={H - PAD} stroke={handleColor} strokeWidth={2} />
              <circle cx={sx} cy={originY} r={9} fill={handleColor} stroke="#fff" strokeWidth={2.5} />
              <text x={sx} y={PAD - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={handleColor}>
                {label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="text-center text-sm text-slate-600">
        <MathBlock latex={`\\int_{${fmtNum(lo)}}^{${fmtNum(hi)}} ${spec.fn.replace(/\*/g, " \\cdot ")}\\,dx`} />
        {spec.showAreaValue !== false && (
          <p className="font-mono">
            area ≈ <strong>{fmtNum(area)}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
