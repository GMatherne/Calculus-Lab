import { useProgress } from "../../contexts/ProgressContext";
import { useCountUp } from "../../hooks/useCountUp";
import { getCompletionPercent, getPublishedLessons } from "../../lib/contentLoader";
import { computeLongestStreak, isLessonComplete } from "../../lib/progressService";
import { Icon, type IconName } from "../common/Icon";

interface StatTileProps {
  icon: IconName;
  /** Tailwind text-color utility tinting the icon. */
  iconClass: string;
  value: string;
  label: string;
}

function StatTile({ icon, iconClass, value, label }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <Icon name={icon} className={`h-7 w-7 ${iconClass}`} />
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

/** Headline numbers for the profile: XP, completion, lessons, and streaks. */
export function StatsStrip() {
  const { profile, progress } = useProgress();
  // Hook runs before the early return so the order stays stable; rolls up from
  // zero when the profile opens.
  const animatedXp = useCountUp(profile?.xp ?? 0, { initial: 0 });
  if (!profile) return null;

  const published = getPublishedLessons();
  const lessonsDone = published.filter((l) =>
    isLessonComplete(progress[l.id]?.status),
  ).length;
  const completion = getCompletionPercent(progress);
  const currentStreak = profile.streak.count;
  const longestStreak = computeLongestStreak(profile.activityLog);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile
        icon="zap"
        iconClass="text-amber-500"
        value={animatedXp.toLocaleString()}
        label="Total XP"
      />
      <StatTile
        icon="pieChart"
        iconClass="text-indigo-500"
        value={`${completion}%`}
        label="Course complete"
      />
      <StatTile
        icon="bookOpen"
        iconClass="text-sky-500"
        value={`${lessonsDone}/${published.length}`}
        label="Lessons finished"
      />
      <StatTile
        icon="flame"
        iconClass="text-orange-500"
        value={`${currentStreak}`}
        label={`Day streak${currentStreak === 1 ? "" : "s"}`}
      />
      <StatTile
        icon="medal"
        iconClass="text-yellow-500"
        value={`${longestStreak}`}
        label="Longest streak"
      />
    </div>
  );
}
