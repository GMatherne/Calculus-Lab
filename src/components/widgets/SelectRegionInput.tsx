import { useId, type KeyboardEvent } from "react";
import type { SelectRegionAnswer } from "../../types/content";
import {
  autoRange,
  makeToSvg,
  sampleCurve,
  ticksFor,
  type PlotBox,
} from "./plotGeometry";

interface SelectRegionInputProps {
  spec: SelectRegionAnswer;
  /** Chosen band index (single-select) or a boolean per band (multi-select). */
  value: number | boolean[] | null | undefined;
  onChange: (value: number | boolean[]) => void;
  disabled?: boolean;
  /** When true, color the chosen band(s) by the submission's correctness. */
  reveal?: boolean;
  /** Whether the whole answer was correct (only meaningful when reveal is true). */
  isCorrect?: boolean;
}

const W = 340;
const H = 240;
const PAD = 32;

/** Small green/red/indigo "selected" badge with a white check, like the screenshot. */
function CheckBadge({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const s = 11;
  return (
    <g pointerEvents="none">
      <rect x={cx - s} y={cy - s} width={2 * s} height={2 * s} rx={4} fill={color} />
      <path
        d={`M ${cx - 5} ${cy + 0.5} L ${cx - 1.5} ${cy + 4} L ${cx + 5.5} ${cy - 4}`}
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * "Select the region": vertical bands are overlaid on a static curve and the
 * learner taps the one (single-select) or several (multi-select) that satisfy a
 * property — the steepest stretch, the flattest period, where the curve is
 * concave up, and so on. It's visual multiple-choice over intervals of the plot.
 * On reveal it mirrors plain multiple choice: only the chosen band(s) are colored
 * (green when the whole answer was right, red when wrong), so the correct region
 * isn't given away on a miss and the learner can try again.
 */
export function SelectRegionInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: SelectRegionInputProps) {
  const clipId = `region-clip-${useId().replace(/:/g, "")}`;
  const multi = spec.multi === true;

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

  const selectedArr = Array.isArray(value) ? value : null;
  const selectedIndex = typeof value === "number" ? value : null;
  const isSelected = (i: number): boolean =>
    multi ? Boolean(selectedArr?.[i]) : selectedIndex === i;

  const interactive = !disabled && !reveal;

  const choose = (i: number) => {
    if (!interactive) return;
    if (multi) {
      const next = spec.bands.map((_, j) =>
        j === i ? !isSelected(j) : Boolean(selectedArr?.[j]),
      );
      onChange(next);
    } else {
      onChange(i);
    }
  };

  const onKey = (e: KeyboardEvent<SVGRectElement>, i: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(i);
    }
  };

  const originY = Math.min(Math.max(toSvg(d0, 0).sy, PAD), H - PAD);
  const xTicks = ticksFor(d0, d1);

  const curvePath = curve
    .map((p, i) => {
      const { sx, sy } = toSvg(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    })
    .join(" ");

  // Per-band styling. While answering: chosen = indigo, others = faint outline.
  // On reveal we only mark what the learner chose (green if the whole answer was
  // correct, red otherwise) — the correct band is never revealed on a miss.
  const bandStyle = (i: number) => {
    const sel = isSelected(i);
    if (reveal) {
      if (sel && isCorrect) return { fill: "#10b981", stroke: "#10b981", op: 0.2 };
      if (sel) return { fill: "#e11d48", stroke: "#e11d48", op: 0.2 };
      return { fill: "#94a3b8", stroke: "#cbd5e1", op: 0 };
    }
    if (sel) return { fill: "#6366f1", stroke: "#6366f1", op: 0.2 };
    return { fill: "#94a3b8", stroke: "#cbd5e1", op: 0 };
  };

  const xLabel = spec.xLabel ?? "x";
  const yLabel = spec.yLabel ?? "y";
  const defaultPrompt = multi
    ? "Tap every region that matches."
    : "Tap the region that matches.";

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full select-none"
          role="group"
          aria-label="Select a region on the plot"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
            </clipPath>
          </defs>

          {/* x-axis */}
          <line
            x1={PAD}
            y1={originY}
            x2={W - PAD}
            y2={originY}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />

          {/* curve */}
          <path
            d={curvePath}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2.5}
            clipPath={`url(#${clipId})`}
          />

          {/* selectable bands */}
          {spec.bands.map((band, i) => {
            const xL = toSvg(band.from, 0).sx;
            const xR = toSvg(band.to, 0).sx;
            const w = Math.max(xR - xL, 2);
            const style = bandStyle(i);
            const sel = isSelected(i);
            const cx = xL + w / 2;
            const badgeColor = reveal
              ? isCorrect
                ? "#10b981"
                : "#e11d48"
              : "#6366f1";
            return (
              <g key={`band-${i}`}>
                <rect
                  x={xL}
                  y={PAD}
                  width={w}
                  height={H - 2 * PAD}
                  fill={style.fill}
                  fillOpacity={style.op}
                  stroke={style.stroke}
                  strokeWidth={sel ? 2 : 1}
                  rx={3}
                  role="button"
                  aria-pressed={sel}
                  aria-label={`Region ${i + 1}, ${xLabel} from ${band.from} to ${band.to}`}
                  tabIndex={interactive ? 0 : -1}
                  onClick={() => choose(i)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={interactive ? "cursor-pointer outline-none" : ""}
                  style={{ touchAction: "manipulation" }}
                />
                {sel && <CheckBadge cx={cx} cy={PAD + 16} color={badgeColor} />}
              </g>
            );
          })}

          {/* tick labels */}
          {xTicks.map((t) =>
            t === 0 ? null : (
              <text
                key={`tx-${t}`}
                x={toSvg(t, 0).sx}
                y={H - PAD + 13}
                textAnchor="middle"
                fontSize={9}
                fill="#64748b"
              >
                {t}
              </text>
            ),
          )}
          <text
            x={W - PAD + 1}
            y={originY - 5}
            textAnchor="end"
            fontSize={11}
            fontStyle="italic"
            fill="#475569"
          >
            {xLabel}
          </text>
          <text
            x={PAD - 3}
            y={PAD - 3}
            textAnchor="start"
            fontSize={11}
            fontStyle="italic"
            fill="#475569"
          >
            {yLabel}
          </text>
        </svg>
      </div>
      <p className="text-center text-xs text-slate-500">
        {spec.prompt ?? defaultPrompt}
      </p>
    </div>
  );
}
