import { auth } from "./firebase";
import type {
  AnswerSpec,
  ConceptMasteryTier,
  ContentBlock,
  Step,
} from "../types/content";

/**
 * The grounded AI "concept tutor". It runs *after* the deterministic grader in
 * {@link checkAnswer} has already decided correctness, so the model never
 * judges — it only explains. Every model call is fed the engine's verdict and
 * the correct answer as ground truth, which is what keeps explanations honest.
 *
 * Everything above {@link buildStepContext} is pure and unit-tested; the model
 * wiring below POSTs the grounded context to a Cloudflare Worker proxy
 * (`VITE_TUTOR_PROXY_URL`) that holds the OpenAI key server-side, verifies the
 * caller's Firebase ID token, and streams OpenAI's reply back as plain text.
 * Keeping the key off-device this way lets the app deploy publicly on Firebase's
 * free Spark plan (no Cloud Functions / Blaze). Calls degrade to a thrown error
 * (handled by the UI) whenever the proxy is unconfigured or unavailable.
 */

// Gemini model id, in one place so it can be swapped trivially. A pinned model
// (rather than the floating `gemini-flash-latest` alias) gives steadier capacity
// and more predictable behavior; swap to `gemini-2.5-flash-lite` for lower
// latency/cost or `gemini-flash-latest` to always track the newest flash.
export const TUTOR_MODEL = "gemini-2.5-flash";

/** Maximum follow-up questions allowed per step, to cap cost and keep focus. */
export const MAX_FOLLOWUPS = 5;

/**
 * Learning-science signals about the learner, layered onto the step context so
 * the tutor can personalize ("you last practiced this two weeks ago…"). Every
 * field is optional and PII-free — the model is told to use it only when it's
 * genuinely relevant to the mistake at hand.
 */
export interface LearnerHistory {
  /** Mastery tier on this step's concept (from first-try accuracy). */
  conceptTier?: ConceptMasteryTier;
  /** 0–100 first-try accuracy on this concept. */
  conceptPercent?: number;
  /** Days since the concept's lessons were last touched; null when never seen. */
  daysSinceConceptSeen?: number | null;
  /** Title of the concept's teaching lesson, for "revisit the X lesson" copy. */
  conceptLessonTitle?: string;
  /** Times this same concept was already missed earlier this session. */
  currentConceptSessionMisses?: number;
  /** Other concepts missed earlier this session, most-missed first. */
  sessionMissedConcepts?: { label: string; count: number }[];
}

/**
 * Compact, PII-free snapshot of a graded step handed to the model. It carries
 * only what's needed to explain the problem: the question, the engine's verdict
 * and correct answer, the learner's literal answer, and the authored feedback.
 */
export interface TutorContext {
  /** Concept slug for the step, e.g. "power_rule" (falls back to "calculus"). */
  conceptTag: string;
  /** Answer-spec discriminant, e.g. "multiple_choice", or "read" when none. */
  answerType: string;
  /** The full question, text and math flattened to a single string. */
  questionText: string;
  /** Human/LaTeX description of the correct answer (from the answer spec). */
  correctAnswer: string;
  /** Human/LaTeX description of what the learner actually submitted. */
  learnerAnswer: string;
  /** Which attempt this was (1-based); used only for tone. */
  attempts: number;
  /** The engine's verdict — the model is told this, never asked to decide it. */
  isCorrect: boolean;
  /**
   * The hand-authored feedback strings for this step. Beyond seeding tone, these
   * are the tutor's canonical, level-appropriate solution: the proxy feeds them
   * to the model as the method to explain with, so the tutor stays within what
   * the student has been taught (e.g. geometric area before the reverse power
   * rule) instead of reaching for more advanced techniques.
   */
  authoredFeedback: { correct: string; incorrect: string; hint: string };
  /** Optional learner-history signals for personalization (see LearnerHistory). */
  history?: LearnerHistory;
}

/**
 * Light, PII-free personalization for the free-form roadmap chat (see {@link
 * createGeneralTutorChat}). Unlike {@link TutorContext} it isn't tied to any
 * graded step — it carries only coarse signals about where the learner is and
 * what they're shakiest on, so the tutor can tailor suggestions. Mirrors the
 * proxy's own `GeneralContext` DTO.
 */
