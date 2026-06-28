import type { StepPart } from "../../types/content";
import { ContentBlocks } from "../widgets/MathBlock";
import { GraphWidget } from "../widgets/GraphWidget";
import { AnswerInput } from "../widgets/AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";

/**
 * A snapshot of a follow-up part the learner has cleared, capturing enough of the
 * committed widget state to re-render the part faithfully (but locked) above the
 * active one — so a multi-part question reads as one continuous, scrollable thread.
 */
export interface SolvedPartSnapshot {
  part: StepPart;
  answer: unknown;
  graphValue: number;
  clickedX: number | null;
  predictX: number | null;
}

/**
 * A previously-cleared part, re-rendered in full (prompt + graph/answer in the
 * state the learner left them) but locked: `pointer-events-none` makes the whole
 * block non-interactive, so it can be scrolled back to but not changed.
 */
export function LockedPart({ snap, index }: { snap: SolvedPartSnapshot; index: number }) {
  const { part } = snap;
  const a = part.interaction?.answer;
  const answerType = a?.type;
  const isTapPoint = answerType === "graph_point";
  const isPredict = answerType === "predict_point";
  const usesWidgetAnswer =
    answerType === "slider" || isTapPoint || isPredict;
  const graph = part.interaction?.graph;

  // Re-create the prediction reveal so the locked plot still shows the true
  // feature next to the learner's committed guess.
  const reveal =
    isPredict && a?.type === "predict_point"
      ? (() => {
          const guess = snap.predictX ?? a.x;
          const tx = [a.x, ...(a.acceptX ?? [])].reduce((best, t) =>
            Math.abs(guess - t) < Math.abs(guess - best) ? t : best,
          );
          return {
            x: tx,
            point: a.reveal.point !== false,
            tangent: a.reveal.tangent === true,
            vertical: a.reveal.vertical === true,
          };
        })()
      : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/50">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.006l-3.3-3.3a1 1 0 1 1 1.414-1.414l2.59 2.59 6.494-6.59a1 1 0 0 1 1.416-.006Z"
            clipRule="evenodd"
          />
        </svg>
        Part {index + 1} · Answered
      </div>
      <div
        className="pointer-events-none select-none space-y-4 p-4 opacity-75"
        aria-disabled="true"
      >
        <ContentBlocks blocks={part.content} />
        {graph && (
          <GraphWidget
            config={graph}
            sliderValue={snap.graphValue}
            showSlider={!isTapPoint && !isPredict && !graph.static}
            selectedX={isTapPoint ? snap.clickedX : null}
            predictX={isPredict ? snap.predictX : null}
            satisfied={answerType === "slider"}
            reveal={reveal}
          />
        )}
        {a && !usesWidgetAnswer && (
          <AnswerInput
            spec={a}
            value={snap.answer}
            onChange={() => {}}
            disabled
            reveal
            isCorrect
          />
        )}
        <FeedbackPanel message={part.feedback.correct} isCorrect={true} />
      </div>
    </section>
  );
}
