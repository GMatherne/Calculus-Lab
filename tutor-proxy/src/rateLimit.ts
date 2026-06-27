import { HttpError } from "./errors";

/**
 * Soft per-user rate limiting backed by Workers KV. Counters live under a
 * server-only `rl:{uid}` key the browser can't touch. KV's read-modify-write
 * isn't transactional, so under heavy concurrency a user could slip a little
 * past the cap — that's fine for a soft limit whose real backstop is the
 * OpenAI dashboard spend cap. Enforced only when a RATE_LIMIT namespace is
 * bound (see wrangler.toml); otherwise skipped entirely.
 */

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

export async function enforceRateLimit(
  kv: KVNamespace,
  uid: string,
  dailyLimit: number,
  burstLimit: number,
): Promise<void> {
  const now = Date.now();
  const today = utcDay(now);
  const key = `rl:${uid}`;

  const raw = await kv.get(key);
  const data: UsageDoc = raw ? (JSON.parse(raw) as UsageDoc) : {};

  const dayCount = data.day === today ? data.dayCount ?? 0 : 0;
  if (dayCount >= dailyLimit) {
    throw new HttpError(
      429,
      "You've reached today's AI tutor limit. It resets tomorrow.",
    );
  }

  const windowActive =
    typeof data.windowStart === "number" &&
    now - data.windowStart < BURST_WINDOW_MS;
  const windowCount = windowActive ? data.windowCount ?? 0 : 0;
  if (windowCount >= burstLimit) {
    throw new HttpError(
      429,
      "You're asking the tutor too quickly. Please wait a moment and try again.",
    );
  }

  const next: UsageDoc = {
    day: today,
    dayCount: dayCount + 1,
    windowStart: windowActive ? data.windowStart : now,
    windowCount: windowCount + 1,
  };
  // KV's minimum TTL is 60s; two days comfortably covers the daily bucket.
  await kv.put(key, JSON.stringify(next), { expirationTtl: 172_800 });
}
