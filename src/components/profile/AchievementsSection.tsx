import { useProgress } from "../../contexts/ProgressContext";
import { buildMilestoneStats } from "../../lib/progressService";
import { Icon } from "../common/Icon";
import {
  MILESTONE_DEFS,
  MILESTONE_ORDER,
  MILESTONE_SECTIONS,
  milestoneProgress,
  type MilestoneDef,
  type MilestoneStats,
} from "../../lib/milestones";

function unitFor(def: MilestoneDef): string {
  switch (def.metric) {
    case "streak":
      return "days";
    case "xp":
      return "XP";
    case "questions":
      return "questions";
    case "concepts":
    case "allConcepts":
      return "concepts";
    default:
      return "lessons";
  }
}

interface AchievementCardProps {
  def: MilestoneDef;
  earned: boolean;
  stats: MilestoneStats;
}

function AchievementCard({ def, earned, stats }: AchievementCardProps) {
  const { current, target } = milestoneProgress(def, stats);
  const pct =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const shownCurrent = Math.min(current, target);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        earned ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            earned ? "bg-emerald-100" : "bg-slate-100"
          }`}
          aria-hidden
        >
          <Icon
            name={def.icon}
            className={`h-6 w-6 ${earned ? "text-emerald-600" : "text-slate-400"}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`font-semibold ${
                earned ? "text-slate-900" : "text-slate-500"
              }`}
            >
              {def.title}
            </p>
            {earned && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Earned
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{def.description}</p>
          {!earned && (
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-right text-xs font-semibold text-slate-600">
                {shownCurrent}/{target} {unitFor(def)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Every achievement the learner can earn, split into what they've unlocked and
 * what's still ahead (with live progress). Linked to from the roadmap badges.
 */
export function AchievementsSection() {
  const { profile, progress } = useProgress();
  if (!profile) return null;

  const stats: MilestoneStats = buildMilestoneStats(profile, progress);

  const earned = new Set(profile.milestones);
  const earnedCount = MILESTONE_ORDER.filter((id) => earned.has(id)).length;

  return (
    <section id="achievements" className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Achievements</h2>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {earnedCount}/{MILESTONE_ORDER.length} earned
        </span>
      </div>
      <div className="space-y-6">
        {MILESTONE_SECTIONS.map((section) => {
          const sectionEarned = section.milestoneIds.filter((id) =>
            earned.has(id),
          ).length;
          return (
            <div key={section.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.label}
                </h3>
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  {sectionEarned}/{section.milestoneIds.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.milestoneIds.map((id) => (
                  <AchievementCard
                    key={id}
                    def={MILESTONE_DEFS[id]}
                    earned={earned.has(id)}
                    stats={stats}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
