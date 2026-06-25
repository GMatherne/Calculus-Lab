import { Fragment } from "react";
import type { SignChartAnswer } from "../../types/content";
import { RichText } from "./MathBlock";

interface SignChartInputProps {
  spec: SignChartAnswer;
  /** Chosen option index per region (null where a region is unlabeled). */
  value: (number | null)[] | undefined;
  onChange: (value: (number | null)[]) => void;
  disabled?: boolean;
  /** When true, color each region's choice by its correctness. */
  reveal?: boolean;
  /** Whether the whole answer was correct (each region self-colors, so unused). */
  isCorrect?: boolean;
}

/** Compact numeric label for a tick, e.g. -1, 0, 2.5. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * A number-line "sign chart": critical points split the line into intervals and
 * the learner tags each interval with a behavior (e.g. Increasing / Decreasing).
 * This is the standard hands-on tool for reasoning about where a function rises
 * and falls, so it turns "is f increasing here?" into a tactile, per-region call
 * rather than a single multiple-choice guess.
 */
export function SignChartInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
}: SignChartInputProps) {
  const picks: (number | null)[] = spec.regions.map((_, i) => value?.[i] ?? null);

  // Interval description for region i (there is one more region than points).
  const intervalLabel = (i: number): string => {
    const p = spec.points;
    if (i === 0) return `$x < ${fmt(p[0])}$`;
    if (i === p.length) return `$x > ${fmt(p[p.length - 1])}$`;
    return `$${fmt(p[i - 1])} < x < ${fmt(p[i])}$`;
  };

  const choose = (region: number, option: number) => {
    if (disabled) return;
    const next = spec.regions.map((_, i) => picks[i]);
    next[region] = option;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {spec.variableLabel && (
        <div className="text-center text-sm font-semibold text-slate-600">
          <RichText text={spec.variableLabel} />
        </div>
      )}
      <div className="flex items-stretch overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
        {spec.regions.map((region, i) => {
          const chosen = picks[i];
          return (
            <Fragment key={i}>
              {i > 0 && (
                <div className="flex flex-col items-center px-1">
                  <span className="whitespace-nowrap text-xs font-bold text-slate-700">
                    <RichText text={`$${fmt(spec.points[i - 1])}$`} />
                  </span>
                  <div className="mt-1 w-px flex-1 bg-slate-300" />
                </div>
              )}
              <div className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-2 px-1">
                <span className="text-center text-xs text-slate-500">
                  <RichText text={intervalLabel(i)} />
                </span>
                <div className="flex w-full flex-col gap-1.5">
                  {spec.options.map((opt, j) => {
                    const selected = chosen === j;
                    let cls =
                      "min-h-[40px] rounded-lg border px-2 py-1.5 text-center text-sm font-medium transition-colors ";
                    if (reveal && selected) {
                      cls +=
                        j === region.correctIndex
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-rose-500 bg-rose-50 text-rose-900";
                    } else if (selected) {
                      cls += "border-indigo-600 bg-indigo-50 text-indigo-900";
                    } else {
                      cls +=
                        "border-slate-200 bg-white text-slate-700 hover:border-indigo-300";
                    }
                    return (
                      <button
                        key={j}
                        type="button"
                        disabled={disabled}
                        onClick={() => choose(i, j)}
                        aria-pressed={selected}
                        aria-label={`Label interval ${intervalLabel(i).replace(/\$/g, "")} as ${opt}`}
                        className={cls}
                      >
                        <RichText text={opt} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
