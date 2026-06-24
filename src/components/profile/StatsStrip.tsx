import { useProgress } from "../../contexts/ProgressContext";
import { getCompletionPercent, getPublishedLessons } from "../../lib/contentLoader";
import { computeLongestStreak, isLessonComplete } from "../../lib/progressService";

interface StatTileProps {
  icon: string;
  value: string;
  label: string;
}

function StatTile({ icon, value, label }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-2xl" aria-hidden>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

/** Headline numbers for the profile: XP, completion, lessons, and streaks. */
export function StatsStrip() {
  const { profile, progress } = useProgress();
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
      <StatTile icon="⚡" value={(profile.xp ?? 0).toLocaleString()} label="Total XP" />
      <StatTile icon="📊" value={`${completion}%`} label="Course complete" />
      <StatTile
        icon="📚"
        value={`${lessonsDone}/${published.length}`}
        label="Lessons finished"
      />
      <StatTile
        icon="🔥"
        value={`${currentStreak}`}
        label={`Day streak${currentStreak === 1 ? "" : "s"}`}
      />
      <StatTile icon="🏅" value={`${longestStreak}`} label="Longest streak" />
    </div>
  );
}
