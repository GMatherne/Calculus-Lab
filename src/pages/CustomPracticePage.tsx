import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCustomPracticeSession,
  getCustomPracticeTopics,
} from "../lib/contentLoader";
import { conceptLabel } from "../lib/masteryService";
import { getReviewPriorities } from "../lib/reviewPlanner";
import { useProgress } from "../contexts/ProgressContext";
import {
  CUSTOM_PRACTICE_DEFAULT_SIZE,
  CUSTOM_PRACTICE_MAX_SIZE,
} from "../lib/constants";
import { PracticeResults } from "../components/lesson/PracticeResults";
import { SessionRunner } from "../components/lesson/SessionRunner";
import { useQuizSession } from "../hooks/useQuizSession";
import { Icon } from "../components/common/Icon";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

/** Keep a requested question count within [1, max] (max is the pool size). */
function clampSize(value: number, max: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(Math.round(value), Math.max(1, max)));
}

/** How many topics to surface as "recommended" (mirrors the targeted-review spread). */
const RECOMMENDED_LIMIT = 3;

export function CustomPracticePage() {
  const { progress, profile, loading } = useProgress();

  // Concepts the learner can practice, drawn only from started lessons.
  const topics = useMemo(() => getCustomPracticeTopics(progress), [progress]);

  // Concepts ranked by the same learning-science signal the targeted review
  // uses: a blend of weakness (shaky first-try accuracy, including practice) and
  // recency/spacing (how long since the topic was last practiced).
  const priorities = useMemo(
    () => getReviewPriorities(progress, profile?.conceptStats),
    [progress, profile?.conceptStats],
  );

  // The few highest-priority topics that are actually practiceable now, each
  // with a short reason. Only topics with a real signal (priority > 0) qualify,
  // so freshly-mastered material isn't flagged.
  const recommended = useMemo(() => {
    const available = new Set(topics.map((t) => t.concept));
    const order: string[] = [];
    const reasons = new Map<string, string>();
    for (const p of priorities) {
      if (order.length >= RECOMMENDED_LIMIT) break;
      if (!available.has(p.concept) || p.priority <= 0) continue;
      order.push(p.concept);
      reasons.set(
        p.concept,
        p.weakness >= p.recency
          ? "you've been shaky here"
          : "it's been a while since you practiced this",
      );
    }
    return { set: new Set(order), order, reasons };
  }, [topics, priorities]);

  // Recommended topics first (in priority order), then everything else as-is.
  const orderedTopics = useMemo(() => {
    if (recommended.order.length === 0) return topics;
    const rank = new Map(recommended.order.map((c, i) => [c, i]));
    const rec = topics
      .filter((t) => rank.has(t.concept))
      .sort((a, b) => rank.get(a.concept)! - rank.get(b.concept)!);
    const rest = topics.filter((t) => !rank.has(t.concept));
    return [...rec, ...rest];
  }, [topics, recommended]);

  const [selected, setSelected] = useState<string[]>([]);
  const [size, setSize] = useState(CUSTOM_PRACTICE_DEFAULT_SIZE);
  // Dismissed (true) once the learner starts; the picker shows until then.
  const [started, setStarted] = useState(false);

  // How many questions back the current selection, used to cap the count.
  const availableForSelection = useMemo(
    () =>
      topics
        .filter((t) => selected.includes(t.concept))
        .reduce((sum, t) => sum + t.count, 0),
    [topics, selected],
  );
  const maxSize = Math.min(CUSTOM_PRACTICE_MAX_SIZE, availableForSelection);
  const effectiveSize = clampSize(size, maxSize);

  const session = useQuizSession({
    ready: started,
    lesson: { id: "custom-practice", title: "Custom Practice", order: 0 },
    // A fresh draw for this attempt; selection and size are locked in at start.
    buildSteps: () => getCustomPracticeSession(progress, selected, effectiveSize),
  });

  function toggleTopic(concept: string) {
    setSelected((prev) =>
      prev.includes(concept)
        ? prev.filter((c) => c !== concept)
        : [...prev, concept],
    );
  }

  const allSelected = topics.length > 0 && selected.length === topics.length;
  function toggleAll() {
    setSelected(allSelected ? [] : topics.map((t) => t.concept));
  }

  function selectRecommended() {
    setSelected(recommended.order);
  }

  function startSession() {
    if (selected.length === 0) return;
    setStarted(true);
    // Re-samples with the locked-in selection (and clears any prior result).
    session.retry();
  }

  // --- Session phase ---
  if (started && session.lesson) {
    if (session.result) {
      return (
        <PracticeResults
          result={session.result}
          title="Custom practice"
          retryLabel="New set"
          onRetry={session.retry}
          secondaryAction={{
            label: "Change topics",
            onClick: () => {
              setStarted(false);
              session.retry();
            },
          }}
        />
      );
    }

    return (
      <SessionRunner
        lesson={session.lesson}
        playerKey={session.playerKey}
        onComplete={session.complete}
        exitGuard={session.exitGuard}
        leaveTitle="Leave practice?"
        cancelLabel="Keep practicing"
      />
    );
  }

  // --- Config phase ---
  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Custom practice</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose your topics and how many questions you want.
          </p>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading topics…</p>
        ) : topics.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-slate-700">
              Start a lesson first — custom practice pulls from what you've
              learned.
            </p>
            <Link
              to="/lessons"
              className="mt-3 inline-block font-semibold text-indigo-600"
            >
              Back to lessons
            </Link>
          </div>
        ) : (
          <>
            <section className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">Topics</h2>
                <div className="flex items-center gap-3">
                  {recommended.order.length > 0 && (
                    <button
                      type="button"
                      onClick={selectRecommended}
                      className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                    >
                      Select recommended
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
              </div>
              {recommended.order.length > 0 && (
                <p className="mb-3 flex items-start gap-1.5 text-sm text-slate-500">
                  <Icon
                    name="star"
                    fill="currentColor"
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                  />
                  <span>
                    Recommended: the topics you're shakiest on or haven't
                    revisited recently (spaced repetition).
                  </span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {orderedTopics.map((t) => {
                  const isSelected = selected.includes(t.concept);
                  const isRecommended = recommended.set.has(t.concept);
                  const reason = recommended.reasons.get(t.concept);
                  return (
                    <button
                      key={t.concept}
                      type="button"
                      aria-pressed={isSelected}
                      title={
                        isRecommended ? `Recommended — ${reason}` : undefined
                      }
                      onClick={() => toggleTopic(t.concept)}
                      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition active:scale-[0.97] ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50"
                      }`}
                    >
                      {isRecommended && (
                        <Icon
                          name="star"
                          fill="currentColor"
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isSelected ? "text-amber-200" : "text-amber-500"
                          }`}
                        />
                      )}
                      <span>
                        {conceptLabel(t.concept)}
                        <span
                          className={
                            isSelected ? "text-indigo-100" : "text-slate-400"
                          }
                        >
                          {" · "}
                          {t.count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 font-semibold text-slate-900">
                Number of questions
              </h2>
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
                  <button
                    type="button"
                    aria-label="Fewer questions"
                    disabled={effectiveSize <= 1}
                    onClick={() => setSize(clampSize(effectiveSize - 1, maxSize))}
                    className="h-11 w-11 text-xl font-semibold text-slate-600 disabled:opacity-40"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(1, maxSize)}
                    value={effectiveSize}
                    onChange={(e) =>
                      setSize(clampSize(Number(e.target.value), maxSize))
                    }
                    aria-label="Number of questions"
                    className="h-11 w-14 border-x border-slate-300 text-center font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label="More questions"
                    disabled={effectiveSize >= maxSize}
                    onClick={() => setSize(clampSize(effectiveSize + 1, maxSize))}
                    className="h-11 w-11 text-xl font-semibold text-slate-600 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  {selected.length === 0
                    ? "Pick at least one topic"
                    : `${availableForSelection} question${
                        availableForSelection === 1 ? "" : "s"
                      } available`}
                </p>
              </div>
            </section>

            <button
              type="button"
              onClick={startSession}
              disabled={selected.length === 0}
              className="block w-full min-h-[48px] rounded-xl bg-indigo-600 font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-indigo-600"
            >
              Start practice
            </button>
            <Link
              to="/lessons"
              className="mt-3 block w-full min-h-[44px] text-center font-medium leading-[44px] text-slate-500 hover:text-indigo-600"
            >
              Back to lessons
            </Link>
          </>
        )}
      </main>
    </SafeArea>
  );
}
