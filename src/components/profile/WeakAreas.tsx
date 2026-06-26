import { Link } from "react-router-dom";
import { useProgress } from "../../contexts/ProgressContext";
import { getWeakConcepts } from "../../lib/masteryService";
import { Icon } from "../common/Icon";

/** "Recommended review" — the learner's shakiest concepts, linked to practice. */
export function WeakAreas() {
  const { progress } = useProgress();
  const weak = getWeakConcepts(progress);
  if (weak.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-slate-900">Recommended review</h2>
      <div className="space-y-3">
        {weak.map((concept) => (
          <Link
            key={concept.concept}
            to={concept.reviewHref}
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-4 transition hover:border-amber-400 hover:bg-amber-50/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
                aria-hidden
              >
                <Icon name="target" className="h-5 w-5 text-amber-600" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{concept.label}</p>
                <p className="text-sm text-slate-500">
                  {concept.percent}% mastery · practice in {concept.reviewLessonTitle}
                </p>
              </div>
            </div>
            <span className="font-semibold text-amber-600" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
