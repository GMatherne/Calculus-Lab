import type {
  LessonProgress,
  MilestoneStats,
  StreakData,
  UserProfile,
} from "../types/content";
import { MILESTONE_DEFS, milestoneProgress } from "../types/content";
import { getConceptMastery } from "./masteryService";
import { getPublishedLessons } from "./contentLoader";
import { useLocalPersistence, db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const LOCAL_PROFILE_KEY = "derivatives_user_profile";
const LOCAL_PROGRESS_KEY = "derivatives_progress";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeStreakUpdate(
  current: StreakData,
  activityDate = todayIso(),
): StreakData {
  if (current.lastActiveDate === activityDate) {
    return current;
  }
  const yesterday = new Date(activityDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);
  const continued = current.lastActiveDate === yesterdayIso;
  return {
    count: continued ? current.count + 1 : 1,
    lastActiveDate: activityDate,
  };
}

/**
 * Returns a copy of the profile with `amount` activity recorded for the day:
 * the day's tally in `activityLog` grows and the streak advances. Pure — the
 * caller persists and applies the returned profile.
 */
export function recordActivity(
  profile: UserProfile,
  amount = 1,
  activityDate = todayIso(),
): UserProfile {
  const activityLog = { ...(profile.activityLog ?? {}) };
  activityLog[activityDate] = (activityLog[activityDate] ?? 0) + amount;
  return {
    ...profile,
    activityLog,
    streak: computeStreakUpdate(profile.streak, activityDate),
  };
}

/** Longest run of consecutive active days recorded in the activity log. */
export function computeLongestStreak(
  activityLog: Record<string, number> | undefined,
): number {
  const days = Object.entries(activityLog ?? {})
    .filter(([, count]) => count > 0)
    .map(([day]) => day)
    .sort();
  if (days.length === 0) return 0;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().slice(0, 10) === days[i]) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }
  return longest;
}

/** Status values that mean a lesson has been finished. */
export function isLessonComplete(status: string | undefined): boolean {
  return status === "complete" || status === "mastered";
}

/**
 * The next persisted status and step pointer after answering a question.
 *
 * Reviewing an already-finished lesson must not downgrade it back to
 * "in_progress" or rewind the saved step pointer — re-answering a question while
 * reviewing should leave a completed lesson completed. For a lesson still in
 * progress, a correct answer advances the pointer past the current step.
 */
export function nextStepProgress(
  current: Pick<LessonProgress, "status" | "currentStepIndex">,
  stepIndex: number,
  isCorrect: boolean,
): { status: LessonProgress["status"]; currentStepIndex: number } {
  if (isLessonComplete(current.status)) {
    return {
      status: current.status,
      currentStepIndex: current.currentStepIndex,
    };
  }
  return {
    status: "in_progress",
    currentStepIndex: isCorrect ? stepIndex + 1 : stepIndex,
  };
}

