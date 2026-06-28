import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ConstructGraphAnswer } from "../../types/content";
import { evalFunction } from "../../lib/feedbackEngine";
import {
  clamp,
  clientToData,
  makeToSvg,
  sampleCurve,
  ticksFor,
  ticksForStep,
  type PlotBox,
} from "./plotGeometry";

interface ConstructGraphInputProps {
  spec: ConstructGraphAnswer;
  /** Chosen y per node (null until first moved). Seeded to the x-axis by the player. */
  value: (number | null)[] | undefined;
  onChange: (value: (number | null)[]) => void;
  disabled?: boolean;
  /** When true, color each node by its correctness and reveal the target curve. */
  reveal?: boolean;
  isCorrect?: boolean;
}

const W = 340;
const H = 250;
const PAD = 32;

/**
 * "Construct the graph": the learner drags a row of points — each fixed in x,
 * free in y — to build a curve, e.g. plotting f'(x) at sample x-values. The
 * points connect into a live polyline so the shape emerges under their finger;
 * on reveal, each node turns green/red and the intended curve is drawn behind it.
 */
export function ConstructGraphInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
}: ConstructGraphInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const clipId = `cg-clip-${useId().replace(/:/g, "")}`;

  const [d0, d1] = spec.domain;
  const [yLo, yHi] = spec.yDomain;
  const box: PlotBox = {
    domain: spec.domain,
    range: spec.yDomain,
    width: W,
    height: H,
    pad: PAD,
  };
  const toSvg = makeToSvg(box);

  // Resolve each node's current y, defaulting unmoved nodes to the x-axis.
  const baseline = clamp(0, yLo, yHi);
  const ys = spec.nodes.map((_, i) => {
    const v = value?.[i];
    return typeof v === "number" && Number.isFinite(v) ? v : baseline;
  });

  const targetFor = (i: number): number => {
    try {
      return spec.targetFn !== undefined
        ? evalFunction(spec.targetFn, spec.nodes[i].x)
        : spec.targetY?.[i] ?? NaN;
    } catch {
      return NaN;
    }
  };
  const nodeCorrect = (i: number): boolean => {
    const t = targetFor(i);
    const tol = spec.nodes[i].tolerance ?? 0.4;
    return Number.isFinite(t) && Math.abs(ys[i] - t) <= tol;
  };

  const updateNode = (i: number, dataY: number) => {
    let y = clamp(dataY, yLo, yHi);
    if (spec.snap && spec.snap > 0) y = Math.round(y / spec.snap) * spec.snap;
    const next: (number | null)[] = [...ys];
    next[i] = parseFloat(y.toFixed(4));
    onChange(next);
  };

  const nearestNode = (clientX: number): number => {
    if (!svgRef.current) return 0;
    const { x } = clientToData(svgRef.current, clientX, 0, box);
    let best = 0;
    let bestDist = Infinity;
    spec.nodes.forEach((n, i) => {
      const dist = Math.abs(n.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const interactive = !disabled && !reveal;

  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || !svgRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const i = nearestNode(e.clientX);
    setActive(i);
    const { y } = clientToData(svgRef.current, e.clientX, e.clientY, box);
    updateNode(i, y);
  };
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (active === null || !interactive || !svgRef.current) return;
    e.preventDefault();
    const { y } = clientToData(svgRef.current, e.clientX, e.clientY, box);
    updateNode(active, y);
  };
  const handleUp = () => setActive(null);

  const originX = clamp(toSvg(0, yLo).sx, PAD, W - PAD);
  const originY = clamp(toSvg(d0, 0).sy, PAD, H - PAD);
  const xTicks = spec.xTickStep ? ticksForStep(d0, d1, spec.xTickStep) : ticksFor(d0, d1);
  const yTicks = spec.yTickStep ? ticksForStep(yLo, yHi, spec.yTickStep) : ticksFor(yLo, yHi);

  const toPath = (pts: { x: number; y: number }[]): string =>
    pts
      .map((p, i) => {
        const { sx, sy } = toSvg(p.x, p.y);
        return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
      })
      .join(" ");

  const refPath = spec.referenceFn ? toPath(sampleCurve(spec.referenceFn, d0, d1)) : "";
  const connect = spec.connect !== false;
  const polyPath = toPath(spec.nodes.map((n, i) => ({ x: n.x, y: ys[i] })));

  // On reveal, draw the intended curve behind the nodes.
  const revealPath = reveal
    ? spec.targetFn
      ? toPath(sampleCurve(spec.targetFn, d0, d1))
      : spec.targetY
        ? toPath(spec.nodes.map((n, i) => ({ x: n.x, y: spec.targetY![i] })))
        : ""
    : "";

  const xLabel = spec.xLabel ?? "x";
  const yLabel = spec.yLabel ?? "y";

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full select-none touch-none ${
            interactive ? (active !== null ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          role="img"
          aria-label="Drag the points to build the graph"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
            </clipPath>
          </defs>

          {/* gridlines */}
          {xTicks.map((t) => (
            <line
              key={`gx-${t}`}
              x1={toSvg(t, 0).sx}
              y1={PAD}
              x2={toSvg(t, 0).sx}
              y2={H - PAD}
              stroke="#eef2f7"
              strokeWidth={1}
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={PAD}
              y1={toSvg(d0, t).sy}
              x2={W - PAD}
              y2={toSvg(d0, t).sy}
              stroke="#eef2f7"
              strokeWidth={1}
            />
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

          {/* faint reference curve */}
          {refPath && (
            <path
              d={refPath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.6}
              clipPath={`url(#${clipId})`}
            />
          )}

          {/* intended target curve, shown on reveal */}
          {revealPath && (
            <path
              d={revealPath}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="6 4"
              clipPath={`url(#${clipId})`}
            />
          )}

          {/* learner's connecting polyline */}
          {connect && spec.nodes.length > 1 && (
            <path d={polyPath} fill="none" stroke="#6366f1" strokeWidth={2.5} clipPath={`url(#${clipId})`} />
          )}

          {/* draggable nodes */}
          {spec.nodes.map((n, i) => {
            const { sx, sy } = toSvg(n.x, ys[i]);
            let fill = "#4f46e5";
            if (reveal) fill = nodeCorrect(i) ? "#10b981" : "#e11d48";
            else if (active === i) fill = "#4338ca";
            return (
              <g key={`node-${i}`}>
                <line x1={sx} y1={sy} x2={sx} y2={originY} stroke={fill} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
                <circle cx={sx} cy={sy} r={13} fill={fill} fillOpacity={0.14} />
                <circle cx={sx} cy={sy} r={8} fill={fill} stroke="#fff" strokeWidth={2.5} />
              </g>
            );
          })}
        </svg>
      </div>
      {!reveal && (
        <p className="text-center text-xs text-slate-500">
          Drag each point up or down to plot the curve.
        </p>
      )}
    </div>
  );
}
