import type { OrderListAnswer } from "../../types/content";
import { RichText } from "./MathBlock";

interface OrderListInputProps {
  spec: OrderListAnswer;
  /** Current ordering of the item strings (seeded shuffled by the player). */
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** When true, color each row by whether it sits in its correct position. */
  reveal?: boolean;
  isCorrect?: boolean;
}

/**
 * Arrange shuffled items into the correct sequence using up/down controls — the
 * steps of a derivation, say, or values sorted least-to-greatest. Reordering is
 * the interaction, so a "what comes first?" idea becomes something the learner
 * physically assembles rather than reads off a list of choices.
 */
export function OrderListInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
}: OrderListInputProps) {
  // Before the player seeds a shuffle, fall back to the authored order so the
  // list still renders (the seed lands on the next tick).
  const order = value && value.length === spec.items.length ? value : spec.items;

  const move = (i: number, dir: -1 | 1) => {
    if (disabled) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const arrowBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg leading-none text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-30 active:scale-95";

  return (
    <div className="space-y-2">
      {spec.orderLabel && (
        <div className="text-center text-sm font-semibold text-slate-600">
          <RichText text={spec.orderLabel} />
        </div>
      )}
      <ol className="space-y-2">
        {order.map((item, i) => {
          const inPlace = reveal && order[i] === spec.items[i];
          const outOfPlace = reveal && order[i] !== spec.items[i];
          let rowCls =
            "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ";
          if (inPlace) rowCls += "border-emerald-500 bg-emerald-50";
          else if (outOfPlace) rowCls += "border-rose-500 bg-rose-50";
          else rowCls += "border-slate-200 bg-white";

          return (
            <li key={item} className={rowCls}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                {i + 1}
              </span>
              <span className="flex-1 text-base text-slate-900">
                <RichText text={item} />
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move "${item}" up`}
                  className={arrowBtn}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || i === order.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move "${item}" down`}
                  className={arrowBtn}
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
