import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useProgress } from "../../contexts/ProgressContext";
import { Icon } from "../common/Icon";

/**
 * Dev-only panel for skipping past lesson locks while testing. It renders only
 * under the demo/dev bypass (never in a real production login), and changes only
 * the local demo progress — so you can seed or clear progress to reach any
 * lesson without first finishing the ones before it.
 */
export function DevTools() {
  const { isDemo } = useAuth();
  const { completeAllLessons, resetProgress } = useProgress();
  const [busy, setBusy] = useState<null | "complete" | "reset">(null);

  if (!isDemo) return null;

  const run = async (action: "complete" | "reset") => {
    setBusy(action);
    try {
      if (action === "complete") await completeAllLessons();
      else await resetProgress();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <Icon name="wrench" className="h-4 w-4 text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">Dev tools</p>
        <span className="text-xs text-amber-700">local dev only</span>
      </div>
      <p className="mt-1 mb-3 text-xs text-amber-700">
        Skip lesson locks while testing. These change only your local demo
        progress.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run("complete")}
          disabled={busy !== null}
          className="min-h-[40px] px-4 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 active:scale-[0.98] transition"
        >
          {busy === "complete" ? "Completing…" : "Complete all lessons"}
        </button>
        <button
          type="button"
          onClick={() => void run("reset")}
          disabled={busy !== null}
          className="min-h-[40px] px-4 rounded-lg border border-amber-400 text-amber-800 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 active:scale-[0.98] transition"
        >
          {busy === "reset" ? "Resetting…" : "Reset progress"}
        </button>
      </div>
    </div>
  );
}
