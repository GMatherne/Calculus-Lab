import { useState, useCallback, useEffect, useRef } from "react";
import type { Lesson, Step, PracticeResult } from "../../types/content";
import { isInstructionStep } from "../../types/content";
import { checkAnswer, answerProximity } from "../../lib/feedbackEngine";
import { ContentBlocks } from "../widgets/MathBlock";
import { GraphWidget } from "../widgets/GraphWidget";
import { AnswerInput } from "../widgets/AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";
import { TutorPanel } from "./TutorPanel";
import { StepNavBar, type StepState } from "./StepNavBar";
import { useProgress, isLessonDone } from "../../contexts/ProgressContext";
import { useSessionInsights } from "../../contexts/SessionInsightsContext";

/** Shuffle a list into an order that differs from the original when possible. */
function shuffleOrder(items: string[]): string[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 12; attempt++) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((v, i) => v !== items[i])) return out;
  }
  return [...items];
}

/**
 * The starting answer for question types that begin from a non-empty state: the
 * power-term builder opens on the original term, an order_list opens shuffled,
 * and a Riemann sum opens at a single (clearly-too-coarse) rectangle. Everything
 * else starts blank (undefined).
 */
function seedAnswer(step: Step): unknown {
  const a = step.interaction?.answer;
  if (a?.type === "power_term") {
    return { coefficient: a.startCoefficient ?? 1, exponent: a.startExponent ?? 1 };
  }
  if (a?.type === "order_list") return shuffleOrder(a.items);
  if (a?.type === "riemann") return 1;
  return undefined;
}

/**
 * Where a predict marker starts: the graph's initial slider if authored, else
 * the midpoint of the domain — a neutral spot to drag away from. Returns null
 * for non-predict steps.
 */
function predictStartX(step: Step): number | null {
  if (step.interaction?.answer?.type !== "predict_point") return null;
  const g = step.interaction.graph;
  if (!g) return 0;
  if (typeof g.initialSlider === "number") return g.initialSlider;
  return (g.domain[0] + g.domain[1]) / 2;
}

/**
 * The horizontal scale used to normalize live proximity into a 0–1 "closeness".
 * For a slider it's the slider's travel; for a numeric answer a couple of times
 * the target magnitude. Only an approximate feel for the warmer/colder meter.
 */
function liveScale(step: Step): number {
  const a = step.interaction?.answer;
  const g = step.interaction?.graph;
  if (a?.type === "slider") {
    const lo = g?.sliderMin ?? g?.domain?.[0] ?? 0;
    const hi = g?.sliderMax ?? g?.domain?.[1] ?? 1;
    return Math.max(hi - lo, 1);
  }
  if (a?.type === "numeric") return Math.max(Math.abs(a.value), 1) * 2;
  if (a?.type === "predict_point") {
    // Half the visible domain, so the meter reads green about when the dragged
    // guess enters the accept window rather than long before it.
    const lo = g?.domain?.[0] ?? -1;
    const hi = g?.domain?.[1] ?? 1;
    return Math.max((hi - lo) / 2, 1);
  }
  return 1;
}

/**
 * A subtle "warmer/colder" meter shown while a live step is being tuned. It fills
 * as the learner closes in and turns green right before the step locks in. It is
 * purely a nudge — {@link checkAnswer} still decides the verdict.
 */
