import { useProgress } from "../../contexts/ProgressContext";

/**
 * Compact display of the learner's total XP. Renders only when signed in so the
 * count is always visible in the app chrome (e.g. the header).
 */
export function XpBadge() {
  const { profile } = useProgress();
  if (!profile) return null;
  const xp = profile.xp ?? 0;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1.5 text-sm font-semibold"
      title="Experience points — earned by completing lessons"
    >
      <span aria-hidden>⚡</span>
      {xp.toLocaleString()} XP
    </div>
  );
}
