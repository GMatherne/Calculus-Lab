import type { LessonProgress, StreakData, UserProfile } from "../types/content";
import { useLocalPersistence, db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (useLocalPersistence || !db) {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_KEY}_${uid}`);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  }
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
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

export function checkMilestones(
  milestones: string[],
  completedCount: number,
  streak: number,
  totalLessons: number,
): string[] {
  const next = [...milestones];
  const add = (id: string) => {
    if (!next.includes(id)) next.push(id);
  };
  if (completedCount >= 1) add("first_lesson");
  if (completedCount >= 3) add("three_lessons");
  if (streak >= 5) add("five_day_streak");
  if (completedCount >= totalLessons) add("course_complete");
  return next;
}
