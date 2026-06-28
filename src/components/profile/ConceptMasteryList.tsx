import { useProgress } from "../../contexts/ProgressContext";
import { getConceptMastery } from "../../lib/masteryService";
import type { ConceptMastery, ConceptMasteryTier } from "../../types/content";

const TIER_META: Record<
  ConceptMasteryTier,
  { label: string; pill: string; bar: string }
> = {
  mastered: {
    label: "Mastered",
    pill: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
  },
  proficient: {
    label: "Proficient",
    pill: "bg-indigo-100 text-indigo-700",
    bar: "bg-indigo-500",
  },
  learning: {
    label: "Learning",
    pill: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
  },
  not_started: {
    label: "Not started",
    pill: "bg-slate-100 text-slate-400",
    bar: "bg-slate-300",
  },
};

function ConceptRow({ mastery }: { mastery: ConceptMastery }) {
  const meta = TIER_META[mastery.tier];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{mastery.label}</p>
          <p className="text-xs text-slate-500">
            {mastery.cleared}/{mastery.total} questions cleared
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.pill}`}
        >
          {meta.label}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all ${meta.bar}`}
            style={{ width: `${mastery.percent}%` }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-xs font-semibold text-slate-600">
          {mastery.percent}%
        </span>
      </div>
    </div>
  );
}

/** Every concept in the course with its first-try mastery, in course order. */
export function ConceptMasteryList() {
  const { progress, profile } = useProgress();
  const mastery = getConceptMastery(progress, profile?.conceptStats);

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-slate-900">Mastery by topic</h2>
      <p className="mb-3 text-sm text-slate-500">
        Based on the questions you answer correctly on the first try.
      </p>
      <div className="space-y-3">
        {mastery.map((m) => (
          <ConceptRow key={m.concept} mastery={m} />
        ))}
      </div>
    </section>
  );
}
