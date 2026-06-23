import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { GraphConfig } from "../../types/content";
import { evalFunction, secantSlope, derivativeAt } from "../../lib/feedbackEngine";

interface GraphWidgetProps {
  config: GraphConfig;
  onSliderChange?: (value: number) => void;
  sliderValue?: number;
  /** Hide the slider control (e.g. for tap-the-point questions). */
  showSlider?: boolean;
  /** Called with the x-coordinate when the learner taps the plot. */
  onPointClick?: (x: number) => void;
  /** x-coordinate of the learner's current tap selection, drawn as a marker. */
  selectedX?: number | null;
}

const PAD = 44;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** Format a number for readouts: round to 2 dp and drop trailing zeros. */
function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return String(parseFloat(n.toFixed(2)));
}

/** Pick a "nice" tick spacing (1, 2, 5 x 10^n) for a given range. */
function niceStep(range: number, target = 5): number {
  if (range <= 0) return 1;
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

function ticksFor(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    out.push(Math.abs(v) < 1e-9 ? 0 : parseFloat(v.toFixed(6)));
  }
  return out;
}

export function GraphWidget({
  config,
  onSliderChange,
  sliderValue: controlledSlider,
  showSlider = true,
  onPointClick,
  selectedX,
}: GraphWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(320);
  const [internalSlider, setInternalSlider] = useState(
    config.initialSlider ?? config.sliderMin ?? 1,
  );
  const sliderVal = controlledSlider ?? internalSlider;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      // Only track WIDTH. Deriving height from the measured height would create
      // a feedback loop (svg height -> container grows -> observer fires -> repeat).
      const w = Math.max(entries[0].contentRect.width, 280);
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Height derived from width with a clamped aspect ratio; never from container height.
  const size = { w: width, h: Math.min(Math.max(Math.round(width * 0.7), 200), 320) };

  const setSlider = useCallback(
    (v: number) => {
      setInternalSlider(v);
      onSliderChange?.(v);
    },
    [onSliderChange],
  );

  const [d0, d1] = config.domain;
  const x0 = config.fixedPoint ?? (d0 + d1) / 2;
  const x1 = config.sliderLabel === "h" ? x0 + sliderVal : sliderVal;

  const points: { x: number; y: number }[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const x = d0 + ((d1 - d0) * i) / steps;
    try {
      points.push({ x, y: evalFunction(config.fn, x) });
    } catch {
      /* skip */
    }
  }

  const ys = points.map((p) => p.y);
  const dataMin = ys.length ? Math.min(...ys) : 0;
  const dataMax = ys.length ? Math.max(...ys) : 1;
  // Always include y = 0; pad with a small margin so the curve doesn't touch edges.
  const lo = Math.min(dataMin, 0);
  const hi = Math.max(dataMax, 0);
  const padY = (hi - lo) * 0.08 || 1;
  // Use an explicit y-range when provided; otherwise derive it from the data.
  const yMin = config.yDomain ? config.yDomain[0] : lo - (lo < 0 ? padY : 0);
  const yMax = config.yDomain ? config.yDomain[1] : hi + padY;

  const toSvg = (x: number, y: number) => {
    const sx = PAD + ((x - d0) / (d1 - d0)) * (size.w - 2 * PAD);
    const sy = size.h - PAD - ((y - yMin) / (yMax - yMin)) * (size.h - 2 * PAD);
    return { sx, sy };
  };

  const handlePlotClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPointClick || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const svgX = ratio * size.w;
    let x = d0 + ((svgX - PAD) / (size.w - 2 * PAD)) * (d1 - d0);
    if (config.pointSnap && config.pointSnap > 0) {
      x = parseFloat((Math.round(x / config.pointSnap) * config.pointSnap).toFixed(6));
    }
    onPointClick(clamp(x, d0, d1));
  };

  const pathD = points
    .map((p, i) => {
      const { sx, sy } = toSvg(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    })
    .join(" ");

  // Shaded area under the curve from areaStart to the moving x — the integral
  // visual. The filled region runs along the curve and closes down to the axis.
  const areaStart = config.areaStart ?? d0;
  let areaPathD = "";
  let areaValue = NaN;
  if (config.showArea) {
    const a = clamp(Math.min(areaStart, x1), d0, d1);
    const b = clamp(Math.max(areaStart, x1), d0, d1);
    if (b - a > 1e-6) {
      const n = 96;
      const segs: string[] = [`M ${toSvg(a, 0).sx} ${toSvg(a, 0).sy}`];
      let sum = 0;
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n;
        let y = 0;
        try {
          y = evalFunction(config.fn, x);
        } catch {
          y = 0;
        }
        const p = toSvg(x, y);
        segs.push(`L ${p.sx} ${p.sy}`);
        sum += i === 0 || i === n ? y / 2 : y;
      }
      segs.push(`L ${toSvg(b, 0).sx} ${toSvg(b, 0).sy} Z`);
      areaPathD = segs.join(" ");
      areaValue = sum * ((b - a) / n);
    } else {
      areaValue = 0;
    }
  }

  let y0: number, y1: number;
  try {
    y0 = evalFunction(config.fn, x0);
    y1 = evalFunction(config.fn, x1);
  } catch {
    y0 = 0;
    y1 = 0;
  }

  const p0 = toSvg(x0, y0);
  const p1 = toSvg(x1, y1);

  // The tangent (and its slope readout) tracks the MOVING point. The derivative
  // is well defined everywhere the curve is smooth, so there is no 0/0 case.
  let tangentSlope = NaN;
  if (config.showTangent) {
    try {
      tangentSlope = derivativeAt(config.fn, x1);
    } catch {
      tangentSlope = NaN;
    }
  }

  let slopeDisplay = "—";
  if (config.showTangent) {
    if (Number.isFinite(tangentSlope)) slopeDisplay = tangentSlope.toFixed(2);
  } else if (config.showSecant !== false) {
    try {
      const s = secantSlope(config.fn, x0, x1 - x0);
      if (Number.isFinite(s)) slopeDisplay = s.toFixed(2);
    } catch {
      slopeDisplay = "—";
    }
  }

  // Tangent line drawn in data space (so it scales with the axes) through the
  // moving point, extended across part of the domain.
  const tdx = (d1 - d0) * 0.3;
  const tanA =
    config.showTangent && Number.isFinite(tangentSlope)
      ? toSvg(x1 - tdx, y1 - tangentSlope * tdx)
      : null;
  const tanB =
    config.showTangent && Number.isFinite(tangentSlope)
      ? toSvg(x1 + tdx, y1 + tangentSlope * tdx)
      : null;

  // Marker for a tap-the-point selection.
  let selMarker: { sx: number; sy: number } | null = null;
  if (selectedX !== null && selectedX !== undefined) {
    try {
      selMarker = toSvg(selectedX, evalFunction(config.fn, selectedX));
    } catch {
      selMarker = null;
    }
  }

  const min = config.sliderMin ?? d0 + 0.1;
  const max = config.sliderMax ?? d1 - 0.1;
  const step = config.sliderStep ?? 0.05;

  const xLabel = config.xLabel ?? config.sliderLabel ?? "x";
  const yLabel = config.yLabel ?? "y";

  // Axis origin positions, clamped so the axes stay visible at the edges.
  const originX = clamp(toSvg(0, yMin).sx, PAD, size.w - PAD);
  const originY = clamp(toSvg(d0, 0).sy, PAD, size.h - PAD);

  const xTicks = ticksFor(d0, d1);
  const yTicks = ticksFor(yMin, yMax);

  return (
    <div ref={containerRef} className="w-full min-h-[200px] flex flex-col gap-3">
      <svg
        ref={svgRef}
        width="100%"
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        onClick={onPointClick ? handlePlotClick : undefined}
        className={`rounded-xl bg-slate-50 border border-slate-200${
          onPointClick ? " cursor-crosshair" : ""
        }`}
        role="img"
        aria-label={`Graph of the function with ${xLabel} and ${yLabel} axes`}
      >
        {/* gridlines */}
        {xTicks.map((t) => {
          const sx = toSvg(t, 0).sx;
          return (
            <line
              key={`gx-${t}`}
              x1={sx}
              y1={PAD}
              x2={sx}
              y2={size.h - PAD}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}
        {yTicks.map((t) => {
          const sy = toSvg(d0, t).sy;
          return (
            <line
              key={`gy-${t}`}
              x1={PAD}
              y1={sy}
              x2={size.w - PAD}
              y2={sy}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {/* x-axis */}
        <line
          x1={PAD}
          y1={originY}
          x2={size.w - PAD}
          y2={originY}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />
        {/* y-axis */}
        <line
          x1={originX}
          y1={PAD}
          x2={originX}
          y2={size.h - PAD}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />

        {/* x tick labels */}
        {xTicks.map((t) => {
          const sx = toSvg(t, 0).sx;
          if (t === 0) return null;
          return (
            <text
              key={`tx-${t}`}
              x={sx}
              y={size.h - PAD + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#64748b"
            >
              {t}
            </text>
          );
        })}
        {/* y tick labels */}
        {yTicks.map((t) => {
          const sy = toSvg(d0, t).sy;
          if (t === 0) return null;
          return (
            <text
              key={`ty-${t}`}
              x={PAD - 6}
              y={sy + 3}
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
            >
              {t}
            </text>
          );
        })}

        {/* axis name labels */}
        <text
          x={size.w - PAD + 2}
          y={originY - 6}
          textAnchor="end"
          fontSize={12}
          fontStyle="italic"
          fill="#475569"
        >
          {xLabel}
        </text>
        <text
          x={originX + 6}
          y={PAD - 2}
          textAnchor="start"
          fontSize={12}
          fontStyle="italic"
          fill="#475569"
        >
          {yLabel}
        </text>

        {/* shaded area under the curve (integral visual) */}
        {config.showArea && areaPathD && (
          <path
            d={areaPathD}
            fill="#6366f1"
            fillOpacity={0.2}
            stroke="#6366f1"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        )}

        {/* curve */}
        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth={2.5} />

        {showSlider && config.showSecant !== false && (
          <line
            x1={p0.sx}
            y1={p0.sy}
            x2={p1.sx}
            y2={p1.sy}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}

        {showSlider && tanA && tanB && (
          <line
            x1={tanA.sx}
            y1={tanA.sy}
            x2={tanB.sx}
            y2={tanB.sy}
            stroke="#10b981"
            strokeWidth={2.5}
          />
        )}

        {/* guide lines from the moving point to each axis */}
        {showSlider && (
          <>
            <line
              x1={p1.sx}
              y1={p1.sy}
              x2={p1.sx}
              y2={originY}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <line
              x1={p1.sx}
              y1={p1.sy}
              x2={originX}
              y2={p1.sy}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          </>
        )}

        {showSlider &&
          (config.showTangent ? (
            <circle cx={p1.sx} cy={p1.sy} r={6} fill="#10b981" />
          ) : config.showSecant !== false ? (
            <>
              <circle cx={p0.sx} cy={p0.sy} r={6} fill="#4f46e5" />
              <circle cx={p1.sx} cy={p1.sy} r={6} fill="#f59e0b" />
            </>
          ) : (
            <circle cx={p1.sx} cy={p1.sy} r={6} fill="#4f46e5" />
          ))}

        {/* tap-the-point selection marker */}
        {selMarker && (
          <>
            <line
              x1={selMarker.sx}
              y1={PAD}
              x2={selMarker.sx}
              y2={size.h - PAD}
              stroke="#e11d48"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <circle
              cx={selMarker.sx}
              cy={selMarker.sy}
              r={7}
              fill="#e11d48"
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {showSlider && (
        <div className="flex items-center gap-3 px-1">
          <label className="text-sm font-medium text-slate-600 shrink-0">
            {config.sliderLabel ?? "x"} = {sliderVal.toFixed(2)}
          </label>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliderVal}
            onChange={(e) => setSlider(parseFloat(e.target.value))}
            className="flex-1 h-11 min-h-[44px] accent-indigo-600 cursor-pointer"
            aria-label={`Adjust ${config.sliderLabel ?? "x"}`}
          />
        </div>
      )}

      {showSlider && config.showValue !== false && Number.isFinite(y1) && (
        <p className="text-sm text-slate-600 font-mono">
          {yLabel}({fmtNum(x1)}) = <strong>{fmtNum(y1)}</strong>
        </p>
      )}

      {showSlider && (config.showSecant !== false || config.showTangent) && (
        <p className="text-sm text-slate-600">
          {config.slopeLabel ??
            (config.showTangent ? "Tangent slope" : "Secant slope")}
          : <strong>{slopeDisplay}</strong>
        </p>
      )}

      {showSlider &&
        config.showArea &&
        config.showAreaValue !== false &&
        Number.isFinite(areaValue) && (
          <p className="text-sm text-slate-600">
            {config.areaLabel ?? "Shaded area"} ≈{" "}
            <strong>{fmtNum(areaValue)}</strong>
          </p>
        )}
    </div>
  );
}
