import { useProgress } from "../../contexts/ProgressContext";

export function StreakBadge() {
  const { profile } = useProgress();
  const count = profile?.streak.count ?? 0;
  if (count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-800 px-3 py-1.5 text-sm font-semibold">
      <span aria-hidden>🔥</span>
      {count} day{count !== 1 ? "s" : ""}
    </div>
  );
}
