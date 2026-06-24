import { useProgress } from "../../contexts/ProgressContext";

/** Weeks of history shown in the heatmap (columns). */
const WEEKS = 13;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** Emerald shade scaled to how many questions were answered that day. */
function cellClass(count: number, future: boolean): string {
  if (future) return "bg-transparent";
  if (count <= 0) return "bg-slate-100";
  if (count <= 2) return "bg-emerald-200";
  if (count <= 5) return "bg-emerald-400";
  if (count <= 9) return "bg-emerald-500";
  return "bg-emerald-700";
}

interface Cell {
  iso: string;
  count: number;
  future: boolean;
}

function buildWeeks(log: Record<string, number>): Cell[][] {
  const today = new Date().toISOString().slice(0, 10);
  // End on this week's Saturday so the final column is a full Sun–Sat week.
  const endOfWeek = addDays(today, 6 - dayOfWeek(today));
  const start = addDays(endOfWeek, -(WEEKS * 7 - 1));

  const weeks: Cell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const column: Cell[] = [];
    for (let r = 0; r < 7; r++) {
      const iso = addDays(start, w * 7 + r);
      column.push({ iso, count: log[iso] ?? 0, future: iso > today });
    }
    weeks.push(column);
  }
  return weeks;
}

/** GitHub-style contribution grid of the last few months of activity. */
export function ActivityHeatmap() {
  const { profile } = useProgress();
  if (!profile) return null;

  const log = profile.activityLog ?? {};
  const weeks = buildWeeks(log);
  const activeDays = Object.values(log).filter((n) => n > 0).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Activity</h2>
        <p className="text-sm text-slate-500">
          {activeDays} active day{activeDays === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-1">
          {weeks.map((column) => (
            <div key={column[0].iso} className="flex flex-col gap-1">
              {column.map((cell) => (
                <div
                  key={cell.iso}
                  className={`h-3 w-3 rounded-sm ${cellClass(cell.count, cell.future)}`}
                  title={
                    cell.future
                      ? undefined
                      : `${cell.iso}: ${cell.count} question${cell.count === 1 ? "" : "s"}`
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-slate-400">
        <span>Less</span>
        <span className="h-3 w-3 rounded-sm bg-slate-100" />
        <span className="h-3 w-3 rounded-sm bg-emerald-200" />
        <span className="h-3 w-3 rounded-sm bg-emerald-400" />
        <span className="h-3 w-3 rounded-sm bg-emerald-500" />
        <span className="h-3 w-3 rounded-sm bg-emerald-700" />
        <span>More</span>
      </div>
    </section>
  );
}