export interface GeneralContext {
  /** Title of the level the learner is currently working through. */
  currentLevelTitle?: string;
  /** A few concepts with the lowest first-try accuracy, most shaky first. */
  weakConcepts?: { label: string; percent: number }[];
  /** Overall course completion, 0–100. */
  completionPercent?: number;
}

/** Flatten content blocks to plain text, wrapping math blocks in inline `$…$`. */
export function contentToText(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => (b.type === "text" ? b.body : `$${b.latex}$`))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse to a finite number, treating null/undefined/""/NaN as "no value". */
function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionAt(options: string[] | undefined, index: unknown): string {
  if (
    typeof index !== "number" ||
    !options ||
    index < 0 ||
    index >= options.length
  ) {
    return "(no selection)";
  }
  return options[index];
}

function formatPowerTerm(
  coefficient: number,
  exponent: number,
  denominator?: number,
): string {
  if (coefficient === 0) return "0";
  // Fraction mode (reverse power rule): write the coefficient as a fraction.
  if (denominator != null && denominator !== 1) {
    const x = exponent === 0 ? "" : exponent === 1 ? "x" : `x^${exponent}`;
    return `(${coefficient}/${denominator})${x}`;
  }
  if (exponent === 0) return `${coefficient}`;
  if (exponent === 1) return `${coefficient}x`;
  return `${coefficient}x^${exponent}`;
}

function formatAssembled(
  prefix: string | undefined,
  parts: { connector?: string; tile: string }[],
): string {
  const body = parts
    .map((p, i) => (i === 0 ? p.tile : `${p.connector ?? "+"} ${p.tile}`))
    .join(" ");
  return prefix ? `${prefix} ${body}`.trim() : body;
}

/**
 * Render an arbitrary submitted value for a given answer spec into a readable
 * string (used for both the learner's answer and, via {@link
 * describeCorrectAnswer}, the correct one).
 */
