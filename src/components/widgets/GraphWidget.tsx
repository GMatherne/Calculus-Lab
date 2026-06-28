import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { GraphConfig } from "../../types/content";
import { evalFunction, secantSlope, derivativeAt } from "../../lib/feedbackEngine";
import { MathBlock } from "./MathBlock";
import { clamp, fmtNum, makeToSvg, ticksFor } from "./plotGeometry";

/** A reveal overlay for a committed prediction: the true feature at `x`. */
export interface GraphReveal {
  x: number;
  /** Draw a dot at (x, f(x)). Defaults to true. */
  point?: boolean;
  /** Draw the tangent line at x. */
  tangent?: boolean;
  /** Draw a dashed vertical guide at x. */
  vertical?: boolean;
}

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
  /** Force the satisfied (green) styling on the moving point, e.g. on live-confirm. */
  satisfied?: boolean;
  /** Allow dragging a marker along the curve (predict_point steps). */
  draggablePoint?: boolean;
  /**
   * Explore mode: let the learner drag the moving (slider) point directly along
   * the curve, in addition to the range slider, so they can scrub the
   * tangent/secant readout by dragging the plot. Purely exploratory — it moves
   * the same value the slider does and never grades. Used by `graph.explore`
   * steps whose graded answer is a separate multiple_choice/numeric.
   */
  exploreDrag?: boolean;
  /** Current x of the draggable predict marker. */
  predictX?: number | null;
  /** Called with the x as the learner drags the predict marker. */
  onPredictDrag?: (x: number) => void;
  /** After a committed prediction, draw the true feature here (animated). */
  reveal?: GraphReveal | null;
}

const PAD = 44;

/**
 * Substitute the current x into a slope label written in function notation
 * (e.g. "f ′(x)") so the readout tracks the slider, matching the f(x) readout.
 * Plain descriptive labels like "Tangent slope" contain no standalone variable
 * and are returned unchanged.
 */
function withCurrentX(label: string, varName: string, xStr: string): string {
  if (!varName) return label;
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return label.replace(new RegExp(`\\b${escaped}\\b`, "g"), () => xStr);
}

