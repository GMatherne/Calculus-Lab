import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { defineInt } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

/**
 * Per-user rate limiting for the AI tutor proxy. Counters live in a server-only
 * `aiUsage/{uid}` document that clients can neither read nor write (enforced in
 * firestore.rules), so a learner cannot reset their own quota to dodge the cap.
 * The Admin SDK used here bypasses security rules.
 */

/** Max tutor calls per user per UTC day. Tunable via env without code changes. */
const DAILY_LIMIT = defineInt("TUTOR_DAILY_LIMIT", { default: 50 });

/** Max tutor calls per user inside a short rolling window (anti-burst guard). */
const BURST_LIMIT = defineInt("TUTOR_BURST_LIMIT", { default: 8 });

/** Length of the burst window in milliseconds. */
const BURST_WINDOW_MS = 60_000;

interface UsageDoc {
  day?: string;
  dayCount?: number;
  windowStart?: number;
  windowCount?: number;
}

/** UTC calendar day (YYYY-MM-DD) used as the daily-counter bucket key. */
function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Atomically enforce per-user limits and record the call. Throws
 * `HttpsError("resource-exhausted")` when the caller is over the daily cap or is
 * bursting too fast; the client maps that to its "out of responses" message.
 */
export async function enforceRateLimit(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("aiUsage").doc(uid);
  const now = Date.now();
  const today = utcDay(now);
  const dailyLimit = DAILY_LIMIT.value();
  const burstLimit = BURST_LIMIT.value();

  await db.runTransaction(async (tx) => {
    const data = ((await tx.get(ref)).data() as UsageDoc | undefined) ?? {};

    const dayCount = data.day === today ? data.dayCount ?? 0 : 0;
    if (dayCount >= dailyLimit) {
      throw new HttpsError(
        "resource-exhausted",
        "You've reached today's AI tutor limit. It resets tomorrow.",
      );
    }

    const windowActive =
      typeof data.windowStart === "number" &&
      now - data.windowStart < BURST_WINDOW_MS;
    const windowCount = windowActive ? data.windowCount ?? 0 : 0;
    if (windowCount >= burstLimit) {
      throw new HttpsError(
        "resource-exhausted",
        "You're asking the tutor very quickly. Please wait a moment and try again.",
      );
    }

    tx.set(
      ref,
      {
        day: today,
        dayCount: dayCount + 1,
        windowStart: windowActive ? data.windowStart : now,
        windowCount: windowCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/**
 * Optional global kill switch. When `config/ai.enabled` is explicitly `false`,
 * reject every tutor call so the feature can be cut instantly (e.g. on a cost
 * spike) with no redeploy. A missing doc means enabled. A read failure must not
 * take the tutor down, so it is logged and treated as enabled.
 */
export async function assertTutorEnabled(): Promise<void> {
  const db = getFirestore();
  try {
    const snap = await db.collection("config").doc("ai").get();
    if (snap.exists && snap.get("enabled") === false) {
      throw new HttpsError(
        "unavailable",
        "The AI tutor is temporarily disabled.",
      );
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.warn("Could not read tutor kill switch; allowing request.", err);
  }
}