export function describeAnswer(spec: AnswerSpec, value: unknown): string {
  switch (spec.type) {
    case "multiple_choice":
      return optionAt(spec.options, value);
    case "multi_choice": {
      const picks = Array.isArray(value) ? (value as (number | null)[]) : [];
      return spec.parts
        .map((p, i) => `${p.prompt} → ${optionAt(p.options ?? spec.options, picks[i])}`)
        .join("; ");
    }
    case "numeric":
    case "slider": {
      const n = asFiniteNumber(value);
      return n === null ? "(no answer)" : String(n);
    }
    case "graph_point": {
      const n = asFiniteNumber(value);
      return n === null ? "(no point selected)" : `x = ${n}`;
    }
    case "power_term": {
      const v = (value ?? {}) as {
        coefficient?: number;
        exponent?: number;
        denominator?: number;
      };
      const coef = Number(v.coefficient);
      const exp = Number(v.exponent);
      if (!Number.isFinite(coef) || !Number.isFinite(exp)) {
        return "(incomplete term)";
      }
      const den = spec.denominator != null ? Number(v.denominator) : undefined;
      return formatPowerTerm(coef, exp, den);
    }
    case "drag_drop": {
      const placed = Array.isArray(value) ? (value as (string | null)[]) : [];
      return formatAssembled(
        spec.prefix,
        spec.blanks.map((b, i) => ({
          connector: i === 0 ? undefined : b.connector,
          tile: placed[i] ?? "_",
        })),
      );
    }
    case "match": {
      const picks = Array.isArray(value) ? (value as (string | null)[]) : [];
      return spec.pairs
        .map((p, i) => `${p.prompt} ↔ ${picks[i] ?? "(unmatched)"}`)
        .join("; ");
    }
    case "sign_chart": {
      const picks = Array.isArray(value) ? (value as (number | null)[]) : [];
      return spec.regions
        .map((_, i) => `region ${i + 1}: ${optionAt(spec.options, picks[i])}`)
        .join("; ");
    }
    case "order_list": {
      const order = Array.isArray(value) ? (value as string[]) : [];
      return order.length ? order.join(" → ") : "(empty order)";
    }
    case "riemann": {
      const n = asFiniteNumber(value);
      return n !== null && n > 0 ? `${Math.round(n)} rectangles` : "(no rectangles)";
    }
    case "construct_graph": {
      const ys = Array.isArray(value) ? (value as (number | null)[]) : [];
      return spec.nodes
        .map((node, i) => {
          const y = ys[i];
          return `x=${node.x}: ${typeof y === "number" ? y : "—"}`;
        })
        .join(", ");
    }
    case "paint_intervals": {
      const picks = Array.isArray(value) ? (value as boolean[]) : [];
      const shaded = picks
        .map((v, i) => (v ? i + 1 : null))
        .filter((v): v is number => v !== null);
      return shaded.length ? `shaded segments ${shaded.join(", ")}` : "(nothing shaded)";
    }
    case "tangent_line": {
      const n = asFiniteNumber(value);
      return n === null ? "(no line set)" : `slope = ${n}`;
    }
    case "integral_bounds": {
      const v = (value ?? {}) as { a?: number; b?: number };
      const a = asFiniteNumber(v.a);
      const b = asFiniteNumber(v.b);
      if (a === null || b === null) return "(bounds not set)";
      return `a = ${Math.min(a, b)}, b = ${Math.max(a, b)}`;
    }
    case "simulate":
      return Array.isArray(value) && value.length > 1
        ? "a real-time traced curve"
        : "(no run yet)";
    case "select_region": {
      if (spec.multi) {
        const picks = Array.isArray(value) ? (value as boolean[]) : [];
        const chosen = picks
          .map((v, i) => (v ? i + 1 : null))
          .filter((v): v is number => v !== null);
        return chosen.length ? `regions ${chosen.join(", ")}` : "(no region selected)";
      }
      const idx = typeof value === "number" ? value : -1;
      if (idx < 0 || idx >= spec.bands.length) return "(no region selected)";
      const b = spec.bands[idx];
      return `region ${idx + 1} (x from ${b.from} to ${b.to})`;
    }
    default:
      return "(unknown)";
  }
}

/** Describe the correct answer encoded in an answer spec. */
export function describeCorrectAnswer(spec: AnswerSpec): string {
  switch (spec.type) {
    case "multiple_choice":
      return describeAnswer(spec, spec.correctIndex);
    case "multi_choice":
      return describeAnswer(spec, spec.parts.map((p) => p.correctIndex));
    case "numeric":
    case "slider":
      return String(spec.value);
    case "graph_point":
      return `x = ${spec.x}`;
    case "power_term":
      return formatPowerTerm(spec.coefficient, spec.exponent, spec.denominator);
    case "drag_drop":
      return formatAssembled(
        spec.prefix,
        spec.blanks.map((b, i) => ({
          connector: i === 0 ? undefined : b.connector,
          tile: b.accept,
        })),
      );
    case "match":
      return describeAnswer(spec, spec.pairs.map((p) => p.match));
    case "sign_chart":
      return describeAnswer(spec, spec.regions.map((r) => r.correctIndex));
    case "order_list":
      return spec.items.join(" → ");
    case "riemann":
      return `true area = ${spec.trueArea} (use enough rectangles to land within ${spec.targetWithin})`;
    case "construct_graph":
      return spec.targetFn
        ? `each point on y = ${spec.targetFn}`
        : `y-values ${(spec.targetY ?? []).join(", ")}`;
    case "paint_intervals": {
      const shaded = spec.correct
        .map((v, i) => (v ? i + 1 : null))
        .filter((v): v is number => v !== null);
      return shaded.length ? `shade segments ${shaded.join(", ")}` : "(shade nothing)";
    }
    case "tangent_line":
      return `slope = ${spec.slope}`;
    case "integral_bounds":
      return `a = ${spec.a}, b = ${spec.b}`;
    case "simulate":
      return `trace the target ${spec.target} over [0, ${spec.duration}]`;
    case "select_region": {
      const correct = spec.bands
        .map((b, i) => (b.correct ? i + 1 : null))
        .filter((v): v is number => v !== null);
      if (spec.multi) {
        return correct.length ? `regions ${correct.join(", ")}` : "(none)";
      }
      const idx = correct[0];
      if (idx === undefined) return "(none)";
      const b = spec.bands[idx - 1];
      return `region ${idx} (x from ${b.from} to ${b.to})`;
    }
    default:
      return "(unknown)";
  }
}

