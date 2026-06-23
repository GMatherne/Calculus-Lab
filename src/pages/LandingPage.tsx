import { Link } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { useAuth } from "../contexts/AuthContext";
import { useProgress, isLessonDone } from "../contexts/ProgressContext";
import {
  course,
  getLessonStepStats,
  getLevels,
  getCompletionPercent,
} from "../lib/contentLoader";

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

const FEATURES = [
  {
    title: "Interactive graphs",
    body: "Drag sliders and tap curves to watch slopes, tangents, and shaded areas respond in real time.",
    accent: "from-indigo-500 to-violet-500",
    icon: (
      <path
        d="M4 19V5m0 14h16M4 15c4-1 6-9 9-9s4 5 7 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Instant feedback",
    body: "Every answer is checked in under a second, with an optional hint when you get stuck.",
    accent: "from-amber-500 to-orange-500",
    icon: (
      <path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "A path that builds",
    body: "Lessons unlock in order — from rates of change to areas under curves, ending with how the two connect.",
    accent: "from-emerald-500 to-teal-500",
    icon: (
      <path
        d="M5 19h4l10-10-4-4L5 15v4Zm9-13 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function LandingPage() {
  const { user } = useAuth();
  const { progress } = useProgress();

  const { lessonCount, minSteps, maxSteps } = getLessonStepStats();
  const levels = getLevels();
  const completion = getCompletionPercent(progress);
  const hasStarted = Object.values(progress).some(
    (p) => p.status === "in_progress" || isLessonDone(p.status),
  );
  const totalMinutes = course.lessons
    .filter((l) => l.published)
    .reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0);

  const stepValue =
    minSteps === maxSteps ? `${minSteps}` : `${minSteps}–${maxSteps}`;

  const primary = user
    ? { to: "/lessons", label: hasStarted ? "Continue learning" : "Start learning" }
    : { to: "/signup", label: "Create free account" };
  const secondary = user
    ? { to: "/lessons", label: "Go to roadmap" }
    : { to: "/login", label: "Log in" };

  const stats = [
    { value: String(lessonCount), label: "Interactive lessons" },
    { value: stepValue, label: "Steps per lesson" },
    { value: `~${totalMinutes}`, label: "Minutes of practice" },
  ];

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 w-full">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-300/30 blur-3xl" />
            <div className="absolute -top-10 right-0 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-200/30 blur-3xl" />
          </div>

          <div className="mx-auto max-w-5xl px-4 pt-10 pb-12 sm:pt-16 sm:pb-16 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="hero-rise">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 ring-1 ring-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                AP Calculus BC · Derivatives &amp; Integrals
              </span>

              <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
                Master calculus,{" "}
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  from slopes to areas
                </span>
              </h1>

              <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Short, hands-on lessons on derivatives and integrals — with
                graphs you can manipulate and instant feedback on every step.
                Build real intuition for calculus, no passive lecturing.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
                <Link
                  to={primary.to}
                  className="inline-flex items-center justify-center min-h-[52px] px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-600/20 hover:from-indigo-700 hover:to-violet-700 transition"
                >
                  {primary.label}
                </Link>
                <Link
                  to={secondary.to}
                  className="inline-flex items-center justify-center min-h-[52px] px-6 rounded-xl border border-slate-300 bg-white/70 text-slate-700 font-semibold hover:bg-white hover:border-slate-400 transition"
                >
                  {secondary.label}
                </Link>
              </div>

              {user && hasStarted && (
                <div className="mt-6 max-w-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
                    <span>Your progress</span>
                    <span>{completion}% complete</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                      style={{ width: `${Math.max(completion, 4)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="hero-float order-first lg:order-last mx-auto w-full max-w-md lg:max-w-none">
              <HeroGraph />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center"
              >
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {s.value}
                </div>
                <div className="mt-1 text-xs sm:text-sm text-slate-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
            Why it works
          </h2>
          <p className="mt-2 text-center text-slate-600">
            Learning by doing beats reading every time.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white`}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
                    {f.icon}
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-lg text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Curriculum */}
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:pb-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                What you&apos;ll learn
              </h2>
              <p className="mt-2 text-slate-600">
                A guided path from intuition to computation.
              </p>
            </div>
            <Link
              to={primary.to}
              className="hidden sm:inline text-sm font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
            >
              See all →
            </Link>
          </div>

          <ol className="mt-6 space-y-3">
            {levels.map((level) => (
              <li
                key={level.id}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <span className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold">
                  {level.order}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{level.title}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {level.description}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {level.lessons.length}{" "}
                    {level.lessons.length === 1 ? "lesson" : "lessons"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-10 sm:px-12 sm:py-14 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <h2 className="relative text-2xl sm:text-3xl font-bold text-white">
              Ready to see calculus click?
            </h2>
            <p className="relative mt-2 text-indigo-100 max-w-md mx-auto">
              Jump into your first interactive lesson — it takes about six
              minutes.
            </p>
            <Link
              to={primary.to}
              className="relative mt-6 inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:bg-indigo-50 transition"
            >
              {primary.label}
            </Link>
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"} ·{" "}
            {stepValue} steps each · {course.subject}
          </p>
        </section>
      </main>
    </SafeArea>
  );
}
