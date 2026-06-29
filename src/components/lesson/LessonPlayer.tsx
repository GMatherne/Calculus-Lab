import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Lesson, Step, PracticeResult } from "../../types/content";
import {
  isInstructionStep,
  isMultiPart,
  getStepParts,
  partAsStep,
} from "../../lib/stepHelpers";
import { checkAnswer } from "../../lib/feedbackEngine";
import { correctAnswerValue, solutionBlocks } from "../../lib/solutionService";
import { playSound } from "../../lib/sound";
import { ContentBlocks, RichText } from "../widgets/MathBlock";
import { GraphWidget } from "../widgets/GraphWidget";
import { AnswerInput } from "../widgets/AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";
import { TutorPanel } from "./TutorPanel";
import { SolutionPanel } from "./SolutionPanel";
import { ConceptSandbox } from "./ConceptSandbox";
import { PowerRuleAnimation } from "./PowerRuleAnimation";
import { POWER_RULE_BEAT_COUNT, powerRuleBeatCaption } from "./powerRuleBeats";
import { PolynomialSolveAnimation } from "./PolynomialSolveAnimation";
import { FtcEvaluateAnimation } from "./FtcEvaluateAnimation";
import {
  polynomialBeatCount,
  polynomialBeatCaption,
  ftcEvaluateBeatCount,
  ftcEvaluateCaption,
} from "./polynomialBeats";
import { RiemannRefineAnimation } from "./RiemannRefineAnimation";
import {
  riemannRefineBeatCount,
  riemannRefineCaption,
} from "./riemannRefineBeats";
import { AssistanceToggle } from "./AssistanceToggle";
import { StepNavBar, type StepState } from "./StepNavBar";
import { useProgress, isLessonDone } from "../../contexts/ProgressContext";
import { useSessionInsights } from "../../contexts/SessionInsightsContext";
import { useAssistancePreference } from "../../hooks/useAssistancePreference";
import { useActionLock } from "../../hooks/useActionLock";
import {
  seedAnswer,
  predictStartX,
  graphInitial,
  lerp,
  isTweenable,
  lerpAnswer,
  DEFAULT_SECANT_CAPTIONS,
} from "./lessonPlayerHelpers";
import { LockedPart, type SolvedPartSnapshot } from "./LockedPart";
import { usePracticeScore } from "./usePracticeScore";

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
  // Which part of a multi-part question is active. Single-part steps stay at 0.
  const [partIndex, setPartIndex] = useState(0);
  // Follow-up parts already cleared on this step, rendered in full but locked
  // above the active one so the question reads as one scrollable thread.
  const [solvedParts, setSolvedParts] = useState<SolvedPartSnapshot[]>([]);
  const [answer, setAnswer] = useState<unknown>(undefined);
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
  const { updateStepProgress, markStepSolved, progress } = useProgress();
  const { recordAnswer } = useSessionInsights();
  // Sticky assistance preference (solve / hints / none), persisted per learner.
  const [level, setLevel] = useAssistancePreference();
  // "Solve it" walkthrough: false until the learner presses "Work through it",
  // after which the widget animates to the answer and the solution is revealed.
  const [solveRevealed, setSolveRevealed] = useState(false);
  // Second phase of the secant walkthrough: once the moving point reaches its
  // target, reveal the rise/run triangle and the Δy / Δx rate-of-change readout.
  const [solveRiseRun, setSolveRiseRun] = useState(false);
  // Current caption shown above the graph during a narrated walkthrough.
  const [solveCaption, setSolveCaption] = useState("");
  // Which narrated caption the learner is reading; they advance manually so they
  // can read each beat and watch the graph settle before moving on.
  const [solvePhaseIdx, setSolvePhaseIdx] = useState(0);
  // True once a narrated walkthrough finishes, so the answer + full solution show.
  const [solveNarrateReveal, setSolveNarrateReveal] = useState(false);
  // Active requestAnimationFrame id for the solve walkthrough tween, if any.
  const solveAnimRef = useRef<number | null>(null);
  // Mirrors graphValue so a narrated phase can tween from the slider's current
  // position even when the learner advances mid-animation.
  const graphValueRef = useRef(graphValue);

  // Practice/review scoring (first-try count, bonus XP, per-concept tally), read
  // once when the session ends.
  const { record: scoreQuestion, result: getPracticeResult } = usePracticeScore();
  // Wrong submissions across every part of the current step, so a multi-part
  // question is "first try" only when no part was missed.
  const wrongCount = useRef(0);
  // Each cleared part's committed answer, persisted together when the step ends.
  const partAnswers = useRef<unknown[]>([]);
  // Submissions on the active part, passed to the tutor for tone only.
  const partAttempts = useRef(0);
  // Wrapper around the active part, so revealing a follow-up can smoothly scroll
  // it into view while the cleared parts stay above to scroll back to.
  const activePartRef = useRef<HTMLDivElement>(null);

  const step: Step = lesson.steps[stepIndex];
  // Every part of the step in display order; index 0 is the step's own
  // interaction. A single-part step yields a one-element array.
  const parts = useMemo(() => getStepParts(step), [step]);
  const activePart = parts[partIndex] ?? parts[0];
  // The active part viewed as a Step, so grading/proximity/tutor stay uniform.
  const activeStep = useMemo(
    () => partAsStep(step, activePart),
    [step, activePart],
  );
  // Worked-solution blocks for the "solve" walkthrough, memoized so the panel's
  // staggered reveal doesn't restart on every render.
  const solutionBlocksMemo = useMemo(() => solutionBlocks(step), [step]);
  const multiPart = isMultiPart(step);
  const isFinalPart = partIndex >= parts.length - 1;

  const isRead = step.type === "read";
  // Read steps and Riemann demos both advance ungraded with a "Continue" button.
  // `isRead` still gates the answer widget so a demo's interactive widget renders.
  const isInstruction = isInstructionStep(step);
  const total = lesson.steps.length;

  const activeGraph = activePart.interaction?.graph;
  const answerType = activeStep.interaction?.answer?.type;
  const isTapPoint = answerType === "graph_point";
  const isPredict = answerType === "predict_point";
  const usesWidgetAnswer =
    answerType === "slider" ||
    answerType === "graph_point" ||
    answerType === "predict_point";
  // Assistance level for this question. "Solve" (a worked example) is offered on
  // lesson questions only; practice clamps it to "hints" since practice never
  // solves a question for the learner.
  const hasAnswer = Boolean(activeStep.interaction?.answer);
  const effectiveLevel = practiceMode && level === "solve" ? "hints" : level;
  const solveActive =
    effectiveLevel === "solve" && !isInstruction && !practiceMode && hasAnswer;
  // Once the learner presses "Work through it" the answer is revealed and the
  // widget freezes/animates; before that the question is interactive (armed).
  const solveReveal = solveActive && solveRevealed;
  // Manual, captioned walkthroughs (narrated graph beats, the secant rate-of-
  // change demo, and the power-rule exponent drop) all step through by hand and
  // hold the answer back until the last beat; other solves reveal as they animate.
  const solveAnim = step.solveAnimation;
  const isManualSolve =
    solveActive &&
    (solveAnim?.kind === "narrated" ||
      solveAnim?.kind === "secant" ||
      solveAnim?.kind === "power_rule" ||
      solveAnim?.kind === "polynomial" ||
      solveAnim?.kind === "antiderivative" ||
      solveAnim?.kind === "riemann_refine" ||
      solveAnim?.kind === "ftc_evaluate");
  const walkthroughBeats =
    solveAnim?.kind === "narrated"
      ? solveAnim.phases.length
      : solveAnim?.kind === "secant"
        ? solveAnim.captions?.length ?? DEFAULT_SECANT_CAPTIONS.length
        : solveAnim?.kind === "power_rule"
          ? POWER_RULE_BEAT_COUNT
          : solveAnim?.kind === "polynomial" ||
              solveAnim?.kind === "antiderivative"
            ? polynomialBeatCount(solveAnim.terms)
            : solveAnim?.kind === "riemann_refine"
              ? riemannRefineBeatCount(solveAnim.counts)
              : solveAnim?.kind === "ftc_evaluate"
                ? ftcEvaluateBeatCount(solveAnim.terms)
                : 0;
  const answerRevealed = solveReveal && (!isManualSolve || solveNarrateReveal);
  // Continuous grading: judge as the learner manipulates and confirm the instant
  // the answer is satisfied — no "Check Answer" press. Reserved for the smoothly
  // tunable inputs; graph_point taps and predict steps keep their own flows.
  // Disabled while solving, where the answer is shown rather than graded.
  const liveEnabled =
    activeStep.interaction?.liveCheck === true &&
    !isInstruction &&
    !solveActive &&
    (answerType === "slider" ||
      answerType === "numeric" ||
      answerType === "power_term");
  // The "hints" assistance level offers the proactive text hint and an optional
  // concept sandbox; it never surfaces answer-revealing proximity feedback.
  const hintsActive = effectiveLevel === "hints" && !isInstruction && !solveActive;

  // Reset interactive widget state whenever the active part changes (a new step
  // or the next follow-up part). Types that begin from a non-empty state are
  // seeded here so they open ready to manipulate; the rest start blank.
  useEffect(() => {
    const s = lesson.steps[stepIndex];
    const p = getStepParts(s)[partIndex] ?? getStepParts(s)[0];
    const asStep = partAsStep(s, p);
    setHintRevealed(false);
    setSubmitted(false);
    setFeedback({ isCorrect: null, message: "" });
    // A "solve" step opens as the real, interactive question; the answer is only
    // revealed once the learner presses "Work through it" (see startSolveReveal).
    setSolveRevealed(false);
    setSolveRiseRun(false);
    setSolveCaption("");
    setSolvePhaseIdx(0);
    setSolveNarrateReveal(false);
    if (solveAnimRef.current !== null) {
      cancelAnimationFrame(solveAnimRef.current);
      solveAnimRef.current = null;
    }
    setGraphValue(graphInitial(asStep));
    setClickedX(null);
    setPredictX(predictStartX(asStep));
    setAnswer(seedAnswer(asStep));
  }, [stepIndex, partIndex, lesson, solveActive]);

  // Cancel any in-flight solve walkthrough tween on unmount.
  useEffect(
    () => () => {
      if (solveAnimRef.current !== null) cancelAnimationFrame(solveAnimRef.current);
    },
    [],
  );

  // Keep the latest slider value in a ref so a narrated phase can start its tween
  // from wherever the slider currently sits (e.g. if the learner advanced early).
  useEffect(() => {
    graphValueRef.current = graphValue;
  }, [graphValue]);

  // When a follow-up part is revealed, smoothly scroll it into view so the
  // learner is carried down the thread to the next part. Skipped at part 0 so
  // arriving on a fresh step doesn't yank the scroll position.
  useEffect(() => {
    if (partIndex === 0) return;
    activePartRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [partIndex]);

  // Commit a verdict to the UI and progress. Shared by the explicit "Check
  // Answer" press and the live (continuous) confirmation, so a live lock-in and a
  // classic submit are scored and persisted identically. For a multi-part
  // question only the final part ends the question; earlier parts just reveal the
  // next one, and nothing is scored or persisted until the whole chain is done.
  const applyResult = useCallback(
    (result: ReturnType<typeof checkAnswer>, effectiveAnswer: unknown) => {
      partAttempts.current += 1;
      // The hint is available on a wrong answer but stays hidden until the
      // learner explicitly asks for it (so it never gives the answer away).
      setHintRevealed(false);
      setFeedback({
        isCorrect: result.correct,
        message: result.message,
        hint: result.correct ? undefined : result.hint,
      });
      setSubmitted(true);

      // Feed the in-memory session tally that personalizes the AI tutor, using
      // the active part's concept. Recorded for both lesson and practice modes.
      recordAnswer(activePart.conceptTag ?? step.conceptTag, result.correct);

      if (!result.correct) {
        playSound("incorrect");
        wrongCount.current += 1;
        // Single-part lesson steps keep the existing per-submit persistence so
        // their attempt count and activity bumps are unchanged; multi-part
        // defers all persistence until the whole question is cleared.
        if (!multiPart && !practiceMode) {
          void updateStepProgress(
            lesson.id,
            stepIndex,
            step.id,
            effectiveAnswer,
            false,
          );
        }
        return;
      }

      playSound("correct");

      // Correct, but a follow-up part remains: keep the committed answer and let
      // the learner read the confirmation, then advance. The solved card is added
      // on advance (goToNextPart), so the just-answered part isn't shown twice.
      if (!isFinalPart) {
        partAnswers.current = [...partAnswers.current, effectiveAnswer];
        return;
      }

      // Correct and final (also the single-part case): the whole question is done.
      setCompletedStepIds((prev) => {
        if (prev.has(step.id)) return prev;
        const next = new Set(prev);
        next.add(step.id);
        return next;
      });
      // Clearing a question unlocks the next step for navigation.
      setMaxReachedIndex((m) => Math.max(m, stepIndex + 1));

      const firstTry = wrongCount.current === 0;

      if (practiceMode) {
        scoreQuestion({
          stepId: step.id,
          conceptTag: step.conceptTag,
          firstTry,
          multiPart,
        });
        return;
      }

      // Lesson mode: record the whole question once. Multi-part overrides the
      // attempt count so mastery's "first try" (attempts === 1) holds iff no
      // part was missed; single-part keeps the default incrementing behavior.
      if (multiPart) {
        void updateStepProgress(
          lesson.id,
          stepIndex,
          step.id,
          [...partAnswers.current, effectiveAnswer],
          true,
          1 + wrongCount.current,
        );
      } else {
        void updateStepProgress(
          lesson.id,
          stepIndex,
          step.id,
          effectiveAnswer,
          true,
        );
      }
    },
    [
      step,
      activePart,
      multiPart,
      isFinalPart,
      stepIndex,
      practiceMode,
      updateStepProgress,
      recordAnswer,
      lesson.id,
      scoreQuestion,
    ],
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
    applyResult(checkAnswer(activeStep, effectiveAnswer), effectiveAnswer);
  }, [isInstruction, effectiveAnswerOf, activeStep, applyResult]);

  // Live grading on each manipulation of a `liveCheck` step: the first time the
  // answer is satisfied we lock it in (confirm, don't teleport). Wrong states are
  // never surfaced here — the learner just keeps tuning — so the first satisfy is
  // a clean first-try in practice scoring.
  const liveEvaluate = useCallback(
    (value: unknown) => {
      if (!liveEnabled || submitted) return;
      const result = checkAnswer(activeStep, value);
      if (result.correct) applyResult(result, value);
    },
    [liveEnabled, submitted, activeStep, applyResult],
  );

  // Jump to any step and clear the current attempt's transient state, including
  // any multi-part progress. The graph widgets reset via the effect keyed on the
  // active part.
  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= total || index === stepIndex) return;
      setStepIndex(index);
      setPartIndex(0);
      setSolvedParts([]);
      wrongCount.current = 0;
      partAnswers.current = [];
      partAttempts.current = 0;
      setAnswer(undefined);
      setFeedback({ isCorrect: null, message: "" });
      setSubmitted(false);
    },
    [stepIndex, total],
  );

  // Reveal the next follow-up part of the current step after the active one is
  // cleared. Snapshots the just-cleared part (with its committed widget state) so
  // it stays rendered, locked, above; keeps the step's accumulated multi-part
  // state (wrong count, part answers); and resets only the per-part attempt UI.
  const goToNextPart = useCallback(() => {
    setSolvedParts((prev) => [
      ...prev,
      { part: activePart, answer, graphValue, clickedX, predictX },
    ]);
    setPartIndex((i) => i + 1);
    partAttempts.current = 0;
    setAnswer(undefined);
    setFeedback({ isCorrect: null, message: "" });
    setSubmitted(false);
    setHintRevealed(false);
  }, [activePart, answer, graphValue, clickedX, predictX]);

  const goToNextStep = useCallback(() => {
    if (stepIndex >= total - 1) {
      onComplete(practiceMode ? getPracticeResult(total) : undefined);
    } else {
      setMaxReachedIndex((m) => Math.max(m, stepIndex + 1));
      goToStep(stepIndex + 1);
    }
  }, [stepIndex, total, onComplete, practiceMode, goToStep, getPracticeResult]);

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

  // "Try Again" fully resets the current part's attempt: choices unlock, the red
  // marking and feedback clear, and any entered value is wiped for a clean retry.
  const retryStep = useCallback(() => {
    setSubmitted(false);
    setFeedback({ isCorrect: null, message: "" });
    setHintRevealed(false);
    setClickedX(null);
    setPredictX(predictStartX(activeStep));
    setGraphValue(graphInitial(activeStep));
    // Reseed builders (e.g. power_term, order_list, riemann) so the retry starts
    // from a clean, manipulable state rather than a blank one.
    setAnswer(seedAnswer(activeStep));
  }, [activeStep]);

  // "Solve it" worked example: record the whole step as solved (advances the
  // lesson but is excluded from mastery) and move on. Lesson mode only.
  const handleSolveContinue = useCallback(() => {
    void markStepSolved(lesson.id, stepIndex, step.id, correctAnswerValue(step));
    setCompletedStepIds((prev) => {
      if (prev.has(step.id)) return prev;
      const next = new Set(prev);
      next.add(step.id);
      return next;
    });
    setMaxReachedIndex((m) => Math.max(m, stepIndex + 1));
    goToNextStep();
  }, [step, stepIndex, lesson.id, markStepSolved, goToNextStep]);

  // Set the active widget to its correct value. Used to reveal the answer at the
  // end of a manual walkthrough.
  const revealAnswerValue = useCallback(() => {
    const target = correctAnswerValue(activeStep);
    if (target === undefined) return;
    if (answerType === "slider" && typeof target === "number") setGraphValue(target);
    else if (answerType === "graph_point" && typeof target === "number")
      setClickedX(target);
    else if (answerType === "predict_point" && typeof target === "number")
      setPredictX(target);
    else setAnswer(target);
  }, [activeStep, answerType]);

  // Ease the graph's slider from one value to another over `ms`, cancelling any
  // tween already in flight. Shared by every manual walkthrough beat.
  const tweenSlider = useCallback((from: number, to: number, ms: number) => {
    if (solveAnimRef.current !== null) {
      cancelAnimationFrame(solveAnimRef.current);
      solveAnimRef.current = null;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setGraphValue(to);
      return;
    }
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      setGraphValue(lerp(from, to, ease(t)));
      if (t < 1) solveAnimRef.current = requestAnimationFrame(tick);
      else solveAnimRef.current = null;
    };
    solveAnimRef.current = requestAnimationFrame(tick);
  }, []);

  // Show one walkthrough beat and move its visual into place, then hold. The
  // learner reads at their own pace and presses to advance, so each beat's
  // caption and graph/animation state can be studied together. The beat shape
  // depends on the recipe: narrated tweens the slider to a target, secant draws
  // the chord then the rise/run, and power_rule drives the exponent-drop frame.
  const goToWalkthroughBeat = useCallback(
    (i: number) => {
      const anim = step.solveAnimation;
      if (!anim) return;
      setSolvePhaseIdx(i);
      if (anim.kind === "narrated") {
        const ph = anim.phases[i];
        if (!ph) return;
        setSolveCaption(ph.text);
        if (ph.to !== undefined) {
          tweenSlider(graphValueRef.current, ph.to, ph.ms ?? 1200);
        } else if (solveAnimRef.current !== null) {
          cancelAnimationFrame(solveAnimRef.current);
          solveAnimRef.current = null;
        }
      } else if (anim.kind === "secant") {
        const caps = anim.captions ?? DEFAULT_SECANT_CAPTIONS;
        setSolveCaption(caps[Math.min(i, caps.length - 1)]);
        if (i === 0) {
          // Draw the secant: the second point eases from near the fixed point
          // out to b, with the rise/run held back until the next beat.
          setSolveRiseRun(false);
          tweenSlider(anim.a + (anim.b - anim.a) * 0.15, anim.b, 1300);
        } else {
          if (solveAnimRef.current !== null) {
            cancelAnimationFrame(solveAnimRef.current);
            solveAnimRef.current = null;
          }
          setGraphValue(anim.b);
          setSolveRiseRun(true);
        }
      } else if (anim.kind === "power_rule") {
        const term = activeStep.interaction?.answer;
        const a = term?.type === "power_term" ? term.startCoefficient ?? 1 : 1;
        const n = term?.type === "power_term" ? term.startExponent ?? 1 : 1;
        setSolveCaption(powerRuleBeatCaption(a, n, i, anim.captions));
      } else if (anim.kind === "polynomial") {
        setSolveCaption(
          polynomialBeatCaption(anim.terms, i, "differentiate", anim.captions),
        );
      } else if (anim.kind === "antiderivative") {
        setSolveCaption(
          polynomialBeatCaption(anim.terms, i, "integrate", anim.captions),
        );
      } else if (anim.kind === "riemann_refine") {
        setSolveCaption(
          riemannRefineCaption(i, riemannRefineBeatCount(anim.counts), anim.captions),
        );
      } else if (anim.kind === "ftc_evaluate") {
        setSolveCaption(
          ftcEvaluateCaption(anim.terms, anim.a, anim.b, i, anim.captions),
        );
      }
    },
    [step.solveAnimation, activeStep, tweenSlider],
  );

  // Snap a manual walkthrough straight to its final beat and reveal the answer —
  // used for reduced-motion, where stepping through animated beats adds nothing.
  const finishWalkthrough = useCallback(() => {
    const anim = step.solveAnimation;
    if (!anim) return;
    if (solveAnimRef.current !== null) {
      cancelAnimationFrame(solveAnimRef.current);
      solveAnimRef.current = null;
    }
    if (anim.kind === "narrated") {
      const last = anim.phases[anim.phases.length - 1];
      setSolvePhaseIdx(Math.max(0, anim.phases.length - 1));
      if (last) {
        setSolveCaption(last.text);
        if (last.to !== undefined) setGraphValue(last.to);
      }
    } else if (anim.kind === "secant") {
      const caps = anim.captions ?? DEFAULT_SECANT_CAPTIONS;
      setSolvePhaseIdx(caps.length - 1);
      setSolveCaption(caps[caps.length - 1]);
      setGraphValue(anim.b);
      setSolveRiseRun(true);
    } else if (anim.kind === "power_rule") {
      const term = activeStep.interaction?.answer;
      const a = term?.type === "power_term" ? term.startCoefficient ?? 1 : 1;
      const n = term?.type === "power_term" ? term.startExponent ?? 1 : 1;
      setSolvePhaseIdx(POWER_RULE_BEAT_COUNT - 1);
      setSolveCaption(
        powerRuleBeatCaption(a, n, POWER_RULE_BEAT_COUNT - 1, anim.captions),
      );
    } else if (anim.kind === "polynomial" || anim.kind === "antiderivative") {
      const direction = anim.kind === "antiderivative" ? "integrate" : "differentiate";
      const last = polynomialBeatCount(anim.terms) - 1;
      setSolvePhaseIdx(last);
      setSolveCaption(polynomialBeatCaption(anim.terms, last, direction, anim.captions));
    } else if (anim.kind === "riemann_refine") {
      const total = riemannRefineBeatCount(anim.counts);
      setSolvePhaseIdx(total - 1);
      setSolveCaption(riemannRefineCaption(total - 1, total, anim.captions));
    } else if (anim.kind === "ftc_evaluate") {
      const last = ftcEvaluateBeatCount(anim.terms) - 1;
      setSolvePhaseIdx(last);
      setSolveCaption(ftcEvaluateCaption(anim.terms, anim.a, anim.b, last, anim.captions));
    }
    revealAnswerValue();
    setSolveNarrateReveal(true);
  }, [step.solveAnimation, activeStep, revealAnswerValue]);

  // Advance a manual walkthrough one beat: step to the next caption, or — on the
  // last one — reveal the answer and the full worked solution.
  const advanceWalkthrough = useCallback(() => {
    if (solvePhaseIdx < walkthroughBeats - 1) {
      goToWalkthroughBeat(solvePhaseIdx + 1);
      return;
    }
    if (solveAnimRef.current !== null) {
      cancelAnimationFrame(solveAnimRef.current);
      solveAnimRef.current = null;
    }
    if (step.solveAnimation?.kind === "secant") setSolveRiseRun(true);
    revealAnswerValue();
    setSolveNarrateReveal(true);
  }, [
    solvePhaseIdx,
    walkthroughBeats,
    goToWalkthroughBeat,
    revealAnswerValue,
    step.solveAnimation,
  ]);

  // "Work through it": start the worked example. Manual recipes (narrated, secant,
  // power_rule) enter their first beat and wait for the learner to step through;
  // other steps tween/sweep the widget to the answer and reveal it directly.
  const startSolveReveal = useCallback(() => {
    if (solveRevealed) return;
    setSolveRevealed(true);
    const at = answerType;
    const graph = activeGraph;
    const anim = step.solveAnimation;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Manual, captioned walkthroughs are advanced by hand, beat by beat.
    if (
      anim?.kind === "narrated" ||
      anim?.kind === "secant" ||
      anim?.kind === "power_rule" ||
      anim?.kind === "polynomial" ||
      anim?.kind === "antiderivative" ||
      anim?.kind === "riemann_refine" ||
      anim?.kind === "ftc_evaluate"
    ) {
      if (reduceMotion || walkthroughBeats === 0) finishWalkthrough();
      else goToWalkthroughBeat(0);
      return;
    }

    const target = correctAnswerValue(activeStep);
    if (target === undefined) return;

    // Reveal the answer in its widget (used for the snap path and final frame).
    const setSolvedAnswer = () => {
      if (at === "slider" && typeof target === "number") setGraphValue(target);
      else if (at === "graph_point" && typeof target === "number") setClickedX(target);
      else if (at === "predict_point" && typeof target === "number") setPredictX(target);
      else setAnswer(target);
    };

    const isPositionAnswer =
      at === "slider" || at === "graph_point" || at === "predict_point";
    // An exploratory slider graph (no recipe, slider isn't the answer) gets a
    // demo sweep across its range, so the curve visibly animates even when the
    // answer is typed or picked. Slider/graph_point/predict answers animate the
    // answer position itself instead.
    const sweep = !!graph && !graph.static && !isPositionAnswer;
    const sweepLo = graph ? graph.sliderMin ?? graph.domain[0] : 0;
    const sweepHi = graph ? graph.sliderMax ?? graph.domain[1] : 1;
    const sweepHome = graph ? graph.initialSlider ?? sweepLo : 0;

    const tweenAnswer = isTweenable(at);
    if (reduceMotion || (!tweenAnswer && !sweep)) {
      setSolvedAnswer();
      return;
    }

    // A picked/placed answer shown alongside a sweep is revealed up front so the
    // learner sees it highlighted while the graph animates.
    if (!tweenAnswer) setSolvedAnswer();

    const startGraph = graphValue;
    const startClicked = clickedX ?? graphInitial(activeStep);
    const startPredict = predictX ?? predictStartX(activeStep) ?? 0;
    const startAnswer = answer;
    const t0 = performance.now();
    const durationMs = sweep ? 1500 : 1100;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const e = ease(t);
      if (tweenAnswer) {
        if (at === "slider" && typeof target === "number") {
          setGraphValue(lerp(startGraph, target, e));
        } else if (at === "graph_point" && typeof target === "number") {
          setClickedX(lerp(startClicked, target, e));
        } else if (at === "predict_point" && typeof target === "number") {
          setPredictX(lerp(startPredict, target, e));
        } else {
          setAnswer(lerpAnswer(at, startAnswer, target, e));
        }
      }
      if (sweep) {
        // Triangle wave: sweep low -> high -> low across the slider's range.
        const tri = t < 0.5 ? t * 2 : 2 - t * 2;
        setGraphValue(sweepLo + (sweepHi - sweepLo) * tri);
      }
      if (t < 1) {
        solveAnimRef.current = requestAnimationFrame(tick);
      } else {
        solveAnimRef.current = null;
        if (tweenAnswer) setSolvedAnswer();
        if (sweep) setGraphValue(sweepHome);
      }
    };
    solveAnimRef.current = requestAnimationFrame(tick);
  }, [
    solveRevealed,
    activeStep,
    answerType,
    activeGraph,
    step.solveAnimation,
    graphValue,
    clickedX,
    predictX,
    answer,
    walkthroughBeats,
    goToWalkthroughBeat,
    finishWalkthrough,
  ]);

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
  const activeAnswer = activePart.interaction?.answer;
  const dragDropBlankCount =
    activeAnswer?.type === "drag_drop" ? activeAnswer.blanks.length : 0;
  // Multi-choice questions can't be submitted until every row is answered.
  const multiChoicePartCount =
    activeAnswer?.type === "multi_choice" ? activeAnswer.parts.length : 0;
  // Match questions can't be submitted until every prompt has been matched.
  const matchPairCount =
    activeAnswer?.type === "match" ? activeAnswer.pairs.length : 0;
  // Sign-chart questions can't be submitted until every region is labeled.
  const signChartRegionCount =
    activeAnswer?.type === "sign_chart" ? activeAnswer.regions.length : 0;
  const submitDisabled = (() => {
    switch (answerType) {
      case "slider":
      case "power_term":
      case "order_list":
      case "riemann":
      case "construct_graph":
      case "tangent_line":
      case "integral_bounds":
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
      case "paint_intervals":
        // Needs at least one shaded segment before it can be checked.
        return !(Array.isArray(answer) && answer.some((v) => v === true));
      case "select_region":
        // Multi-select needs at least one band chosen; single-select needs a
        // (possibly index-0) band picked, so guard explicitly against blanks.
        return activeAnswer?.type === "select_region" && activeAnswer.multi
          ? !(Array.isArray(answer) && answer.some((v) => v === true))
          : answer === undefined || answer === null;
      default:
        return answer === undefined || answer === "";
    }
  })();

  // The exact value the learner is committing, shared by submit, the tutor, and
  // the live proximity meter.
  const currentAnswer = effectiveAnswerOf();

  // Once a prediction is committed correctly, reveal the true feature at the
  // accepted target nearest the learner's guess.
  const predictReveal =
    (isCorrectAnswered || solveReveal) &&
    isPredict &&
    activeStep.interaction?.answer?.type === "predict_point"
      ? (() => {
          const a = activeStep.interaction.answer;
          // Solve mode reveals the canonical target; a correct guess reveals the
          // accepted target nearest where the learner committed.
          const guess = predictX ?? a.x;
          const tx = solveReveal
            ? a.x
            : [a.x, ...(a.acceptX ?? [])].reduce((best, t) =>
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

  // A narrated walkthrough can draw a final feature (e.g. the flat tangent at a
  // tap-the-point answer) once its captions finish.
  const narratedReveal =
    solveNarrateReveal &&
    step.solveAnimation?.kind === "narrated" &&
    step.solveAnimation.reveal
      ? step.solveAnimation.reveal
      : null;

  // Explore mode: a manipulable point on the curve that drags directly (in
  // addition to the slider) but doesn't grade. Reserved for graphs paired with a
  // separate non-widget answer (multiple_choice/numeric); the widget-driven
  // answers (slider/graph_point/predict_point) already own the pointer gesture.
  const exploreEnabled =
    Boolean(activeGraph?.explore) && !usesWidgetAnswer && !solveActive;

  // The graph config used while the solve walkthrough is revealed: the secant
  // recipe drives a two-point rate-of-change demo (the slider stays shown so the
  // secant and its endpoints render and the slider tracks the moving point), and
  // every reveal hides the live x / f(x) readout so values don't flash.
  const revealGraphConfig = useMemo(() => {
    if (!solveReveal || !activeGraph) return undefined;
    const anim = step.solveAnimation;
    if (anim?.kind === "secant") {
      return {
        ...activeGraph,
        static: false,
        showSecant: true,
        showTangent: false,
        fixedPoint: anim.a,
        slopeLabel: anim.label ?? "Rate of change",
        showValue: false,
        // Beat 0 shows just the chord; the rise/run readout (Δy / Δx) carries the
        // slope once the triangle appears on beat 1, so the plain readout stays off.
        showSlopeValue: false,
        showSecantRiseRun: solveRiseRun,
      };
    }
    if (anim?.kind === "narrated") {
      // Keep the question's own tangent/secant/marker setup; just calm the live
      // f(x) readout and optionally force the slope or area readout on.
      return {
        ...activeGraph,
        showValue: false,
        ...(anim.showSlopeValue !== undefined
          ? { showSlopeValue: anim.showSlopeValue }
          : {}),
        ...(anim.showAreaValue !== undefined
          ? { showAreaValue: anim.showAreaValue }
          : {}),
      };
    }
    return { ...activeGraph, showValue: false, showSlopeValue: false };
  }, [solveReveal, activeGraph, step.solveAnimation, solveRiseRun]);

  const graphSection = activeGraph ? (
    <GraphWidget
      config={revealGraphConfig ?? activeGraph}
      sliderValue={graphValue}
      onSliderChange={(v) => {
        // After a live lock-in the slider freezes so the "Got it" state holds.
        // The slider stays interactive in "solve" mode too, so it never vanishes
        // and the learner can keep exploring during/after the walkthrough.
        if (submitted && liveEnabled) return;
        setGraphValue(v);
        clearAfterWrong();
        liveEvaluate(v);
      }}
      showSlider={!isTapPoint && !isPredict && !activeGraph.static}
      onPointClick={
        isTapPoint && !solveReveal
          ? (x) => {
              setClickedX(x);
              clearAfterWrong();
            }
          : undefined
      }
      selectedX={isTapPoint ? clickedX : null}
      draggablePoint={isPredict && !submitted && !solveReveal}
      exploreDrag={exploreEnabled}
      predictX={isPredict ? predictX : null}
      onPredictDrag={
        isPredict && !solveReveal
          ? (x) => {
              setPredictX(x);
              clearAfterWrong();
            }
          : undefined
      }
      satisfied={
        (liveEnabled && isCorrectAnswered) ||
        (answerRevealed && answerType === "slider")
      }
      reveal={predictReveal ?? narratedReveal}
    />
  ) : null;

  // Hint visibility by level: "none" hides it entirely; "hints" offers it
  // proactively (before submitting) and after a wrong answer; "solve" shows the
  // worked solution instead of a hint.
  const displayHint =
    effectiveLevel === "none"
      ? undefined
      : submitted
        ? feedback.hint
        : effectiveLevel === "hints"
          ? activeStep.feedback.hint
          : undefined;
  const hintProactive =
    !submitted && effectiveLevel === "hints" && Boolean(displayHint);
  // "No help" withholds the elaborated authored `incorrect` (often a near-worked
  // solution) so the learner keeps the retry/struggle; a brief verification shows
  // instead. Validation messages and the correct message are untouched, and
  // Hints/Solve keep the full feedback.
  const displayMessage =
    effectiveLevel === "none" &&
    feedback.isCorrect === false &&
    feedback.message === activeStep.feedback.incorrect
      ? "Not quite — give it another go."
      : feedback.message;

  // Power-rule "exponent drop" animation. The active power_term answer supplies
  // the source term (start → answer) for both the solve walkthrough and a brief
  // replay on a correct answer; a narrated graph step can also drop a symbolic
  // term above the plot so the rule and the slope resolve together.
  const powerTermSpec =
    activeStep.interaction?.answer?.type === "power_term"
      ? activeStep.interaction.answer
      : null;
  // The replay plays the power-rule "exponent drop", which DIFFERENTIATES the
  // term — right for a derivative builder, but the opposite of an antiderivative
  // builder (reverse power rule), where it would show d/dx of f instead of the
  // F the learner just found. Detect those (fraction mode, a "+ C" indefinite
  // integral, or an "F(x) =" preview) and skip the replay for them.
  const isAntiderivativeTerm =
    powerTermSpec != null &&
    (powerTermSpec.denominator != null ||
      powerTermSpec.plusC === true ||
      (powerTermSpec.previewPrefix?.includes("F(") ?? false));
  const powerRuleAnim =
    step.solveAnimation?.kind === "power_rule" ? step.solveAnimation : null;
  const solvePowerRule = Boolean(solveReveal && powerRuleAnim && powerTermSpec);
  const replayPowerRule = Boolean(
    !solveActive && isCorrectAnswered && powerTermSpec && !isAntiderivativeTerm,
  );
  const narratedTerm =
    solveReveal && step.solveAnimation?.kind === "narrated"
      ? step.solveAnimation.powerTerm
      : undefined;
  // A narrated walkthrough may carry polynomial terms: the sum animation then
  // drops one term per beat (driven by solvePhaseIdx) in step with the captions,
  // assembling f'(x) as the learner advances.
  const narratedTerms =
    solveReveal && step.solveAnimation?.kind === "narrated"
      ? step.solveAnimation.terms
      : undefined;
  // Bespoke solve walkthroughs that draw their own visual, driven beat-by-beat
  // by solvePhaseIdx: the polynomial/antiderivative term assembly and the
  // Riemann-sum refinement. Active only while the solve is revealed.
  const solvePolynomial =
    solveReveal && step.solveAnimation?.kind === "polynomial"
      ? step.solveAnimation
      : null;
  const solveAntideriv =
    solveReveal && step.solveAnimation?.kind === "antiderivative"
      ? step.solveAnimation
      : null;
  const solveRiemann =
    solveReveal && step.solveAnimation?.kind === "riemann_refine"
      ? step.solveAnimation
      : null;
  const solveFtcEval =
    solveReveal && step.solveAnimation?.kind === "ftc_evaluate"
      ? step.solveAnimation
      : null;

  const contentSection = (
    <div className="space-y-4">
      {solvePowerRule && powerTermSpec && (
        <PowerRuleAnimation
          coefficient={powerTermSpec.startCoefficient ?? 1}
          exponent={powerTermSpec.startExponent ?? 1}
          beat={solvePhaseIdx}
        />
      )}
      {solvePolynomial && (
        <PolynomialSolveAnimation
          terms={solvePolynomial.terms}
          direction="differentiate"
          beat={solvePhaseIdx}
        />
      )}
      {solveAntideriv && (
        <PolynomialSolveAnimation
          terms={solveAntideriv.terms}
          direction="integrate"
          beat={solvePhaseIdx}
          plusC
        />
      )}
      {solveRiemann && (
        <RiemannRefineAnimation
          fn={solveRiemann.fn}
          a={solveRiemann.a}
          b={solveRiemann.b}
          trueArea={solveRiemann.trueArea}
          domain={solveRiemann.domain}
          counts={solveRiemann.counts}
          beat={solvePhaseIdx}
        />
      )}
      {solveFtcEval && (
        <FtcEvaluateAnimation
          terms={solveFtcEval.terms}
          a={solveFtcEval.a}
          b={solveFtcEval.b}
          beat={solvePhaseIdx}
        />
      )}
      {!solvePowerRule && replayPowerRule && powerTermSpec && (
        <PowerRuleAnimation
          coefficient={powerTermSpec.startCoefficient ?? 1}
          exponent={powerTermSpec.startExponent ?? 1}
          replayKey={`${activeStep.id}-correct`}
          compact
        />
      )}
      {!isRead &&
        activePart.interaction?.answer &&
        !usesWidgetAnswer &&
        // Walkthroughs that animate the answer themselves (the power-rule stepper
        // and the polynomial drag assembly) hide the seeded widget until reveal,
        // so the still-unsolved widget doesn't sit beside the animation.
        !(
          solveReveal &&
          !answerRevealed &&
          (solveAnim?.kind === "power_rule" ||
            solveAnim?.kind === "polynomial" ||
            solveAnim?.kind === "antiderivative" ||
            solveAnim?.kind === "riemann_refine" ||
            solveAnim?.kind === "ftc_evaluate" ||
            Boolean(narratedTerms))
        ) && (
          <AnswerInput
            spec={activePart.interaction.answer}
            value={answer}
            onChange={(v) => {
              setAnswer(v);
              clearAfterWrong();
              liveEvaluate(v);
            }}
            disabled={submitted || solveReveal}
            reveal={submitted || answerRevealed}
            isCorrect={answerRevealed ? true : feedback.isCorrect === true}
            live={liveEnabled && !submitted}
          />
        )}
      {hintsActive && activeStep.interaction?.sandbox && (
        <ConceptSandbox
          key={activeStep.id}
          sandbox={activeStep.interaction.sandbox}
        />
      )}
      {solveActive ? (
        answerRevealed ? <SolutionPanel blocks={solutionBlocksMemo} /> : null
      ) : (
        <>
          <FeedbackPanel
            message={displayMessage}
            isCorrect={feedback.isCorrect}
            hint={displayHint}
            hintRevealed={hintRevealed}
            onRevealHint={() => {
              setHintRevealed(true);
              playSound("hint");
            }}
            prominentHint={submitted && feedback.isCorrect === false}
            proactive={hintProactive}
          />
          {submitted &&
            feedback.isCorrect !== null &&
            !isRead && (
              <TutorPanel
                key={`${activeStep.id}-${feedback.isCorrect}`}
                step={activeStep}
                answer={currentAnswer}
                attempts={Math.max(partAttempts.current, 1)}
                isCorrect={feedback.isCorrect === true}
              />
            )}
        </>
      )}
    </div>
  );

  // Label for the primary action: a cleared non-final part advances to the next
  // part; a cleared final part finishes the step (or the whole lesson/session).
  const primaryLabel = isInstruction
    ? "Continue"
    : !isFinalPart
      ? "Continue"
      : stepIndex >= total - 1
        ? practiceMode
          ? "See Results"
          : "Finish"
        : "Continue";

  // Manual walkthrough button state: while stepping through beats the action
  // advances the walkthrough (the learner controls the pace); only once the last
  // beat is shown does the normal "Continue" take over.
  const isWalkingThrough = Boolean(
    solveRevealed && isManualSolve && !solveNarrateReveal,
  );
  const isLastBeat = solvePhaseIdx >= walkthroughBeats - 1;

  // A step counts as already seen once the learner has moved past it — earlier
  // this session (the high-water mark), in a previous session (the saved
  // pointer), or because the lesson is finished and being reviewed. The first
  // time a step is reached it sits at the frontier, so `stepIndex` equals the
  // furthest reached and this is false.
  const stepSeen =
    lessonComplete || stepIndex < Math.max(savedIndex, maxReachedIndex);

  // Pacing gates that block the advance button so the learner reads/interacts
  // before moving on, but ONLY on a step's first encounter (never when revisiting
  // already-seen content): 3s on an information step (read or Riemann demo), and
  // 1s between each beat of a "solve" walkthrough. Keyed so each new step / beat
  // restarts the countdown.
  const readSecondsLeft = useActionLock(
    stepIndex,
    3000,
    isInstruction && !stepSeen,
  );
  const readLocked = readSecondsLeft > 0;
  const beatSecondsLeft = useActionLock(
    solvePhaseIdx,
    1000,
    isWalkingThrough && !stepSeen,
  );
  const beatLocked = beatSecondsLeft > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>{lesson.title}</span>
          <span>
            Step {stepIndex + 1} of {total}
            {multiPart && ` · Part ${partIndex + 1} of ${parts.length}`}
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
          {solvedParts.map((sp, i) => (
            <LockedPart key={`${sp.part.id}-${i}`} snap={sp} index={i} />
          ))}
          <div ref={activePartRef} className="flex flex-col gap-4 scroll-mt-4">
            {!isInstruction && (
              <AssistanceToggle
                value={effectiveLevel}
                onChange={setLevel}
                allowSolve={!practiceMode}
              />
            )}
            <ContentBlocks blocks={activePart.content} />
            {isRead && step.montage && step.montage.length > 0 && (
              <PowerRuleAnimation
                mode="montage"
                manual
                terms={step.montage}
                coefficient={step.montage[0].coefficient}
                exponent={step.montage[0].exponent}
                replayKey={step.id}
                showCaption
              />
            )}
            {solveReveal && solveCaption && (
              <div
                className="secant-reveal rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-900"
                role="status"
                aria-live="polite"
              >
                {isManualSolve && walkthroughBeats > 1 && (
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    <span>Walkthrough</span>
                    {isWalkingThrough && (
                      <span>
                        {Math.min(solvePhaseIdx + 1, walkthroughBeats)} /{" "}
                        {walkthroughBeats}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-base font-medium">
                  <RichText text={solveCaption} />
                </div>
              </div>
            )}
            {narratedTerm && (
              <PowerRuleAnimation
                coefficient={narratedTerm.coefficient}
                exponent={narratedTerm.exponent}
                replayKey={`${activeStep.id}-narrated`}
                compact
              />
            )}
            {activeGraph && graphSection}
            {contentSection}
          </div>
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
          {solveActive ? (
            !solveRevealed ? (
              <button
                type="button"
                onClick={startSolveReveal}
                className="flex-1 min-h-[48px] rounded-xl font-semibold text-base text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition"
              >
                Work through it
              </button>
            ) : isWalkingThrough ? (
              <button
                type="button"
                onClick={advanceWalkthrough}
                disabled={beatLocked}
                className="flex-1 min-h-[48px] rounded-xl font-semibold text-base text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(isLastBeat ? "Show the answer" : "Next") +
                  (beatLocked ? ` (${beatSecondsLeft})` : "")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSolveContinue}
                className="flex-1 min-h-[48px] rounded-xl font-semibold text-base text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition"
              >
                {stepIndex >= total - 1 ? "Finish" : "Continue"}
              </button>
            )
          ) : isInstruction || isCorrectAnswered ? (
            <button
              type="button"
              onClick={
                isInstruction
                  ? handleContinueRead
                  : isFinalPart
                    ? goToNextStep
                    : goToNextPart
              }
              disabled={readLocked}
              className={`flex-1 min-h-[48px] rounded-xl font-semibold text-base text-white active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed ${
                isCorrectAnswered
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {readLocked ? `${primaryLabel} (${readSecondsLeft})` : primaryLabel}
            </button>
          ) : liveEnabled ? (
            <div className="flex-1 min-h-[48px] rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 flex items-center justify-center text-center text-base font-medium text-slate-500">
              {activeStep.interaction?.goalLabel ?? "Adjust until it locks in"}
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
