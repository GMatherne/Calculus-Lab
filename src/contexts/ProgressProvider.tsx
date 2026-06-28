import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  ConceptSessionResult,
  LessonProgress,
  UserProfile,
} from "../types/content";
import { useAuth } from "./AuthContext";
import {
  getAllLessonProgress,
  getUserProfile,
  saveLessonProgress,
  saveUserProfile,
  recordActivity,
  checkMilestones,
  buildMilestoneStats,
  clearAllProgress,
  mergeConceptStats,
  nextStepProgress,
  testedOutLessonProgress,
} from "../lib/progressService";
import { getLesson, getPublishedLessons } from "../lib/contentLoader";
import {
  XP_PER_LESSON,
  XP_PER_MULTIPART_BONUS,
  isInstructionStep,
  isMultiPart,
} from "../types/content";
import { ProgressContext, isLessonDone } from "./ProgressContext";

function defaultProgress(): LessonProgress {
  return {
    status: "not_started",
    currentStepIndex: 0,
    stepAttempts: {},
    stepAnswers: {},
    solvedSteps: [],
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProgress({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [p, prog] = await Promise.all([
      getUserProfile(user.uid),
      getAllLessonProgress(user.uid),
    ]);
    // After a verified email change, the auth record updates before the stored
    // profile does; reconcile so the displayed email stays correct.
    let resolved = p;
    if (p && user.email && p.email !== user.email) {
      resolved = { ...p, email: user.email };
      void saveUserProfile(user.uid, resolved);
    }
    setProfile(resolved);
    setProgress(prog);
    setLoading(false);
  }, [user]);

  // Load profile + progress when the signed-in identity changes. Keyed on the
  // uid (not the whole user object) so in-place profile edits — e.g. renaming or
  // changing email — don't retrigger a reload that would clobber the optimistic
  // update made by updateProfileInfo.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const updateStepProgress = async (
    lessonId: string,
    stepIndex: number,
    stepId: string,
    answer: unknown,
    isCorrect: boolean,
    attemptsOverride?: number,
  ) => {
    if (!user) return;
    const current = progress[lessonId] ?? defaultProgress();
    // Multi-part questions persist once and pass the whole-question try count;
    // everything else increments per submission as before.
    const attempts =
      attemptsOverride ?? (current.stepAttempts[stepId] ?? 0) + 1;

    // Preserve completion when reviewing a finished lesson; otherwise advance.
    const { status, currentStepIndex } = nextStepProgress(
      current,
      stepIndex,
      isCorrect,
    );

    const updated: LessonProgress = {
      ...current,
      status,
      currentStepIndex,
      stepAttempts: { ...current.stepAttempts, [stepId]: attempts },
      stepAnswers: { ...current.stepAnswers, [stepId]: answer },
      updatedAt: new Date().toISOString(),
    };
    // Answering a step for real clears any prior "solved" flag, so a step the
    // learner later does unaided rejoins the graded mastery pool.
    if (current.solvedSteps?.includes(stepId)) {
      updated.solvedSteps = current.solvedSteps.filter((id) => id !== stepId);
    }

    setProgress((prev) => ({ ...prev, [lessonId]: updated }));
    void saveLessonProgress(user.uid, lessonId, updated);

    // Each answered question counts as a day's activity, advancing the streak
    // and feeding the profile heatmap. Re-check milestones here too so
    // question- and concept-based achievements unlock the moment the stat is
    // reached, not only when a lesson is finished.
    if (profile) {
      const active = recordActivity(profile);
      const mergedProgress = { ...progress, [lessonId]: updated };
      const milestones = checkMilestones(
        active.milestones,
        buildMilestoneStats(active, mergedProgress),
      );
      const newProfile = { ...active, milestones };
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  // Clear a step via the "solve" assistance level: advance past it like a
  // correct answer and record the shown answer, but flag it in `solvedSteps` so
  // mastery excludes it. No attempt is recorded, so seeing the worked solution
  // never counts as a first-try clear. Activity still registers (it's engagement).
  const markStepSolved = async (
    lessonId: string,
    stepIndex: number,
    stepId: string,
    answer: unknown,
  ) => {
    if (!user) return;
    const current = progress[lessonId] ?? defaultProgress();
    const { status, currentStepIndex } = nextStepProgress(current, stepIndex, true);
    const solvedSteps = current.solvedSteps?.includes(stepId)
      ? current.solvedSteps
      : [...(current.solvedSteps ?? []), stepId];

    const updated: LessonProgress = {
      ...current,
      status,
      currentStepIndex,
      solvedSteps,
      stepAnswers: { ...current.stepAnswers, [stepId]: answer },
      updatedAt: new Date().toISOString(),
    };

    setProgress((prev) => ({ ...prev, [lessonId]: updated }));
    void saveLessonProgress(user.uid, lessonId, updated);

    if (profile) {
      const active = recordActivity(profile);
      const mergedProgress = { ...progress, [lessonId]: updated };
      const milestones = checkMilestones(
        active.milestones,
        buildMilestoneStats(active, mergedProgress),
      );
      const newProfile = { ...active, milestones };
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  const completeLesson = async (lessonId: string): Promise<number> => {
    if (!user || !profile) return 0;
    const current = progress[lessonId] ?? defaultProgress();
    const updated: LessonProgress = {
      ...current,
      status: "complete",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProgress((prev) => ({ ...prev, [lessonId]: updated }));
    await saveLessonProgress(user.uid, lessonId, updated);

    const active = recordActivity(profile);
    // Award XP only the first time a lesson is finished, so replaying or
    // reviewing an already-completed lesson can't farm points. Multi-part
    // questions add a flat bonus each, matching the "lessons reward completion"
    // rule (so the bonus is non-farmable too).
    const lessonDef = getLesson(lessonId);
    const multiPartCount = lessonDef
      ? lessonDef.steps.filter(isMultiPart).length
      : 0;
    const xpGain = isLessonDone(current.status)
      ? 0
      : XP_PER_LESSON + multiPartCount * XP_PER_MULTIPART_BONUS;
    // Apply this completion and the freshly-earned XP before evaluating
    // milestones so lesson-, XP-, and concept-based achievements all reflect
    // the just-finished lesson.
    const withXp = { ...active, xp: (profile.xp ?? 0) + xpGain };
    const mergedProgress = { ...progress, [lessonId]: updated };
    const milestones = checkMilestones(
      withXp.milestones,
      buildMilestoneStats(withXp, mergedProgress),
    );
    const newProfile = { ...withXp, milestones };
    await saveUserProfile(user.uid, newProfile);
    setProfile(newProfile);
    return xpGain;
  };

  // Mark one or more lessons complete because the learner tested out of them.
  // Each lesson is patched to a mastered-looking complete state (so it doesn't
  // read 0% mastery), the test's per-concept results fold into conceptStats, and
  // only lessons not already finished earn first-time XP — so re-testing a done
  // lesson (or a level whose lessons are partly done) can't farm points. Used
  // for both single-lesson and whole-level skips. Returns the XP gained.
  const completeLessonsTestedOut = async (
    lessonIds: string[],
    conceptResults?: Record<string, ConceptSessionResult>,
  ): Promise<number> => {
    if (!user || !profile || lessonIds.length === 0) return 0;
    const now = new Date().toISOString();

    const next: Record<string, LessonProgress> = { ...progress };
    const newlyCompleted: string[] = [];
    for (const lessonId of lessonIds) {
      const current = next[lessonId] ?? defaultProgress();
      if (!isLessonDone(current.status)) newlyCompleted.push(lessonId);
      next[lessonId] = testedOutLessonProgress(current, getLesson(lessonId), now);
    }

    setProgress(next);
    await Promise.all(
      lessonIds.map((id) => saveLessonProgress(user.uid, id, { ...next[id] })),
    );

    // First-time lesson XP plus the flat multi-part bonus per multi-part
    // question, matching completeLesson so a skip is rewarded like finishing.
    const xpGain = newlyCompleted.reduce((sum, id) => {
      const lesson = getLesson(id);
      const multiPartCount = lesson
        ? lesson.steps.filter(isMultiPart).length
        : 0;
      return sum + XP_PER_LESSON + multiPartCount * XP_PER_MULTIPART_BONUS;
    }, 0);

    // Fold the test's first-try results into lifetime conceptStats so mastery
    // reflects how the test-out actually went and the recency clock refreshes,
    // exactly like a practice/review session.
    const nextConceptStats =
      conceptResults && Object.keys(conceptResults).length > 0
        ? mergeConceptStats(profile.conceptStats, conceptResults)
        : profile.conceptStats;

    const withXp = {
      ...recordActivity(profile),
      xp: (profile.xp ?? 0) + xpGain,
      ...(nextConceptStats ? { conceptStats: nextConceptStats } : {}),
    };
    const milestones = checkMilestones(
      withXp.milestones,
      buildMilestoneStats(withXp, next),
    );
    const newProfile = { ...withXp, milestones };
    await saveUserProfile(user.uid, newProfile);
    setProfile(newProfile);
    return xpGain;
  };

  // Record a finished practice/review session: bank XP, tally the practice
  // questions answered (lesson questions are counted elsewhere and excluded
  // from this metric), and keep the streak/heatmap in sync. Persisted
  // immediately so the header badge stays current.
  const addXp = async (
    amount: number,
    practiceQuestions = 0,
    conceptResults?: Record<string, ConceptSessionResult>,
  ) => {
    if (!user || !profile) return;
    // A finished practice/review session always registers as activity (streak +
    // heatmap). XP and the practice-question achievements only move for
    // questions cleared on the first try, so a zero-first-try round records the
    // session without adding either. The per-concept results fold into
    // `conceptStats` so the session actually moves mastery (and, in turn, the
    // review recommendations that read it).
    const nextConceptStats =
      conceptResults && Object.keys(conceptResults).length > 0
        ? mergeConceptStats(profile.conceptStats, conceptResults)
        : profile.conceptStats;
    const withXp = {
      ...recordActivity(profile),
      xp: (profile.xp ?? 0) + Math.max(0, amount),
      practiceQuestionsAnswered:
        (profile.practiceQuestionsAnswered ?? 0) + Math.max(0, practiceQuestions),
      // Only attach when we actually have stats, so we never write an
      // `undefined` field (which Firestore rejects).
      ...(nextConceptStats ? { conceptStats: nextConceptStats } : {}),
    };
    // Practice can push XP or first-try counts past a threshold, so re-check
    // milestones even though no lesson was completed.
    const milestones = checkMilestones(
      withXp.milestones,
      buildMilestoneStats(withXp, progress),
    );
    const newProfile = { ...withXp, milestones };
    setProfile(newProfile);
    await saveUserProfile(user.uid, newProfile);
  };

  const updateProfileInfo = async (
    fields: Partial<Pick<UserProfile, "displayName" | "email">>,
  ) => {
    if (!user || !profile) return;
    const newProfile = { ...profile, ...fields };
    setProfile(newProfile);
    await saveUserProfile(user.uid, newProfile);
  };

  // Dev/testing helpers, surfaced through DevTools, for jumping past lesson
  // locks without grinding through every lesson first.
  const completeAllLessons = async () => {
    if (!user) return;
    const published = getPublishedLessons();
    const now = new Date().toISOString();
    const next: Record<string, LessonProgress> = { ...progress };
    for (const meta of published) {
      const current = next[meta.id] ?? defaultProgress();
      const lesson = getLesson(meta.id);
      // Seed a first-try attempt for every gradable step with no recorded
      // attempt yet, and advance the step pointer to the end, so a dev-completed
      // lesson reads as a clean lesson run (~50%) rather than 0% (mastery counts
      // first-try accuracy, and completion alone records none). It stops well
      // short of "mastered" by design — the top half is earned through
      // practice/review. Steps the learner actually attempted keep their real
      // counts.
      const stepAttempts = { ...current.stepAttempts };
      let currentStepIndex = current.currentStepIndex ?? 0;
      if (lesson) {
        for (const s of lesson.steps) {
          if (isInstructionStep(s) || !s.interaction?.answer) continue;
          if ((stepAttempts[s.id] ?? 0) === 0) stepAttempts[s.id] = 1;
        }
        currentStepIndex = lesson.steps.length;
      }
      next[meta.id] = {
        ...current,
        status: "complete",
        currentStepIndex,
        stepAttempts,
        completedAt: current.completedAt ?? now,
        updatedAt: now,
      };
    }
    setProgress(next);
    await Promise.all(
      published.map((meta) =>
        saveLessonProgress(user.uid, meta.id, { ...next[meta.id] }),
      ),
    );
    if (profile) {
      // Only freshly-completed lessons earn XP (those not already done), plus
      // the flat multi-part bonus for each multi-part question they contain.
      const newlyCompleted = published.filter(
        (meta) => !isLessonDone(progress[meta.id]?.status),
      );
      const multiPartBonus = newlyCompleted.reduce((sum, meta) => {
        const l = getLesson(meta.id);
        return (
          sum +
          (l ? l.steps.filter(isMultiPart).length * XP_PER_MULTIPART_BONUS : 0)
        );
      }, 0);
      const withXp = {
        ...profile,
        xp:
          (profile.xp ?? 0) +
          newlyCompleted.length * XP_PER_LESSON +
          multiPartBonus,
      };
      const milestones = checkMilestones(
        withXp.milestones,
        buildMilestoneStats(withXp, next),
      );
      const newProfile = { ...withXp, milestones };
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  const resetProgress = async () => {
    if (!user) return;
    setProgress({});
    await clearAllProgress(user.uid);
    if (profile) {
      const newProfile = {
        ...profile,
        streak: { count: 0, lastActiveDate: "" },
        milestones: [],
        xp: 0,
        practiceQuestionsAnswered: 0,
        activityLog: {},
        conceptStats: {},
      };
      await saveUserProfile(user.uid, newProfile);
      setProfile(newProfile);
    }
  };

  return (
    <ProgressContext.Provider
      value={{
        profile,
        progress,
        loading,
        updateStepProgress,
        markStepSolved,
        completeLesson,
        completeLessonsTestedOut,
        addXp,
        updateProfileInfo,
        completeAllLessons,
        resetProgress,
        refresh,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}
