import { useState, useCallback, useEffect, useRef } from "react";
import type { Lesson, Step, PracticeResult } from "../../types/content";
import { checkAnswer } from "../../lib/feedbackEngine";
import { ContentBlocks } from "../widgets/MathBlock";
import { GraphWidget } from "../widgets/GraphWidget";
import { AnswerInput } from "../widgets/AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";
import { StepNavBar, type StepState } from "./StepNavBar";
import { useProgress, isLessonDone } from "../../contexts/ProgressContext";

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

  // Practice scoring: each question counts toward the score only on its first
  // submission, so "Try Again" retries don't inflate the result.
  const scoredStepIds = useRef<Set<string>>(new Set());
  const correctFirstTry = useRef(0);

  const step: Step = lesson.steps[stepIndex];
  const isRead = step.type === "read";
  const total = lesson.steps.length;

  const answerType = step.interaction?.answer?.type;
  const isTapPoint = answerType === "graph_point";
  const usesWidgetAnswer = answerType === "slider" || answerType === "graph_point";

  // Reset interactive widget state whenever the step changes.
  useEffect(() => {
    const s = lesson.steps[stepIndex];
    setGraphValue(graphInitial(s));
    setClickedX(null);
    setHintRevealed(false);
    // The derivative builder starts from the original term so the learner
    // performs the power-rule transformation themselves.
    const a = s.interaction?.answer;
    if (a?.type === "power_term") {
      setAnswer({
        coefficient: a.startCoefficient ?? 1,
        exponent: a.startExponent ?? 1,
      });
    }
  }, [stepIndex, lesson]);

  const handleSubmit = useCallback(async () => {
    if (isRead) return;

    const effectiveAnswer =
      answerType === "slider"
        ? graphValue
        : answerType === "graph_point"
          ? clickedX
          : answer;

    const result = checkAnswer(step, effectiveAnswer);

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

    if (practiceMode) {
      if (!scoredStepIds.current.has(step.id)) {
        scoredStepIds.current.add(step.id);
        if (result.correct) correctFirstTry.current += 1;
      }
      return;
    }

    await updateStepProgress(
      lesson.id,
      stepIndex,
      step.id,
      effectiveAnswer,
      result.correct,
    );
  }, [
    answer,
    answerType,
    graphValue,
    clickedX,
    isRead,
    lesson,
    step,
    stepIndex,
    practiceMode,
    updateStepProgress,
  ]);

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
    setGraphValue(graphInitial(lesson.steps[stepIndex]));
    // Reset the builder back to the original term so the retry starts clean.
    const a = lesson.steps[stepIndex].interaction?.answer;
    setAnswer(
      a?.type === "power_term"
        ? { coefficient: a.startCoefficient ?? 1, exponent: a.startExponent ?? 1 }
        : undefined,
    );
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
    if (s.type === "read") return "info";
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
  const submitDisabled =
    answerType === "slider" || answerType === "power_term"
      ? false
      : answerType === "graph_point"
        ? clickedX === null
        : answerType === "drag_drop"
          ? !(
              Array.isArray(answer) &&
              dragDropBlankCount > 0 &&
              answer.filter((v) => v != null).length === dragDropBlankCount
            )
          : answerType === "multi_choice"
            ? !(
                Array.isArray(answer) &&
                multiChoicePartCount > 0 &&
                answer.filter((v) => v != null).length === multiChoicePartCount
              )
            : answerType === "match"
              ? !(
                  Array.isArray(answer) &&
                  matchPairCount > 0 &&
                  answer.filter((v) => v != null).length === matchPairCount
                )
              : answer === undefined || answer === "";

  const graphSection = step.interaction?.graph ? (
    <GraphWidget
      config={step.interaction.graph}
      sliderValue={graphValue}
      onSliderChange={(v) => {
        setGraphValue(v);
        clearAfterWrong();
      }}
      showSlider={!isTapPoint && !step.interaction.graph.static}
      onPointClick={
        isTapPoint
          ? (x) => {
              setClickedX(x);
              clearAfterWrong();
            }
          : undefined
      }
      selectedX={isTapPoint ? clickedX : null}
    />
  ) : null;

  const contentSection = (
    <div className="space-y-4">
      {!isRead && step.interaction?.answer && !usesWidgetAnswer && (
        <AnswerInput
          spec={step.interaction.answer}
          value={answer}
          onChange={(v) => {
            setAnswer(v);
            clearAfterWrong();
          }}
          disabled={submitted}
          reveal={submitted}
          isCorrect={feedback.isCorrect === true}
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
          {isRead || isCorrectAnswered ? (
            <button
              type="button"
              onClick={isRead ? handleContinueRead : goToNextStep}
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
              onClick={() => void handleSubmit()}
              disabled={submitDisabled}
              className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 disabled:opacity-40 active:scale-[0.98] transition"
            >
              Check Answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