/** Backfills fields added after a profile was first saved (e.g. xp, activityLog). */
function withProfileDefaults(profile: UserProfile): UserProfile {
  return {
    ...profile,
    xp: profile.xp ?? 0,
    practiceQuestionsAnswered: profile.practiceQuestionsAnswered ?? 0,
    activityLog: profile.activityLog ?? {},
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (useLocalPersistence || !db) {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_KEY}_${uid}`);
    return raw ? withProfileDefaults(JSON.parse(raw) as UserProfile) : null;
  }
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return withProfileDefaults(snap.data() as UserProfile);
}

export async function createUserProfile(
  uid: string,
  displayName: string,
  email: string,
): Promise<UserProfile> {
  const profile: UserProfile = {
    displayName,
    email,
    streak: { count: 0, lastActiveDate: "" },
    milestones: [],
    xp: 0,
    practiceQuestionsAnswered: 0,
    activityLog: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveUserProfile(uid, profile);
  return profile;
}

export async function saveUserProfile(
  uid: string,
  profile: UserProfile,
): Promise<void> {
  profile.updatedAt = new Date().toISOString();
  if (useLocalPersistence || !db) {
    localStorage.setItem(`${LOCAL_PROFILE_KEY}_${uid}`, JSON.stringify(profile));
    return;
  }
  await setDoc(doc(db, "users", uid), {
    ...profile,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllLessonProgress(
  uid: string,
): Promise<Record<string, LessonProgress>> {
  if (useLocalPersistence || !db) {
    const raw = localStorage.getItem(`${LOCAL_PROGRESS_KEY}_${uid}`);
    return raw ? (JSON.parse(raw) as Record<string, LessonProgress>) : {};
  }
  const snap = await getDocs(collection(db, "users", uid, "progress"));
  const result: Record<string, LessonProgress> = {};
  snap.forEach((d) => {
    result[d.id] = d.data() as LessonProgress;
  });
  return result;
}

export async function saveLessonProgress(
  uid: string,
  lessonId: string,
  progress: LessonProgress,
): Promise<void> {
  progress.updatedAt = new Date().toISOString();
  if (useLocalPersistence || !db) {
    const all = await getAllLessonProgress(uid);
    all[lessonId] = progress;
    localStorage.setItem(`${LOCAL_PROGRESS_KEY}_${uid}`, JSON.stringify(all));
    return;
  }
  await setDoc(doc(db, "users", uid, "progress", lessonId), {
    ...progress,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Dev/testing helper: wipe every lesson's progress for a user. Local persistence
 * just drops the stored blob; Firestore deletes each saved progress document.
 */
export async function clearAllProgress(uid: string): Promise<void> {
  if (useLocalPersistence || !db) {
    localStorage.removeItem(`${LOCAL_PROGRESS_KEY}_${uid}`);
    return;
  }
  const snap = await getDocs(collection(db, "users", uid, "progress"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/**
 * Permanently remove a user's stored data: their profile plus every lesson
 * progress document. Local persistence drops the stored blobs; Firestore
 * deletes each progress document and then the profile document.
 *
 * For real accounts this must run while the user is still authenticated, since
 * Firestore security rules only allow a user to delete their own documents.
 */
export async function deleteUserData(uid: string): Promise<void> {
  if (useLocalPersistence || !db) {
    localStorage.removeItem(`${LOCAL_PROGRESS_KEY}_${uid}`);
    localStorage.removeItem(`${LOCAL_PROFILE_KEY}_${uid}`);
    return;
  }
  const snap = await getDocs(collection(db, "users", uid, "progress"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "users", uid));
}

/**
 * Assembles every learner statistic a milestone might track from the live
 * profile and progress. Single source of truth shared by the award logic
 * (ProgressProvider) and the achievements UI so both read identical numbers.
 */
export function buildMilestoneStats(
  profile: UserProfile,
  progress: Record<string, LessonProgress>,
): MilestoneStats {
  const published = getPublishedLessons();
  const mastery = getConceptMastery(progress);
  return {
    lessonsCompleted: published.filter((l) =>
      isLessonComplete(progress[l.id]?.status),
    ).length,
    totalLessons: published.length,
    streak: profile.streak.count,
    xp: profile.xp ?? 0,
    practiceQuestionsAnswered: profile.practiceQuestionsAnswered ?? 0,
    conceptsMastered: mastery.filter((m) => m.tier === "mastered").length,
    totalConcepts: mastery.length,
  };
}

/**
 * Returns the milestone list with any newly-earned ids appended. Idempotent:
 * already-earned milestones are kept once, and a `target > 0` guard prevents a
 * brand-new (empty-course) account from earning "complete everything" badges.
 */
export function checkMilestones(
  milestones: string[],
  stats: MilestoneStats,
): string[] {
  const next = [...milestones];
  for (const [id, def] of Object.entries(MILESTONE_DEFS)) {
    if (next.includes(id)) continue;
    const { current, target } = milestoneProgress(def, stats);
    if (target > 0 && current >= target) next.push(id);
  }
  return next;
}
