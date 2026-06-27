import { HttpError } from "./errors";
import { verifyFirebaseToken } from "./auth";
import { enforceRateLimit } from "./rateLimit";
import { buildMessages, validateRequest } from "./prompt";

/**
 * Cloudflare Worker proxy for the Calculus Lab AI concept tutor.
 *
 * Browser (Firebase Hosting) --POST + Firebase ID token--> this Worker --> OpenAI.
 * The OpenAI key never leaves the Worker, so the app can deploy publicly while
 * staying on Firebase's free Spark plan. Defense in depth: CORS locked to the
 * app's origins, a verified Firebase ID token (only your signed-in users),
 * optional per-user KV rate limiting, and a spend cap set on the OpenAI key.
 */

interface Env {
  /** OpenAI API key — set via `wrangler secret put OPENAI_API_KEY`. */
  OPENAI_API_KEY: string;
  FIREBASE_PROJECT_ID?: string;
  ALLOWED_ORIGINS?: string;
  TUTOR_DAILY_LIMIT?: string;
  TUTOR_BURST_LIMIT?: string;
  ALLOW_UNAUTHENTICATED?: string;
  TUTOR_MODEL?: string;
  /** Optional KV namespace for per-user rate limiting (see wrangler.toml). */
  RATE_LIMIT?: KVNamespace;
}

const DEFAULT_MODEL = "gpt-4o-mini";

function parseOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null, allowed: string[]): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonError(status: number, message: string, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

async function handleTutor(
  request: Request,
  env: Env,
  cors: Headers,
): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(500, "The AI tutor is misconfigured (no OpenAI key).");
  }

  // Auth: only ID tokens minted for this Firebase project are accepted, so the
  // public endpoint can't be used by anyone who isn't a signed-in app user.
  let uid = "anonymous";
  if (env.ALLOW_UNAUTHENTICATED !== "true") {
    const match = /^Bearer\s+(.+)$/i.exec(
      request.headers.get("Authorization") ?? "",
    );
    if (!match) throw new HttpError(401, "Sign in to use the AI tutor.");
    uid = await verifyFirebaseToken(match[1], env.FIREBASE_PROJECT_ID ?? "");
  }

  if (env.RATE_LIMIT) {
    const daily = Number(env.TUTOR_DAILY_LIMIT) || 500;
    const burst = Number(env.TUTOR_BURST_LIMIT) || 15;
    await enforceRateLimit(env.RATE_LIMIT, uid, daily, burst);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
  const messages = buildMessages(validateRequest(body));

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.TUTOR_MODEL || DEFAULT_MODEL,
      temperature: 0.4,
      top_p: 0.95,
      max_tokens: 768,
      messages,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    // Surface the real OpenAI error in `wrangler tail` (safe: no key, just the
    // provider's error body, e.g. insufficient_quota vs rate_limit_exceeded).
    console.error("OpenAI error", upstream.status, detail.slice(0, 500));
    if (upstream.status === 429 || /quota|insufficient_quota/i.test(detail)) {
      throw new HttpError(
        429,
        "The AI tutor is temporarily over its usage limit. Please try again later.",
      );
    }
    if (upstream.status === 401 || upstream.status === 403) {
      throw new HttpError(500, "The AI tutor is misconfigured.");
    }
    throw new HttpError(502, "The AI tutor couldn't respond right now.");
  }

  // Non-streaming: read the whole completion, then return it as one plain-text
  // body. Relaying OpenAI's token-by-token SSE stream through the Worker is what
  // hung the request — Cloudflare cancels a Worker whose streamed response never
  // flushes/closes. gpt-4o-mini answers in ~1-4s (well under the client wait),
  // and the browser renders a single body exactly as it did the stream.
  const data = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    console.error("OpenAI empty completion", JSON.stringify(data).slice(0, 500));
    throw new HttpError(502, "The AI tutor couldn't respond right now.");
  }

  const headers = new Headers(cors);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(text, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowed = parseOrigins(env);
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return jsonError(405, "Method not allowed.", cors);
    }
    // Reject cross-origin browser callers that aren't on the allow-list. (A
    // request with no Origin header isn't a browser page; auth still gates it.)
    if (origin && !allowed.includes(origin)) {
      return jsonError(403, "Origin not allowed.", cors);
    }

    try {
      return await handleTutor(request, env, cors);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(err.status, err.message, cors);
      }
      console.error("Tutor proxy error:", err);
      return jsonError(500, "Unexpected error.", cors);
    }
  },
};
