import { MILESTONE_DEFS } from "../../types/content";

interface MilestoneToastProps {
  milestoneId: string;
  onDismiss: () => void;
}

export function MilestoneToast({ milestoneId, onDismiss }: MilestoneToastProps) {
  const def = MILESTONE_DEFS[milestoneId];
  if (!def) return null;

  return (
    <div className="fixed inset-x-4 top-20 z-50 rounded-xl bg-indigo-600 text-white p-4 shadow-lg animate-pulse">
      <p className="font-bold">{def.title}</p>
      <p className="text-sm text-indigo-100">{def.description}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-sm underline min-h-[44px]"
      >
        Nice!
      </button>
    </div>
  );
}