/** Assemble the grounded, PII-free context for a single graded step. */
export function buildStepContext(
  step: Step,
  learnerValue: unknown,
  attempts: number,
  isCorrect: boolean,
  history?: LearnerHistory,
): TutorContext {
  const spec = step.interaction?.answer;
  return {
    conceptTag: step.conceptTag ?? "calculus",
    answerType: spec?.type ?? "read",
    questionText: contentToText(step.content),
    correctAnswer: spec ? describeCorrectAnswer(spec) : "(no answer required)",
    learnerAnswer: spec ? describeAnswer(spec, learnerValue) : "(none)",
    attempts: Number.isFinite(attempts) && attempts > 0 ? Math.round(attempts) : 1,
    isCorrect,
    authoredFeedback: {
      correct: step.feedback.correct,
      incorrect: step.feedback.incorrect,
      hint: step.feedback.hint,
    },
    // Only attach history when present so the context stays minimal (and callers
    // without learner signals produce exactly the prior shape).
    ...(history ? { history } : {}),
  };
}

/**
 * Render the learner-history lines for the prompt, emitting only the signals
 * that are actually present (and phrasing recency in plain words). Returns an
 * empty string when there's nothing worth telling the model. Kept here as a
 * pure, unit-tested helper; the proxy has its own copy for prompt building.
 */
export function buildHistorySummary(history: LearnerHistory): string {
  const lines: string[] = [];

  if (history.conceptTier) {
    const pct =
      typeof history.conceptPercent === "number"
        ? ` (${history.conceptPercent}% first-try accuracy)`
        : "";
    lines.push(`Mastery of this concept: ${history.conceptTier}${pct}`);
  }

  if (history.daysSinceConceptSeen != null) {
    const days = Math.round(history.daysSinceConceptSeen);
    const when =
      days <= 0
        ? "earlier today"
        : days === 1
          ? "about 1 day ago"
          : `about ${days} days ago`;
    const where = history.conceptLessonTitle
      ? ` (${history.conceptLessonTitle} lesson)`
      : "";
    lines.push(`Last practiced this concept: ${when}${where}`);
  }

  if (
    history.currentConceptSessionMisses &&
    history.currentConceptSessionMisses > 0
  ) {
    const n = history.currentConceptSessionMisses;
    lines.push(
      `Also missed this concept earlier this session: ${n} ${n === 1 ? "time" : "times"}`,
    );
  }

  if (history.sessionMissedConcepts && history.sessionMissedConcepts.length > 0) {
    const list = history.sessionMissedConcepts
      .map((c) => `${c.label}${c.count > 1 ? ` (x${c.count})` : ""}`)
      .join(", ");
    lines.push(`Other concepts missed this session: ${list}`);
  }

  return lines.join("\n");
}

/**
 * Whether an error means the caller is out of tutor responses. The server-side
 * per-user rate limit surfaces as a callable `resource-exhausted` error, and an
 * upstream provider limit surfaces as a 429 / quota message. Exported so the UI
 * can show a tailored "you're out of responses" message instead of a generic
 * error.
 */
export function isQuotaError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /resource[-_]exhausted/i.test(code)) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b429\b/.test(msg) ||
    /quota|exceeded your current quota|billing details|resource[-_]exhausted|tutor limit|too quickly/i.test(
      msg,
    )
  );
}

/** The request payload POSTed to the tutor proxy. */
type TutorPayload =
  | { mode: "explain"; ctx: TutorContext }
  | {
      mode: "chat";
      ctx: TutorContext;
      seedExplanation?: string;
      history?: { role: "user" | "tutor"; text: string }[];
      message?: string;
    }
  | {
      mode: "general";
      general?: GeneralContext;
      history?: { role: "user" | "tutor"; text: string }[];
      message: string;
    };