export function GraphWidget({
  config,
  onSliderChange,
  sliderValue: controlledSlider,
  showSlider = true,
  onPointClick,
  selectedX,
  satisfied,
  draggablePoint,
  exploreDrag,
  predictX,
  onPredictDrag,
  reveal,
}: GraphWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  // Unique id for the plot-area clip path (sanitized: useId() contains colons,
  // which aren't valid in a url(#…) reference).
  const clipId = `plot-clip-${useId().replace(/:/g, "")}`;
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

  // Optionally sample the derivative f'(x) across the domain so it can be drawn
  // as a second curve. Its values feed into the y-range below so the overlay
  // stays contained — unless an explicit yDomain is set, in which case steep
  // parts of f' are clipped to the plot box instead of squashing f.
  const derivativePoints: { x: number; y: number }[] = [];
  if (config.showDerivative) {
    for (let i = 0; i <= steps; i++) {
      const x = d0 + ((d1 - d0) * i) / steps;
      try {
        derivativePoints.push({ x, y: derivativeAt(config.fn, x) });
      } catch {
        /* skip */
      }
    }
  }

  const ys = points.map((p) => p.y);
  const allYs = ys.concat(derivativePoints.map((p) => p.y));
  const dataMin = allYs.length ? Math.min(...allYs) : 0;
  const dataMax = allYs.length ? Math.max(...allYs) : 1;
  // Always include y = 0; pad with a small margin so the curve doesn't touch edges.
  const lo = Math.min(dataMin, 0);
  const hi = Math.max(dataMax, 0);
  const padY = (hi - lo) * 0.08 || 1;
  // Use an explicit y-range when provided; otherwise derive it from the data.
  const yMin = config.yDomain ? config.yDomain[0] : lo - (lo < 0 ? padY : 0);
  const yMax = config.yDomain ? config.yDomain[1] : hi + padY;

  const toSvg = makeToSvg({
    domain: [d0, d1],
    range: [yMin, yMax],
    width: size.w,
    height: size.h,
    pad: PAD,
  });

  // Map a pointer's screen x to a clamped data x, shared by tap-the-point clicks
  // and the draggable predict marker.
  const dataXFromClient = (clientX: number): number => {
    if (!svgRef.current) return x1;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const svgX = ratio * size.w;
    const x = d0 + ((svgX - PAD) / (size.w - 2 * PAD)) * (d1 - d0);
    return clamp(x, d0, d1);
  };

  const handlePlotClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPointClick || !svgRef.current) return;
    let x = dataXFromClient(e.clientX);
    const choices = config.pointChoices;
    if (choices && choices.length > 0) {
      // Snap to the nearest discrete candidate so the answer is always exact.
      const nearest = choices.reduce((best, c) =>
        Math.abs(c - x) < Math.abs(best - x) ? c : best,
      );
      onPointClick(nearest);
      return;
    }
    if (config.pointSnap && config.pointSnap > 0) {
      x = parseFloat((Math.round(x / config.pointSnap) * config.pointSnap).toFixed(6));
    }
    onPointClick(x);
  };

  // Drag handlers for the predict marker. Pointer capture keeps the drag tracking
  // even if the finger/cursor slips off the plot; `touch-action: none` on the svg
  // stops the page from scrolling mid-drag.
  const handlePredictDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggablePoint || !onPredictDrag) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    onPredictDrag(dataXFromClient(e.clientX));
  };
  const handlePredictMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging || !draggablePoint || !onPredictDrag) return;
    e.preventDefault();
    onPredictDrag(dataXFromClient(e.clientX));
  };
  const handlePredictUp = () => {
    if (dragging) setDragging(false);
  };

  // Explore-drag handlers slide the moving point along the curve directly, so the
  // learner can scrub the tangent/secant readout by dragging the plot. They drive
  // the slider value (which also fires onSliderChange) and never grade anything.
  const handleExploreDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!exploreDrag) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setSlider(dataXFromClient(e.clientX));
  };
  const handleExploreMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging || !exploreDrag) return;
    e.preventDefault();
    setSlider(dataXFromClient(e.clientX));
  };

  const pathD = points
    .map((p, i) => {
      const { sx, sy } = toSvg(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    })
    .join(" ");

  const derivativePathD = config.showDerivative
    ? derivativePoints
        .map((p, i) => {
          const { sx, sy } = toSvg(p.x, p.y);
          return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
        })
        .join(" ")
    : "";

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

  // The tangent normally tracks the MOVING point, but in `tangentAtFixedPoint`
  // mode it stays anchored at the fixed point as a static target the sliding
  // secant converges onto. The derivative is well defined everywhere the curve
  // is smooth, so there is no 0/0 case.
  const tangentAtFixed = config.tangentAtFixedPoint === true;
  const showTangentLine = Boolean(config.showTangent) || tangentAtFixed;
  const tanX = tangentAtFixed ? x0 : x1;
  const tanY = tangentAtFixed ? y0 : y1;
  let tangentSlope = NaN;
  if (showTangentLine) {
    try {
      tangentSlope = derivativeAt(config.fn, tanX);
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
    showTangentLine && Number.isFinite(tangentSlope)
      ? toSvg(tanX - tdx, tanY - tangentSlope * tdx)
      : null;
  const tanB =
    showTangentLine && Number.isFinite(tangentSlope)
      ? toSvg(tanX + tdx, tanY + tangentSlope * tdx)
      : null;

  // Secant line through (x0, y0) and (x1, y1), extended across the whole domain
  // so it stays a clearly visible line — even as h → 0, where the bare chord
  // between the two points would otherwise shrink to almost nothing.
  const secSlope = x1 !== x0 ? (y1 - y0) / (x1 - x0) : NaN;
  const secA =
    config.showSecant !== false && Number.isFinite(secSlope)
      ? toSvg(d0, y0 + secSlope * (d0 - x0))
      : null;
  const secB =
    config.showSecant !== false && Number.isFinite(secSlope)
      ? toSvg(d1, y0 + secSlope * (d1 - x0))
      : null;

  // Static illustration: a fixed marker (and optional tangent) drawn at
  // config.markerX. Unlike the slider-driven point, these render even with the
  // slider hidden, so a typed/picked/built question can still show a relevant
  // visual anchored at the x it asks about.
  const markerX =
    config.static === true && typeof config.markerX === "number"
      ? config.markerX
      : null;
  let markerPt: { sx: number; sy: number } | null = null;
  let markTanA: { sx: number; sy: number } | null = null;
  let markTanB: { sx: number; sy: number } | null = null;
  if (markerX !== null) {
    try {
      const my = evalFunction(config.fn, markerX);
      markerPt = toSvg(markerX, my);
      if (config.showTangent) {
        const m = derivativeAt(config.fn, markerX);
        if (Number.isFinite(m)) {
          markTanA = toSvg(markerX - tdx, my - m * tdx);
          markTanB = toSvg(markerX + tdx, my + m * tdx);
        }
      }
    } catch {
      markerPt = null;
    }
  }

  // Marker for a tap-the-point selection.
  let selMarker: { sx: number; sy: number } | null = null;
  if (selectedX !== null && selectedX !== undefined) {
    try {
      selMarker = toSvg(selectedX, evalFunction(config.fn, selectedX));
    } catch {
      selMarker = null;
    }
  }

  // Discrete candidate points the learner can tap (when configured). Each is
  // drawn on the curve; the currently selected one is highlighted.
  const choicePoints =
    config.pointChoices?.flatMap((cx) => {
      let cy: number;
      try {
        cy = evalFunction(config.fn, cx);
      } catch {
        return [];
      }
      const { sx, sy } = toSvg(cx, cy);
      const isSel =
        selectedX !== null &&
        selectedX !== undefined &&
        Math.abs(selectedX - cx) < 1e-6;
      return [{ x: cx, sx, sy, isSel }];
    }) ?? [];

  // The moving point shows its green "satisfied" styling only once the step is
  // actually solved (live-confirm) or the answer is revealed.
  const pointSatisfied = satisfied === true;

  // The predict marker, drawn on the curve at the learner's current guess. Shown
  // whenever a guess exists (so it stays visible next to the reveal after a
  // commit); dragging is gated separately by `draggablePoint`.
  let predictMarker: { sx: number; sy: number } | null = null;
  if (predictX != null) {
    try {
      predictMarker = toSvg(predictX, evalFunction(config.fn, predictX));
    } catch {
      predictMarker = null;
    }
  }

  // Reveal overlay for a committed prediction: the true point, and optionally its
  // tangent and a vertical guide, drawn at the correct x.
  let revealPt: { sx: number; sy: number } | null = null;
  let revealTanA: { sx: number; sy: number } | null = null;
  let revealTanB: { sx: number; sy: number } | null = null;
  if (reveal) {
    try {
      const ry = evalFunction(config.fn, reveal.x);
      revealPt = toSvg(reveal.x, ry);
      if (reveal.tangent) {
        const m = derivativeAt(config.fn, reveal.x);
        if (Number.isFinite(m)) {
          revealTanA = toSvg(reveal.x - tdx, ry - m * tdx);
          revealTanB = toSvg(reveal.x + tdx, ry + m * tdx);
        }
      }
    } catch {
      revealPt = null;
    }
  }

  const min = config.sliderMin ?? d0 + 0.1;
  const max = config.sliderMax ?? d1 - 0.1;
  const step = config.sliderStep ?? 0.05;

  const xLabel = config.xLabel ?? config.sliderLabel ?? "x";
  const yLabel = config.yLabel ?? "y";

  // Slope readout mirrors the f(x) readout. When the label is function notation
  // (e.g. "f ′(x)"), the variable is replaced with the current x and the value
  // is joined with "=" → "f ′(-2.2) = 1.5". Plain descriptive labels
  // ("Tangent slope") aren't rewritten, so they keep a colon → "Tangent slope: 1.5".
  const rawSlopeLabel =
    config.slopeLabel ?? (config.showTangent ? "Tangent slope" : "Secant slope");
  const slopeLabelText = withCurrentX(rawSlopeLabel, xLabel, fmtNum(x1));
  const slopeSep = slopeLabelText === rawSlopeLabel ? ": " : " = ";

  // Axis origin positions, clamped so the axes stay visible at the edges.
  const originX = clamp(toSvg(0, yMin).sx, PAD, size.w - PAD);
  const originY = clamp(toSvg(d0, 0).sy, PAD, size.h - PAD);

  const xTicks = ticksFor(d0, d1);
  const yTicks = ticksFor(yMin, yMax);

  return (
    <div ref={containerRef} className="w-full min-h-[200px] flex flex-col gap-3">
      {config.showDerivative && (
        <div className="flex items-center gap-4 text-xs text-slate-600 px-1">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-[3px] rounded-full"
              style={{ backgroundColor: "#4f46e5" }}
            />
            <span className="font-mono">f</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-[3px] rounded-full"
              style={{ backgroundColor: "#ea580c" }}
            />
            <span className="font-mono">f′</span>
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        width="100%"
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        onClick={onPointClick ? handlePlotClick : undefined}
        onPointerDown={
          draggablePoint
            ? handlePredictDown
            : exploreDrag
              ? handleExploreDown
              : undefined
        }
        onPointerMove={
          draggablePoint
            ? handlePredictMove
            : exploreDrag
              ? handleExploreMove
              : undefined
        }
        onPointerUp={draggablePoint || exploreDrag ? handlePredictUp : undefined}
        onPointerCancel={
          draggablePoint || exploreDrag ? handlePredictUp : undefined
        }
        style={draggablePoint || exploreDrag ? { touchAction: "none" } : undefined}
        className={`rounded-xl bg-slate-50 border border-slate-200 overflow-hidden${
          draggablePoint || exploreDrag
            ? dragging
              ? " cursor-grabbing"
              : " cursor-grab"
            : onPointClick
              ? config.pointChoices && config.pointChoices.length > 0
                ? " cursor-pointer"
                : " cursor-crosshair"
              : ""
        }`}
        role="img"
        aria-label={`Graph of the function with ${xLabel} and ${yLabel} axes`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={PAD}
              y={PAD}
              width={Math.max(size.w - 2 * PAD, 0)}
              height={Math.max(size.h - 2 * PAD, 0)}
            />
          </clipPath>
        </defs>

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

        {/* derivative overlay f'(x); clipped so steep parts don't spill out */}
        {config.showDerivative && derivativePathD && (
          <path
            d={derivativePathD}
            fill="none"
            stroke="#ea580c"
            strokeWidth={2.5}
            clipPath={`url(#${clipId})`}
          />
        )}

        {/* static illustration: tangent line at the marked point */}
        {markTanA && markTanB && (
          <line
            x1={markTanA.sx}
            y1={markTanA.sy}
            x2={markTanB.sx}
            y2={markTanB.sy}
            stroke="#10b981"
            strokeWidth={2.5}
          />
        )}
        {/* static illustration: marked point with a guide down to the x-axis */}
        {markerPt && (
          <>
            <line
              x1={markerPt.sx}
              y1={markerPt.sy}
              x2={markerPt.sx}
              y2={originY}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <circle cx={markerPt.sx} cy={markerPt.sy} r={6} fill="#4f46e5" />
          </>
        )}

        {showSlider && config.showSecant !== false && secA && secB && (
          <line
            x1={secA.sx}
            y1={secA.sy}
            x2={secB.sx}
            y2={secB.sy}
            stroke="#f59e0b"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
        )}

        {/* Rise/run triangle for the "rate of change" walkthrough: the run (Δx)
            along the fixed point's height and the rise (Δy) up to the moving
            point, so slope reads visibly as Δy / Δx. */}
        {showSlider &&
          config.showSecant !== false &&
          config.showSecantRiseRun &&
          x1 !== x0 && (
            <g className="secant-reveal">
              <line
                x1={p0.sx}
                y1={p0.sy}
                x2={p1.sx}
                y2={p0.sy}
                stroke="#4f46e5"
                strokeWidth={2}
                strokeDasharray="5 3"
              />
              <line
                x1={p1.sx}
                y1={p0.sy}
                x2={p1.sx}
                y2={p1.sy}
                stroke="#e11d48"
                strokeWidth={2}
                strokeDasharray="5 3"
              />
              <text
                x={(p0.sx + p1.sx) / 2}
                y={p0.sy + 16}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="#4f46e5"
              >
                Δx = {fmtNum(x1 - x0)}
              </text>
              <text
                x={p1.sx + 8}
                y={(p0.sy + p1.sy) / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight={600}
                fill="#e11d48"
              >
                Δy = {fmtNum(y1 - y0)}
              </text>
            </g>
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
          (tangentAtFixed ? (
            <>
              {/* Fixed point (green) anchors the static tangent; the moving
                  point (amber) rides the sliding secant toward it. */}
              <circle cx={p0.sx} cy={p0.sy} r={6} fill="#10b981" />
              <circle cx={p1.sx} cy={p1.sy} r={6} fill="#f59e0b" />
            </>
          ) : config.showTangent ? (
            <circle cx={p1.sx} cy={p1.sy} r={6} fill="#10b981" />
          ) : config.showSecant !== false ? (
            <>
              <circle cx={p0.sx} cy={p0.sy} r={6} fill="#4f46e5" />
              <circle cx={p1.sx} cy={p1.sy} r={6} fill="#f59e0b" />
            </>
          ) : (
            <circle cx={p1.sx} cy={p1.sy} r={6} fill="#4f46e5" />
          ))}

        {/* discrete tappable candidate points */}
        {choicePoints.map((c) => (
          <circle
            key={`choice-${c.x}`}
            cx={c.sx}
            cy={c.sy}
            r={7}
            fill={c.isSel ? "#e11d48" : "#ffffff"}
            stroke={c.isSel ? "#e11d48" : "#4f46e5"}
            strokeWidth={2.5}
          />
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

        {/* live-satisfied confirmation on the moving point (in the goal zone) */}
        {showSlider && pointSatisfied && (
          <>
            <circle cx={p1.sx} cy={p1.sy} r={7} fill="#10b981" />
            <circle
              cx={p1.sx}
              cy={p1.sy}
              r={11}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              opacity={0.45}
            />
          </>
        )}

        {/* predict marker (predict_point steps); draggable before commit */}
        {predictMarker && (
          <>
            <line
              x1={predictMarker.sx}
              y1={predictMarker.sy}
              x2={predictMarker.sx}
              y2={originY}
              stroke="#6366f1"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
            <circle
              cx={predictMarker.sx}
              cy={predictMarker.sy}
              r={13}
              fill="#6366f1"
              fillOpacity={0.15}
            />
            <circle
              cx={predictMarker.sx}
              cy={predictMarker.sy}
              r={8}
              fill="#6366f1"
              stroke="#fff"
              strokeWidth={2.5}
            />
          </>
        )}

        {/* reveal of the true feature after a committed prediction */}
        {reveal && (
          <g>
            {reveal.vertical && revealPt && (
              <line
                x1={revealPt.sx}
                y1={revealPt.sy}
                x2={revealPt.sx}
                y2={originY}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.85}
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to="0.85"
                  dur="0.35s"
                  fill="freeze"
                />
              </line>
            )}
            {revealTanA && revealTanB && (
              <line
                x1={revealTanA.sx}
                y1={revealTanA.sy}
                x2={revealTanB.sx}
                y2={revealTanB.sy}
                stroke="#10b981"
                strokeWidth={3}
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.45s"
                  fill="freeze"
                />
              </line>
            )}
            {reveal.point !== false && revealPt && (
              <circle
                cx={revealPt.sx}
                cy={revealPt.sy}
                r={7}
                fill="#10b981"
                stroke="#fff"
                strokeWidth={2}
              >
                <animate
                  attributeName="r"
                  from="0"
                  to="7"
                  dur="0.35s"
                  fill="freeze"
                />
              </circle>
            )}
          </g>
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

      {showSlider &&
        (config.showSecant !== false || config.showTangent) &&
        config.showSlopeValue !== false &&
        !config.showSecantRiseRun && (
          <p className="text-sm text-slate-600 font-mono">
            {slopeLabelText}
            {slopeSep}
            <strong>{slopeDisplay}</strong>
          </p>
        )}

      {/* Rate-of-change readout for the rise/run walkthrough: slope as Δy / Δx. */}
      {showSlider &&
        config.showSecant !== false &&
        config.showSecantRiseRun &&
        x1 !== x0 && (
          <div className="secant-reveal text-center text-base text-slate-800">
            <MathBlock
              latex={`\\text{${rawSlopeLabel}} = \\dfrac{\\Delta y}{\\Delta x} = \\dfrac{${fmtNum(y1 - y0)}}{${fmtNum(x1 - x0)}} = ${fmtNum((y1 - y0) / (x1 - x0))}`}
            />
          </div>
        )}

      {showSlider &&
        config.showArea &&
        Number.isFinite(areaValue) &&
        (config.areaReadoutMath && config.integrand ? (
          // Live definite-integral readout: the upper limit tracks the slider so
          // the integral notation updates under the learner's thumb. The running
          // area is appended as the right-hand side only when `showAreaValue`
          // isn't false — on "find t" questions we show the live integral but
          // withhold its value so the readout never gives away the answer.
          <div className="text-center text-base text-slate-800">
            <MathBlock
              latex={
                `\\int_{${fmtNum(areaStart)}}^{${fmtNum(x1)}} ${config.integrand}\\,dx` +
                (config.showAreaValue !== false ? ` = ${fmtNum(areaValue)}` : "")
              }
            />
          </div>
        ) : config.showAreaValue !== false ? (
          <p className="text-sm text-slate-600">
            {config.areaLabel ?? "Shaded area"} ≈{" "}
            <strong>{fmtNum(areaValue)}</strong>
          </p>
        ) : null)}
    </div>
  );
}