function LiveProximityMeter({
  closeness,
  hint,
  label,
}: {
  closeness: number;
  hint: string;
  label?: string;
}) {
  const pct = Math.round(closeness * 100);
  const bar =
    closeness > 0.85
      ? "bg-emerald-500"
      : closeness > 0.5
        ? "bg-amber-400"
        : "bg-rose-400";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          {label ?? "Keep adjusting"}
        </span>
        {hint && <span className="text-slate-500">{hint}</span>}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${bar} transition-all duration-150`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface LessonPlayerProps {
  lesson: Lesson;
  initialStepIndex?: number;
  /**
   * Practice mode runs the steps as a standalone quiz: progress is not
   * persisted, and on finish the first-try score is reported via onComplete.
   */
  practiceMode?: boolean;
  onComplete: (result?: PracticeResult) => void;
}

export function LessonPlayer({
  lesson,
  initialStepIndex = 0,
  practiceMode = false,
  onComplete,
}: LessonPlayerProps) {
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  // High-water mark of the furthest step legitimately reached this session.
  // Earlier steps stay revisitable from the step nav, but steps beyond this are
  // locked, so the lesson can't be finished by jumping straight to the last one.
  const [maxReachedIndex, setMaxReachedIndex] = useState(initialStepIndex);
  const [answer, setAnswer] = useState<unknown>(undefined);
  const graphInitial = (s: Lesson["steps"][number]) =>
    s.interaction?.graph?.initialSlider ??
    s.interaction?.graph?.sliderMin ??
    0;
  const [graphValue, setGraphValue] = useState<number>(() =>
    graphInitial(lesson.steps[initialStepIndex]),
  );
  const [clickedX, setClickedX] = useState<number | null>(null);
  // x-coordinate of the draggable predict marker (predict_point steps only).
  const [predictX, setPredictX] = useState<number | null>(() =>
    predictStartX(lesson.steps[initialStepIndex]),
  );
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean | null;
    message: string;
    hint?: string;
  }>({ isCorrect: null, message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  // Question steps the learner has answered correctly this session. Combined
  // with persisted progress to color the step nav squares green.
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { updateStepProgress, progress } = useProgress();
  const { recordAnswer } = useSessionInsights();

  // Practice scoring: each question counts toward the score only on its first
  // submission, so "Try Again" retries don't inflate the result.
  const scoredStepIds = useRef<Set<string>>(new Set());
  const correctFirstTry = useRef(0);

  const step: Step = lesson.steps[stepIndex];
  const isRead = step.type === "read";
  // Read steps and Riemann demos both advance ungraded with a "Continue" button.
  // `isRead` still gates the answer widget so a demo's interactive widget renders.
  const isInstruction = isInstructionStep(step);
  const total = lesson.steps.length;

  const answerType = step.interaction?.answer?.type;
  const isTapPoint = answerType === "graph_point";
  const isPredict = answerType === "predict_point";
  const usesWidgetAnswer =
    answerType === "slider" ||
    answerType === "graph_point" ||
    answerType === "predict_point";
  // Continuous grading: judge as the learner manipulates and confirm the instant
  // the answer is satisfied — no "Check Answer" press. Reserved for the smoothly
  // tunable inputs; graph_point taps and predict steps keep their own flows.
  const liveEnabled =
    step.interaction?.liveCheck === true &&
    !isInstruction &&
    (answerType === "slider" ||
      answerType === "numeric" ||
      answerType === "power_term");

  // Reset interactive widget state whenever the step changes. Types that begin
  // from a non-empty state (power_term, order_list, riemann) are seeded here so
  // they open ready to manipulate; the rest start blank.
  useEffect(() => {
    const s = lesson.steps[stepIndex];
    setGraphValue(graphInitial(s));
    setClickedX(null);
    setPredictX(predictStartX(s));
    setHintRevealed(false);
    const seeded = seedAnswer(s);
    if (seeded !== undefined) setAnswer(seeded);
  }, [stepIndex, lesson]);

  // Commit a verdict to the UI and progress. Shared by the explicit "Check
  // Answer" press and the live (continuous) confirmation, so a live lock-in and a
  // classic submit are scored and persisted identically.
  const applyResult = useCallback(
    (result: ReturnType<typeof checkAnswer>, effectiveAnswer: unknown) => {
      // The hint is available on a wrong answer but stays hidden until the
      // learner explicitly asks for it (so it never gives the answer away).
      setHintRevealed(false);
      setFeedback({
        isCorrect: result.correct,
        message: result.message,
        hint: result.correct ? undefined : result.hint,
      });
      setSubmitted(true);

      if (result.correct) {
        setCompletedStepIds((prev) => {
          if (prev.has(step.id)) return prev;
          const next = new Set(prev);
          next.add(step.id);
          return next;
        });
        // Clearing a question unlocks the next step for navigation.
        setMaxReachedIndex((m) => Math.max(m, stepIndex + 1));
      }

      // Feed the in-memory session tally that personalizes the AI tutor. Recorded
      // for both lesson and practice modes — interleaved review is where a
      // recurring weak spot is most useful to surface.
      recordAnswer(step.conceptTag, result.correct);

      if (practiceMode) {
        if (!scoredStepIds.current.has(step.id)) {
          scoredStepIds.current.add(step.id);
          if (result.correct) correctFirstTry.current += 1;
        }
        return;
      }

      void updateStepProgress(
        lesson.id,
        stepIndex,
        step.id,
        effectiveAnswer,
        result.correct,
      );
    },
    [step, stepIndex, practiceMode, updateStepProgress, recordAnswer, lesson.id],
  );

  // The value the learner is currently committing, mirrored across the widget-
  // backed answer types and the plain inputs.
  const effectiveAnswerOf = useCallback((): unknown => {
    if (answerType === "slider") return graphValue;
    if (answerType === "graph_point") return clickedX;
    if (answerType === "predict_point") return predictX;
    return answer;
  }, [answerType, graphValue, clickedX, predictX, answer]);

  const handleSubmit = useCallback(() => {
    if (isInstruction) return;
    const effectiveAnswer = effectiveAnswerOf();
    applyResult(checkAnswer(step, effectiveAnswer), effectiveAnswer);
  }, [isInstruction, effectiveAnswerOf, step, applyResult]);

  // Live grading on each manipulation of a `liveCheck` step: the first time the
  // answer is satisfied we lock it in (confirm, don't teleport). Wrong states are
  // never surfaced here — the learner just keeps tuning — so the first satisfy is
  // a clean first-try in practice scoring.
  const liveEvaluate = useCallback(
    (value: unknown) => {
      if (!liveEnabled || submitted) return;
      const result = checkAnswer(step, value);
      if (result.correct) applyResult(result, value);
    },
    [liveEnabled, submitted, step, applyResult],
  );

  // Jump to any step and clear the current attempt's transient state. The
  // graph widgets reset via the effect keyed on stepIndex.
  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= total || index === stepIndex) return;
      setStepIndex(index);
      setAnswer(undefined);
      setFeedback({ isCorrect: null, message: "" });
      setSubmitted(false);
    },
    [stepIndex, total],
  );

  const goToNextStep = useCallback(() => {
    if (stepIndex >= total - 1) {
      onComplete(
        practiceMode
          ? { correct: correctFirstTry.current, total }
          : undefined,
      );
    } else {
      setMaxReachedIndex((m) => Math.max(m, stepIndex + 1));
      goToStep(stepIndex + 1);
    }
  }, [stepIndex, total, onComplete, practiceMode, goToStep]);

  const goToPrevStep = useCallback(() => {
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  // After a wrong attempt, changing the answer clears the stale feedback so the
  // learner gets a fresh "Check Answer" rather than lingering red coloring.
  const clearAfterWrong = useCallback(() => {
    if (submitted && feedback.isCorrect === false) {
      setSubmitted(false);
      setFeedback({ isCorrect: null, message: "" });
      setHintRevealed(false);
    }
  }, [submitted, feedback.isCorrect]);

  // "Try Again" fully resets the current attempt: choices unlock, the red
  // marking and feedback clear, and any entered value is wiped for a clean retry.
  const retryStep = useCallback(() => {
    setSubmitted(false);
    setFeedback({ isCorrect: null, message: "" });
    setHintRevealed(false);
    setClickedX(null);
    setPredictX(predictStartX(lesson.steps[stepIndex]));
    setGraphValue(graphInitial(lesson.steps[stepIndex]));
    // Reseed builders (e.g. power_term, order_list, riemann) so the retry starts
    // from a clean, manipulable state rather than a blank one.
    setAnswer(seedAnswer(lesson.steps[stepIndex]));
  }, [lesson, stepIndex]);

  const isCorrectAnswered = submitted && feedback.isCorrect === true;
  const isWrongAnswered = submitted && feedback.isCorrect === false;
  const handleContinueRead = goToNextStep;

  // Practice runs against a throwaway lesson, so its persisted progress (keyed
  // by the real lesson id) must not leak into the squares — only this session's
  // correct answers count there.
  const lessonProgress = practiceMode ? undefined : progress[lesson.id];
  const savedIndex = lessonProgress?.currentStepIndex ?? 0;
  const lessonComplete = isLessonDone(lessonProgress?.status);
  const stepStates: StepState[] = lesson.steps.map((s, i) => {
    if (isInstructionStep(s)) return "info";
    if (lessonComplete || i < savedIndex || completedStepIds.has(s.id))
      return "done";
    return "todo";
  });

  // Steps past the furthest reached one stay locked so the learner can't skip
  // ahead to the end. A finished lesson unlocks every step for free review.
  const maxSelectableIndex = lessonComplete
    ? total - 1
    : Math.min(total - 1, Math.max(stepIndex, savedIndex, maxReachedIndex));

  const handleSelectStep = (index: number) => {
    if (index > maxSelectableIndex) return;
    goToStep(index);
  };

  // Drag-and-drop questions can't be submitted until every blank holds a tile.
  const dragDropBlankCount =
    step.interaction?.answer?.type === "drag_drop"
      ? step.interaction.answer.blanks.length
      : 0;
  // Multi-choice questions can't be submitted until every row is answered.
  const multiChoicePartCount =
    step.interaction?.answer?.type === "multi_choice"
      ? step.interaction.answer.parts.length
      : 0;
  // Match questions can't be submitted until every prompt has been matched.
  const matchPairCount =
    step.interaction?.answer?.type === "match"
      ? step.interaction.answer.pairs.length
      : 0;
  // Sign-chart questions can't be submitted until every region is labeled.
  const signChartRegionCount =
    step.interaction?.answer?.type === "sign_chart"
      ? step.interaction.answer.regions.length
      : 0;
  const submitDisabled = (() => {
    switch (answerType) {
      case "slider":
      case "power_term":
      case "order_list":
      case "riemann":
        return false;
      case "graph_point":
        return clickedX === null;
      case "predict_point":
        return predictX === null;
      case "drag_drop":
        return !(
          Array.isArray(answer) &&
          dragDropBlankCount > 0 &&
          answer.filter((v) => v != null).length === dragDropBlankCount
        );
      case "multi_choice":
        return !(
          Array.isArray(answer) &&
          multiChoicePartCount > 0 &&
          answer.filter((v) => v != null).length === multiChoicePartCount
        );
      case "match":
        return !(
          Array.isArray(answer) &&
          matchPairCount > 0 &&
          answer.filter((v) => v != null).length === matchPairCount
        );
      case "sign_chart":
        return !(
          Array.isArray(answer) &&
          signChartRegionCount > 0 &&
          answer.filter((v) => v != null).length === signChartRegionCount
        );
      default:
        return answer === undefined || answer === "";
    }
  })();

  // The exact value the learner is committing, shared by submit, the tutor, and
  // the live proximity meter.
  const currentAnswer = effectiveAnswerOf();

  // Goal zone for a live slider step, derived from the answer's value ± tolerance.
  const liveBand =
    liveEnabled && step.interaction?.answer?.type === "slider"
      ? {
          lo:
            step.interaction.answer.value -
            (step.interaction.answer.tolerance ?? 0.01),
          hi:
            step.interaction.answer.value +
            (step.interaction.answer.tolerance ?? 0.01),
        }
      : null;

  // Once a prediction is committed correctly, reveal the true feature at the
  // accepted target nearest the learner's guess.
  const predictReveal =
    isPredict &&
    isCorrectAnswered &&
    step.interaction?.answer?.type === "predict_point"
      ? (() => {
          const a = step.interaction.answer;
          const guess = predictX ?? a.x;
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

  const graphSection = step.interaction?.graph ? (
    <GraphWidget
      config={step.interaction.graph}
      sliderValue={graphValue}
      onSliderChange={(v) => {
        // After a live lock-in the slider freezes so the "Got it" state holds.
        if (submitted && liveEnabled) return;
        setGraphValue(v);
        clearAfterWrong();
        liveEvaluate(v);
      }}
      showSlider={!isTapPoint && !isPredict && !step.interaction.graph.static}
      onPointClick={
        isTapPoint
          ? (x) => {
              setClickedX(x);
              clearAfterWrong();
            }
          : undefined
      }
      selectedX={isTapPoint ? clickedX : null}
      draggablePoint={isPredict && !submitted}
      predictX={isPredict ? predictX : null}
      onPredictDrag={
        isPredict
          ? (x) => {
              setPredictX(x);
              clearAfterWrong();
            }
          : undefined
      }
      targetBand={liveBand}
      satisfied={liveEnabled && isCorrectAnswered}
      reveal={predictReveal}
    />
  ) : null;

  // Live "warmer/colder" nudge shown while a live step is being tuned, before it
  // locks in. Purely a feel aid; the verdict is still checkAnswer's.
  // Predict steps also get the warmer/colder nudge while the marker is dragged,
  // before the guess is locked in and the truth is revealed.
  const liveProximity =
    (liveEnabled || isPredict) && !submitted
      ? answerProximity(step, currentAnswer)
      : null;
  const liveCloseness =
    liveProximity == null
      ? 0
      : Math.max(0, Math.min(1, 1 - Math.abs(liveProximity) / liveScale(step)));
  const liveHint =
    liveProximity == null || liveProximity === 0
      ? ""
      : answerType === "slider" || answerType === "predict_point"
        ? liveProximity > 0
          ? "Nudge it left"
          : "Nudge it right"
        : liveProximity > 0
          ? "A bit lower"
          : "A bit higher";

  const contentSection = (
    <div className="space-y-4">
      {!isRead && step.interaction?.answer && !usesWidgetAnswer && (
        <AnswerInput
          spec={step.interaction.answer}
          value={answer}
          onChange={(v) => {
            setAnswer(v);
            clearAfterWrong();
            liveEvaluate(v);
          }}
          disabled={submitted}
          reveal={submitted}
          isCorrect={feedback.isCorrect === true}
          live={liveEnabled && !submitted}
        />
      )}
      {liveProximity !== null && (
        <LiveProximityMeter
          closeness={liveCloseness}
          hint={liveHint}
          label={step.interaction?.goalLabel}
        />
      )}
      <FeedbackPanel
        message={feedback.message}
        isCorrect={feedback.isCorrect}
        hint={feedback.hint}
        hintRevealed={hintRevealed}
        onRevealHint={() => setHintRevealed(true)}
        prominentHint={submitted && feedback.isCorrect === false}
      />
      {submitted && feedback.isCorrect !== null && !isRead && (
        <TutorPanel
          key={`${step.id}-${feedback.isCorrect}`}
          step={step}
          answer={currentAnswer}
          attempts={lessonProgress?.stepAttempts[step.id] ?? 1}
          isCorrect={feedback.isCorrect === true}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>{lesson.title}</span>
          <span>
            Step {stepIndex + 1} of {total}
          </span>
        </div>
        <StepNavBar
          states={stepStates}
          currentIndex={stepIndex}
          maxSelectableIndex={maxSelectableIndex}
          onSelect={handleSelectStep}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
          <ContentBlocks blocks={step.content} />
          {step.interaction?.graph && graphSection}
          {contentSection}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t border-slate-200 safe-bottom">
        <div className="flex gap-3 w-full max-w-2xl mx-auto">
          {!practiceMode && stepIndex > 0 && (
            <button
              type="button"
              onClick={goToPrevStep}
              className="min-h-[48px] px-5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-base hover:bg-slate-50 active:scale-[0.98] transition"
            >
              Back
            </button>
          )}
          {isInstruction || isCorrectAnswered ? (
            <button
              type="button"
              onClick={isInstruction ? handleContinueRead : goToNextStep}
              className={`flex-1 min-h-[48px] rounded-xl font-semibold text-base text-white active:scale-[0.98] transition ${
                isCorrectAnswered
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isCorrectAnswered && stepIndex >= total - 1
                ? practiceMode
                  ? "See Results"
                  : "Finish"
                : "Continue"}
            </button>
          ) : liveEnabled ? (
            <div className="flex-1 min-h-[48px] rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 flex items-center justify-center text-center text-base font-medium text-slate-500">
              {step.interaction?.goalLabel ?? "Adjust until it locks in"}
            </div>
          ) : isWrongAnswered ? (
            <button
              type="button"
              onClick={retryStep}
              className="flex-1 min-h-[48px] rounded-xl bg-rose-600 text-white font-semibold text-base hover:bg-rose-700 active:scale-[0.98] transition"
            >
              Try Again
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 disabled:opacity-40 active:scale-[0.98] transition"
            >
              {isPredict ? "Lock In Prediction" : "Check Answer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
