import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { course } from "../lib/contentLoader";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { StatsStrip } from "../components/profile/StatsStrip";
import { ActivityHeatmap } from "../components/profile/ActivityHeatmap";
import { WeakAreas } from "../components/profile/WeakAreas";
import { ConceptMasteryList } from "../components/profile/ConceptMasteryList";

export function ProfilePage() {
  const { user, isDemo } = useAuth();
  const { profile, loading } = useProgress();

  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? "Student";

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 pb-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {displayName}
            {isDemo && (
              <span className="ml-2 align-middle text-xs font-medium text-slate-400">
                (demo)
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{course.subject}</p>
        </header>

        {loading ? (
          <p className="text-slate-500">Loading your progress…</p>
        ) : (
          <div className="space-y-8">
            <StatsStrip />
            <ActivityHeatmap />
            <WeakAreas />
            <ConceptMasteryList />
          </div>
        )}
      </main>
    </SafeArea>
  );
}