/** The deployed Cloudflare Worker proxy URL (see `tutor-proxy/`). */
const TUTOR_PROXY_URL = import.meta.env.VITE_TUTOR_PROXY_URL;

/**
 * True when the tutor proxy URL is configured, so the tutor UI can reveal
 * itself. When unset (e.g. the zero-config demo), the tutor stays hidden and
 * the rest of the app is unaffected.
 */
export const isAiAvailable = Boolean(TUTOR_PROXY_URL);

/**
 * POST the grounded payload to the Cloudflare Worker proxy and stream the reply
 * back as plain text. The signed-in user's Firebase ID token is attached so the
 * proxy can verify the caller; the proxy holds the OpenAI key and never exposes
 * it to the browser. Thrown errors carry the HTTP status so {@link isQuotaError}
 * can recognize a rate-limit (429) reply.
 */
async function* callTutor(payload: TutorPayload): AsyncGenerator<string> {
  if (!TUTOR_PROXY_URL) {
    throw new Error(
      "AI tutor is unavailable: VITE_TUTOR_PROXY_URL is not configured.",
    );
  }

  let token: string | undefined;
  try {
    token = await auth?.currentUser?.getIdToken();
  } catch {
    token = undefined;
  }

  const res = await fetch(TUTOR_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    let message = `Tutor request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    // Prefix the status so isQuotaError can spot a 429 rate-limit reply.
    throw new Error(`[${res.status}] ${message}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const piece = decoder.decode(value, { stream: true });
      if (piece) yield piece;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream the initial grounded walkthrough for a graded step. Throws if the AI
 * backend is unavailable (callers should guard with {@link isAiAvailable}).
 */
export async function* explainStep(ctx: TutorContext): AsyncGenerator<string> {
  yield* callTutor({ mode: "explain", ctx });
}

/** A short, calculus-scoped follow-up conversation about one graded step. */
export interface TutorChat {
  send(message: string): AsyncGenerator<string>;
}

/**
 * Create a follow-up chat seeded with the step context (and the walkthrough
 * already shown, if any). The transcript is kept here and replayed to the
 * stateless proxy on each turn so the conversation stays coherent and on-topic.
 */
export function createTutorChat(
  ctx: TutorContext,
  seedExplanation?: string,
): TutorChat {
  const transcript: { role: "user" | "tutor"; text: string }[] = [];
  return {
    async *send(message: string): AsyncGenerator<string> {
      let acc = "";
      for await (const piece of callTutor({
        mode: "chat",
        ctx,
        seedExplanation,
        history: [...transcript],
        message,
      })) {
        acc += piece;
        yield piece;
      }
      transcript.push({ role: "user", text: message });
      transcript.push({ role: "tutor", text: acc });
    },
  };
}

/**
 * How many prior turns the client replays on each general-chat send. Bounds the
 * prompt size (and cost) of a long conversation; the proxy clamps this too.
 */
const GENERAL_REPLAY_TURNS = 16;

/**
 * Create a free-form ("general") roadmap chat. Unlike {@link createTutorChat}
 * it isn't tied to a graded step — it carries only the optional light learner
 * context, and the tutor may teach and work examples freely within the course's
 * scope. The transcript is kept here and the most recent turns are replayed to
 * the stateless proxy on each send so the conversation stays coherent.
 */
export function createGeneralTutorChat(general?: GeneralContext): TutorChat {
  const transcript: { role: "user" | "tutor"; text: string }[] = [];
  return {
    async *send(message: string): AsyncGenerator<string> {
      let acc = "";
      for await (const piece of callTutor({
        mode: "general",
        history: transcript.slice(-GENERAL_REPLAY_TURNS),
        message,
        ...(general ? { general } : {}),
      })) {
        acc += piece;
        yield piece;
      }
      transcript.push({ role: "user", text: message });
      transcript.push({ role: "tutor", text: acc });
    },
  };
}
