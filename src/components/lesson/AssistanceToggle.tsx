import type { AssistanceLevel } from "../../types/content";
import { Icon } from "../common/Icon";
import type { IconName } from "../common/icons";

interface ToggleOption {
  level: AssistanceLevel;
  label: string;
  icon: IconName;
  /** Tooltip describing what this level does. */
  desc: string;
}

const OPTIONS: ToggleOption[] = [
  {
    level: "solve",
    label: "Solve it",
    icon: "bookOpen",
    desc: "Work it out for me and explain why",
  },
  {
    level: "hints",
    label: "Hints",
    icon: "lightbulb",
    desc: "Give me hints to guide me to the answer",
  },
  {
    level: "none",
    label: "No help",
    icon: "target",
    desc: "No hints — I'm on my own",
  },
];

interface AssistanceToggleProps {
  value: AssistanceLevel;
  onChange: (level: AssistanceLevel) => void;
  /** When false, the "Solve it" option is hidden (e.g. practice questions). */
  allowSolve?: boolean;
}

/**
 * A segmented control letting the learner choose how much help a question gives:
 * a full worked solution, guiding hints, or nothing at all. Practice questions
 * pass `allowSolve={false}` so they offer only Hints / No help.
 */
export function AssistanceToggle({
  value,
  onChange,
  allowSolve = true,
}: AssistanceToggleProps) {
  const options = allowSolve
    ? OPTIONS
    : OPTIONS.filter((o) => o.level !== "solve");

  return (
    <div
      role="group"
      aria-label="How much help do you want?"
      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {options.map((option) => {
        const active = option.level === value;
        return (
          <button
            key={option.level}
            type="button"
            title={option.desc}
            aria-pressed={active}
            onClick={() => onChange(option.level)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon name={option.icon} className="h-4 w-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
