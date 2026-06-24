import { Link } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { useAuth } from "../contexts/AuthContext";
import { useProgress, isLessonDone } from "../contexts/ProgressContext";
import {
  course,
  getLevels,
  getContinueLessonId,
  getCompletionPercent,
  isLessonUnlocked,
} from "../lib/contentLoader";
import type { ResolvedLevel } from "../lib/contentLoader";

/**
 * Decorative, on-brand hero showing the two pillars of calculus on one graph:
 * the shaded area under the curve (an integral) and the tangent line with its
 * slope (a derivative), with a pulsing point of tangency.
 */
function HeroGraph() {
  return (
    <svg
      viewBox="0 0 380 290"
      role="img"
      aria-label="A curve with the area beneath it shaded and a tangent line touching it at a point"
      className="w-full h-auto"
    >
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2ff" />
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* card background */}
      <rect
        x="0.5"
        y="0.5"
        width="379"
        height="289"
        rx="24"
        fill="url(#cardGrad)"
        stroke="#e2e8f0"
      />

      {/* gridlines */}
      <g stroke="#e7eaf3" strokeWidth="1">
        <line x1="143" y1="40" x2="143" y2="250" />
        <line x1="247" y1="40" x2="247" y2="250" />
        <line x1="40" y1="216" x2="350" y2="216" />
        <line x1="40" y1="147" x2="350" y2="147" />
      </g>

      {/* axes */}
      <g stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round">
        <line x1="40" y1="36" x2="40" y2="252" />
        <line x1="34" y1="250" x2="358" y2="250" />
      </g>
      <g fill="#cbd5e1">
        <path d="M40 30 l5 9 l-10 0 Z" />
        <path d="M364 250 l-9 5 l0 -10 Z" />
      </g>

      {/* shaded area under the curve (an integral) */}
      <path
        className="hero-area"
        d="M 40 248 C 120 238, 190 200, 247 147 C 290 110, 325 75, 350 40 L 350 250 L 40 250 Z"
        fill="url(#areaGrad)"
      />

      {/* the curve f(x) */}
      <path
        className="hero-curve"
        d="M 40 248 C 120 238, 190 200, 247 147 C 290 110, 325 75, 350 40"
        fill="none"
        stroke="url(#curveGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* tangent line at the point */}
      <line
        className="hero-tangent"
        x1="170"
        y1="213"
        x2="330"
        y2="76"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* pulsing point of tangency */}
      <circle className="hero-ping" cx="247" cy="147" r="5" fill="#f59e0b" />
      <circle cx="247" cy="147" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2.5" />

      {/* labels */}
      <text x="300" y="58" fill="#6d28d9" fontSize="17" fontWeight="700" fontStyle="italic">
        f(x)
      </text>
      <text x="120" y="96" fill="#b45309" fontSize="14" fontWeight="600">
        slope = f′(x)
      </text>
      <text x="150" y="240" fill="#4338ca" fontSize="13" fontWeight="700" textAnchor="middle">
        area = ∫ f(x) dx
      </text>

      {/* d/dx badge */}
      <g>
        <rect x="52" y="50" width="58" height="26" rx="13" fill="#4f46e5" />
        <text
          x="81"
          y="68"
          fill="#ffffff"
          fontSize="14"
          fontWeight="700"
          textAnchor="middle"
        >
          d/dx
        </text>
      </g>
    </svg>
  );
}

type ProgressMap = ReturnType<typeof useProgress>["progress"];
type LessonState = "done" | "in_progress" | "locked" | "todo";

function StatusIcon({ state }: { state: LessonState }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "in_progress") {
    return (
      <span
        className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-indigo-500 bg-indigo-100"
        aria-hidden
      />
    );
  }
  if (state === "locked") {
    return (
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-slate-300"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-slate-200" aria-hidden />
  );
}

function LevelCard({
  level,
  signedIn,
  progress,
}: {
  level: ResolvedLevel;
  signedIn: boolean;
  progress: ProgressMap;
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700">
          {level.order}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight text-slate-900">{level.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{level.description}</p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-slate-100 sm:pl-11">
        {level.lessons.map((lesson) => {
          const status = progress[lesson.id]?.status;
          const unlocked = !signedIn || isLessonUnlocked(lesson.id, progress);
          const state: LessonState = !signedIn
            ? "todo"
            : isLessonDone(status)
              ? "done"
              : status === "in_progress"
                ? "in_progress"
                : unlocked
                  ? "todo"
                  : "locked";
          const clickable = signedIn && unlocked;

          const textColor =
            state === "locked"
              ? "text-slate-400"
              : state === "done"
                ? "text-slate-500"
                : "text-slate-700";

          const row = (
            <span className="flex items-center gap-3 py-2.5">
              <StatusIcon state={state} />
              <span className={`text-sm ${textColor}`}>{lesson.title}</span>
              {clickable && (
                <span
                  className="ml-auto text-slate-300 group-hover:text-indigo-500"
                  aria-hidden
                >
                  →
                </span>
              )}
            </span>
          );

          return (
            <li key={lesson.id}>
              {clickable ? (
                <Link
                  to={`/lesson/${lesson.id}`}
                  className="group -mx-2 block rounded-lg px-2 hover:bg-slate-50"
                >
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const { progress } = useProgress();

  const levels = getLevels();
  const completion = getCompletionPercent(progress);
  const continueId = getContinueLessonId(progress);
  const hasStarted = Object.values(progress).some(
    (p) => p.status === "in_progress" || isLessonDone(p.status),
  );

  const primaryTo = user
    ? continueId
      ? `/lesson/${continueId}`
      : "/lessons"
    : "/signup";
  const primaryLabel = user
    ? hasStarted
      ? "Continue learning"
      : "Start learning"
    : "Get started";
  const secondary = user
    ? { to: "/lessons", label: "Course roadmap" }
    : { to: "/login", label: "Log in" };

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 w-full">
        {/* Intro */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
            <div className="absolute -top-10 right-0 h-72 w-72 rounded-full bg-violet-200/25 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-10 pb-10 sm:pt-14 sm:pb-12 lg:grid-cols-2 lg:gap-12">
            <div className="hero-rise">
              <p className="text-sm font-semibold text-indigo-600">{course.subject}</p>

              <h1 className="mt-2 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
                {course.title}
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {course.description}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to={primaryTo}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-indigo-600 px-6 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  {primaryLabel}
                </Link>
                <Link
                  to={secondary.to}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {secondary.label}
                </Link>
              </div>

              {user && hasStarted && (
                <div className="mt-6 max-w-sm">
                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Your progress</span>
                    <span>{completion}% complete</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.max(completion, 4)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="hero-float order-first mx-auto w-full max-w-md lg:order-last lg:max-w-none">
              <HeroGraph />
            </div>
          </div>
        </section>

        {/* Course outline */}
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Course outline</h2>
          <p className="mt-1 text-sm text-slate-500">
            {user
              ? "Lessons unlock in order as you work through the course."
              : "A guided path from rates of change to the area under a curve — and the idea that ties them together."}
          </p>

          <ol className="mt-6 space-y-4">
            {levels.map((level) => (
              <LevelCard
                key={level.id}
                level={level}
                signedIn={Boolean(user)}
                progress={progress}
              />
            ))}
          </ol>
        </section>
      </main>
    </SafeArea>
  );
}
