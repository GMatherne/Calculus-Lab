import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SimulateAnswer } from "../../types/content";
import { evalAt } from "../../lib/feedbackEngine";
import {
  clamp,
  clientToData,
  fmtNum,
  makeToSvg,
  ticksFor,
  type PlotBox,
} from "./plotGeometry";

interface SimulateInputProps {
  spec: SimulateAnswer;
  value: number[] | undefined;
  onChange: (value: number[] | undefined) => void;
  disabled?: boolean;
  reveal?: boolean;
  isCorrect?: boolean;
}

const W = 360;
const H = 260;
const PAD = 34;
/** Points the trace is resampled to (must match the grader's t-grid). */
const N_SAMPLES = 60;

/**
 * "Drive the value": press Run and a playhead sweeps across [0, duration] while
 * the learner moves the pointer up/down to set a pen height in real time. In
 * `control` mode the pen trace itself is graded; in `integral` mode the pen is a
 * velocity and the plotted/graded curve is its running accumulation (position),
 * so steering velocity draws out position — the calculus payoff.
 */
export function SimulateInput({
  spec,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: SimulateInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // idle: setting the starting value · countdown: 3-2-1 before the sweep ·
  // running: the playhead is sweeping · done: run finished.
  const [phase, setPhase] = useState<"idle" | "countdown" | "running" | "done">(
    "idle",
  );
  const [countdownN, setCountdownN] = useState<number | null>(null);
  // Bumped every animation frame to redraw from the mutable trace ref.
  const [, setFrame] = useState(0);
  const traceRef = useRef<{ t: number; y: number }[]>([]);
  const [yLo, yHi] = spec.yDomain;
  // Open mid-range so the draggable handle is clearly visible and the learner
  // sets the starting value on purpose, rather than it being pinned at 0.
  const penRef = useRef<number>(clamp((yLo + yHi) / 2, yLo, yHi));
  const startRef = useRef<number>(0);
  const nowTRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const clipId = `sim-clip-${useId().replace(/:/g, "")}`;

  const dur = spec.duration;
  const box: PlotBox = {
    domain: [0, dur],
    range: [yLo, yHi],
    width: W,
    height: H,
    pad: PAD,
  };
  const toSvg = makeToSvg(box);

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };
  // Cancel any in-flight animation frame or countdown timer when unmounting
  // (e.g. step change).
  useEffect(
    () => () => {
      stopRaf();
      clearTimers();
    },
    [],
  );

  const interactive = !disabled && !reveal;

  // Linear-interpolated pen value at time t over the recorded samples.
  const penAt = (t: number): number => {
    const trace = traceRef.current;
    if (trace.length === 0) return 0;
    if (t <= trace[0].t) return trace[0].y;
    for (let i = 1; i < trace.length; i++) {
      if (trace[i].t >= t) {
        const a = trace[i - 1];
        const b = trace[i];
        const f = (t - a.t) / ((b.t - a.t) || 1);
        return a.y + (b.y - a.y) * f;
      }
    }
    return trace[trace.length - 1].y;
  };

  const finish = () => {
    stopRaf();
    setPhase("done");
    const dt = dur / (N_SAMPLES - 1);
    const series: number[] = [];
    let acc = 0;
    for (let i = 0; i < N_SAMPLES; i++) {
      const t = dt * i;
      const pen = penAt(t);
      if (spec.match === "integral") {
        if (i > 0) acc += 0.5 * (penAt(dt * (i - 1)) + pen) * dt;
        series.push(parseFloat(acc.toFixed(4)));
      } else {
        series.push(parseFloat(pen.toFixed(4)));
      }
    }
    onChange(series);
  };

  const loop = (now: number) => {
    const t = (now - startRef.current) / 1000;
    nowTRef.current = Math.min(t, dur);
    traceRef.current.push({ t: Math.min(t, dur), y: penRef.current });
    setFrame((f) => f + 1);
    if (t >= dur) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  // Kick off the actual sweep, seeding the trace with the starting value the
  // learner set during setup so the run begins exactly where they left it.
  const beginRun = () => {
    stopRaf();
    startRef.current = performance.now();
    traceRef.current = [{ t: 0, y: penRef.current }];
    nowTRef.current = 0;
    setPhase("running");
    rafRef.current = requestAnimationFrame(loop);
  };

  // Pressing Start runs a short 3-2-1 countdown (so the start isn't abrupt and
  // the learner can get their hand ready) and then begins the sweep. The pointer
  // stays live throughout, so the starting value can still be fine-tuned.
  const startCountdown = () => {
    if (!interactive) return;
    stopRaf();
    clearTimers();
    traceRef.current = [];
    nowTRef.current = 0;
    // Clear any previous result so the step can't be submitted mid-run.
    onChange(undefined);
    setPhase("countdown");
    setCountdownN(3);
    const STEP = 650;
    timersRef.current = [
      window.setTimeout(() => setCountdownN(2), STEP),
      window.setTimeout(() => setCountdownN(1), STEP * 2),
      window.setTimeout(() => {
        setCountdownN(null);
        beginRun();
      }, STEP * 3),
    ];
  };

  const updatePen = (clientY: number) => {
    if (!svgRef.current) return;
    const { y } = clientToData(svgRef.current, 0, clientY, box);
    penRef.current = clamp(y, yLo, yHi);
  };
  // The learner can set/adjust the value during setup and the countdown, then
  // keep steering once the sweep is running — but not after it's done.
  const canSteer = interactive && phase !== "done";
  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!canSteer) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updatePen(e.clientY);
    setFrame((f) => f + 1);
  };
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!canSteer) return;
    e.preventDefault();
    updatePen(e.clientY);
    setFrame((f) => f + 1);
  };

  const originX = clamp(toSvg(0, yLo).sx, PAD, W - PAD);
  const originY = clamp(toSvg(0, 0).sy, PAD, H - PAD);
  const xTicks = ticksFor(0, dur);
  const yTicks = ticksFor(yLo, yHi);

  // Target curve (dashed) sampled across the run.
  const targetPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= N_SAMPLES; i++) {
      const t = (dur * i) / N_SAMPLES;
      let y: number;
      try {
        y = evalAt(spec.target, { t });
      } catch {
        continue;
      }
      const { sx, sy } = toSvg(t, y);
      pts.push(`${pts.length === 0 ? "M" : "L"} ${sx} ${sy}`);
    }
    return pts.join(" ");
  })();

  // Learner's drawn curve from the recorded trace (accumulated in integral mode).
  const learnerPath = (() => {
    const trace = traceRef.current;
    if (trace.length < 1) return "";
    let acc = 0;
    return trace
      .map((s, k) => {
        let y = s.y;
        if (spec.match === "integral") {
          if (k > 0) acc += 0.5 * (trace[k - 1].y + s.y) * (s.t - trace[k - 1].t);
          y = acc;
        }
        const { sx, sy } = toSvg(s.t, y);
        return `${k === 0 ? "M" : "L"} ${sx} ${sy}`;
      })
      .join(" ");
  })();

  const learnerColor = reveal ? (isCorrect ? "#10b981" : "#e11d48") : "#4f46e5";
  const playheadX = toSvg(nowTRef.current, 0).sx;
  const penGuideY = toSvg(0, penRef.current).sy;
  // The draggable value handle is shown whenever the learner can move it.
  const showHandle =
    phase === "idle" || phase === "countdown" || phase === "running";

  const xLabel = spec.xLabel ?? "t";
  const yLabel = spec.yLabel ?? "y";
  const controlLabel = spec.controlLabel ?? "Value";

  // Derivative ("speedometer") mode: a source curve f is shown faintly and the
  // learner drives the rate to match its slope. The dashed answer (the true f')
  // stays hidden until the run ends so it can't simply be traced.
  const isDeriv = spec.match === "derivative";
  const referenceLabel = spec.referenceLabel ?? "the curve";
  const showTarget = !isDeriv || phase === "done";
  const refAt = (t: number): number | null => {
    if (!spec.referenceFn) return null;
    try {
      return evalAt(spec.referenceFn, { t });
    } catch {
      return null;
    }
  };
  const referencePath = (() => {
    if (!spec.referenceFn) return "";
    const pts: string[] = [];
    for (let i = 0; i <= N_SAMPLES; i++) {
      const t = (dur * i) / N_SAMPLES;
      const y = refAt(t);
      if (y == null) continue;
      const { sx, sy } = toSvg(t, y);
      pts.push(`${pts.length === 0 ? "M" : "L"} ${sx} ${sy}`);
    }
    return pts.join(" ");
  })();
  const refNowY = refAt(nowTRef.current);

  const status =
    phase === "idle"
      ? isDeriv
        ? `Drag up or down to set your starting ${controlLabel.toLowerCase()}, then press Start and match the slope of ${referenceLabel}.`
        : `Drag up or down on the plot to set your starting ${controlLabel.toLowerCase()}, then press Start.`
      : phase === "countdown"
        ? "Get ready — keep your pointer on the plot so you can steer."
        : phase === "running"
          ? isDeriv
            ? `Read how steep ${referenceLabel} is and drive your ${controlLabel.toLowerCase()} to match its slope.`
            : spec.match === "integral"
              ? `Keep steering your ${controlLabel.toLowerCase()} so the solid curve stays on the dashed target.`
              : "Keep tracing the dashed target curve."
          : reveal
            ? isCorrect
              ? "Nice driving — that matched the target."
              : "Not quite — run it again to retrace."
            : isDeriv
              ? `Run complete — the dashed line is the true ${controlLabel.toLowerCase()}. Check your answer, or run again.`
              : "Run complete. Check your answer, or run again.";

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full select-none touch-none ${phase === "running" ? "cursor-ns-resize" : ""}`}
          style={{ touchAction: "none" }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          role="img"
          aria-label="Move up and down to drive the value and match the target curve"
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
            <line key={`gy-${t}`} x1={PAD} y1={toSvg(0, t).sy} x2={W - PAD} y2={toSvg(0, t).sy} stroke="#eef2f7" strokeWidth={1} />
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
              <text key={`ty-${t}`} x={PAD - 5} y={toSvg(0, t).sy + 3} textAnchor="end" fontSize={9} fill="#64748b">
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

          {/* source curve f (derivative mode): read its slope */}
          {referencePath && (
            <path d={referencePath} fill="none" stroke="#94a3b8" strokeWidth={2} opacity={0.6} clipPath={`url(#${clipId})`} />
          )}

          {/* target curve (withheld during the run in derivative mode) */}
          {showTarget && targetPath && (
            <path d={targetPath} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="6 4" clipPath={`url(#${clipId})`} />
          )}

          {/* learner's traced curve */}
          {learnerPath && (
            <path d={learnerPath} fill="none" stroke={learnerColor} strokeWidth={2.5} clipPath={`url(#${clipId})`} />
          )}

          {/* marker on the source curve at the current time */}
          {showHandle && refNowY != null && (
            <circle cx={playheadX} cy={toSvg(0, refNowY).sy} r={5} fill="#94a3b8" stroke="#fff" strokeWidth={1.5} />
          )}

          {/* draggable value handle + guide (setup, countdown, and running) */}
          {showHandle && (
            <>
              {phase === "running" && (
                <line x1={playheadX} y1={PAD} x2={playheadX} y2={H - PAD} stroke="#f59e0b" strokeWidth={1.5} />
              )}
              <line x1={PAD} y1={penGuideY} x2={W - PAD} y2={penGuideY} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />
              <circle cx={playheadX} cy={penGuideY} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
              {phase !== "running" && (
                <text
                  x={Math.min(playheadX + 12, W - PAD)}
                  y={clamp(penGuideY - 10, PAD + 8, H - PAD)}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={700}
                  fill="#b45309"
                >
                  {controlLabel} {fmtNum(penRef.current)}
                </text>
              )}
            </>
          )}

          {/* get-ready countdown over the plot */}
          {phase === "countdown" && countdownN != null && (
            <text x={W / 2} y={H / 2 + 8} textAnchor="middle" fontSize={52} fontWeight={800} fill="#f59e0b" opacity={0.85}>
              {countdownN}
            </text>
          )}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {isDeriv ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t-2 border-slate-400" />
              {referenceLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t-2 border-indigo-600" />
              Your {controlLabel.toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-emerald-500" />
              True {controlLabel.toLowerCase()} (after run)
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-emerald-500" />
              Target {yLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t-2 border-indigo-600" />
              Your {yLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              {controlLabel} — drag up/down
            </span>
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {phase !== "done" && (
            <p className="text-xs font-semibold tabular-nums text-slate-700">
              {controlLabel}: {fmtNum(penRef.current)}
              {phase === "running" ? `  ·  t = ${fmtNum(nowTRef.current)}` : ""}
            </p>
          )}
          <p className="text-xs text-slate-500">{status}</p>
        </div>
        <button
          type="button"
          onClick={startCountdown}
          disabled={!interactive || phase === "running" || phase === "countdown"}
          className="min-h-[40px] shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 active:scale-[0.98] transition"
        >
          {phase === "done"
            ? "Run again"
            : phase === "running"
              ? "Running…"
              : phase === "countdown"
                ? "Starting…"
                : "Start"}
        </button>
      </div>
    </div>
  );
}
