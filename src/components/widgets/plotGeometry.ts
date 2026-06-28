import { evalFunction } from "../../lib/feedbackEngine";

/** Clamp a value into the inclusive range [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** Format a number for readouts: round to 2 dp and drop trailing zeros. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return String(parseFloat(n.toFixed(2)));
}

/** Pick a "nice" tick spacing (1, 2, 5 x 10^n) for a given range. */
export function niceStep(range: number, target = 5): number {
  if (range <= 0) return 1;
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

/** Tick values from `min` to `max` at a fixed positive `step`, on the step grid. */
function ticksFromStep(min: number, max: number, step: number): number[] {
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    out.push(Math.abs(v) < 1e-9 ? 0 : parseFloat(v.toFixed(6)));
  }
  return out;
}

/** Evenly spaced "nice" tick values spanning [min, max]. */
export function ticksFor(min: number, max: number): number[] {
  return ticksFromStep(min, max, niceStep(max - min));
}

/**
 * Tick values across [min, max] at a caller-chosen spacing, for plots that want
 * finer/specific gridlines than the auto "nice" step. Falls back to
 * {@link ticksFor} when `step` is invalid or so small it would flood the axis.
 */
export function ticksForStep(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) return ticksFor(min, max);
  if ((max - min) / step > 200) return ticksFor(min, max);
  return ticksFromStep(min, max, step);
}

/** A plot's data domain/range and pixel box, used to project data to SVG. */
export interface PlotBox {
  domain: [number, number];
  /** [yMin, yMax] in data units. */
  range: [number, number];
  width: number;
  height: number;
  pad: number;
}

export interface SvgPoint {
  sx: number;
  sy: number;
}

/**
 * Build a data -> SVG projector for a plot box. Matches the mapping used by
 * {@link GraphWidget}, so every plot widget places points identically.
 */
export function makeToSvg(box: PlotBox): (x: number, y: number) => SvgPoint {
  const [d0, d1] = box.domain;
  const [yMin, yMax] = box.range;
  const { width, height, pad } = box;
  return (x, y) => ({
    sx: pad + ((x - d0) / (d1 - d0)) * (width - 2 * pad),
    sy: height - pad - ((y - yMin) / (yMax - yMin)) * (height - 2 * pad),
  });
}

/**
 * Sample a math.js expression across [d0, d1], skipping points where the curve
 * is undefined (e.g. a vertical asymptote). Shared by every plot widget that
 * draws a curve outline.
 */
export function sampleCurve(
  fn: string,
  d0: number,
  d1: number,
  steps = 120,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = d0 + ((d1 - d0) * i) / steps;
    try {
      pts.push({ x, y: evalFunction(fn, x) });
    } catch {
      /* skip undefined points */
    }
  }
  return pts;
}

/**
 * Derive a y-range from sampled values when no explicit range is given: always
 * include y = 0 and pad with a small margin so the curve doesn't touch the
 * edges. Mirrors {@link GraphWidget}'s auto-fit so widgets look consistent.
 */
export function autoRange(
  ys: number[],
  explicit?: [number, number],
): [number, number] {
  if (explicit) return explicit;
  const dataMin = ys.length ? Math.min(...ys) : 0;
  const dataMax = ys.length ? Math.max(...ys) : 1;
  const lo = Math.min(dataMin, 0);
  const hi = Math.max(dataMax, 0);
  const padY = (hi - lo) * 0.08 || 1;
  return [lo - (lo < 0 ? padY : 0), hi + padY];
}

/**
 * Convert a pointer's client coordinates to data coordinates for a fixed-viewBox
 * SVG that scales responsively (width: 100%). `el` is the rendered <svg>, and
 * `box` describes its viewBox dimensions and data mapping.
 */
export function clientToData(
  el: SVGSVGElement,
  clientX: number,
  clientY: number,
  box: PlotBox,
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const [d0, d1] = box.domain;
  const [yMin, yMax] = box.range;
  const { width, height, pad } = box;
  const svgX = ((clientX - rect.left) / rect.width) * width;
  const svgY = ((clientY - rect.top) / rect.height) * height;
  const x = d0 + ((svgX - pad) / (width - 2 * pad)) * (d1 - d0);
  const y = yMin + ((height - pad - svgY) / (height - 2 * pad)) * (yMax - yMin);
  return { x, y };
}
