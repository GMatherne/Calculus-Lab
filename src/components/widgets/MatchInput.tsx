import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { MatchAnswer } from "../../types/content";
import { RichText } from "./MathBlock";

interface MatchInputProps {
  spec: MatchAnswer;
  /** Chosen option (LaTeX) per prompt, by position (null where unmatched). */
  value: (string | null)[] | undefined;
  onChange: (value: (string | null)[]) => void;
  disabled?: boolean;
  /** When true, color each prompt's chosen option by that pair's correctness. */
  reveal?: boolean;
  /** Whether the whole answer was correct (slots self-color, so unused here). */
  isCorrect?: boolean;
}

type DropTarget = { kind: "slot"; index: number } | { kind: "bank" } | null;

interface DragInfo {
  option: string;
  /** Slot index the option is dragged from, or null when it comes from the bank. */
  from: number | null;
  startX: number;
  startY: number;
  pointerId: number;
  moved: boolean;
}

// A drag has to travel this far (px) before it counts as a drag rather than a
// tap, so a quick tap still places an option without spawning a drag ghost.
const MOVE_THRESHOLD = 6;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pair each fixed left-hand prompt with one right-hand option. Works with both
 * mouse and touch via pointer events: drag an option onto a slot to place it, or
 * tap an option to drop it into the active slot (or the first empty one). Tap a
 * filled slot to clear it and re-pick. Each option is used at most once, so
 * placing it in a new slot moves it out of any slot it already occupied. On
 * reveal, each filled slot colors by its own correctness — green if that pair is
 * right, red if wrong — without exposing the correct option for the wrong ones.
 */
export function MatchInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
}: MatchInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragInfo | null>(null);
  // True for the instant after a real drag ends, so the click event browsers
  // fire after pointerup doesn't also trigger a tap handler.
  const justDraggedRef = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(
    null,
  );
  const [hover, setHover] = useState<DropTarget>(null);
  const [active, setActive] = useState<number | null>(null);

  const picks: (string | null)[] = spec.pairs.map((_, i) => value?.[i] ?? null);

  // The widget isn't remounted between questions, so drop any stale active-slot
  // selection when the question (spec) changes.
  useEffect(() => setActive(null), [spec]);

  // Bank = every correct match plus any distractors, shuffled once per question.
  // The spec reference is stable within a step, so a retry keeps the layout and
  // it only reshuffles when the step changes.
  const options = useMemo(
    () => shuffle([...spec.pairs.map((p) => p.match), ...(spec.distractors ?? [])]),
    [spec],
  );
  const available = options.filter((o) => !picks.includes(o));

  // Place an option into a slot; since an option is used once, pull it out of
  // any slot it already sits in first.
  const assignToSlot = (option: string, target: number) => {
    const next = spec.pairs.map((_, i) => picks[i]);
    const prev = next.indexOf(option);
    if (prev !== -1) next[prev] = null;
    next[target] = option;
    onChange(next);
    setActive(null);
  };

  // Return an option to the bank by clearing whichever slot holds it.
  const clearOption = (option: string) => {
    const next = spec.pairs.map((_, i) => picks[i]);
    const idx = next.indexOf(option);
    if (idx === -1) return;
    next[idx] = null;
    onChange(next);
  };

  const onOptionTap = (option: string) => {
    if (disabled || justDraggedRef.current) return;
    const target = active ?? picks.findIndex((p) => p === null);
    if (target < 0) return;
    assignToSlot(option, target);
  };

  const onSlotTap = (i: number) => {
    if (disabled || justDraggedRef.current) return;
    if (picks[i] != null) {
      // Clear a filled slot (returning its option to the bank) and target it
      // so the next option tap refills it.
      const next = spec.pairs.map((_, k) => picks[k]);
      next[i] = null;
      onChange(next);
      setActive(i);
    } else {
      setActive((cur) => (cur === i ? null : i));
    }
  };

  const dropTargetAt = (x: number, y: number): DropTarget => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const zone = el?.closest("[data-dropzone]") as HTMLElement | null;
    if (!zone || !rootRef.current?.contains(zone)) return null;
    const v = zone.getAttribute("data-dropzone");
    if (v === "bank") return { kind: "bank" };
    if (v?.startsWith("slot-")) return { kind: "slot", index: Number(v.slice(5)) };
    return null;
  };

  // Latest move/up logic, refreshed every render so it always sees current
  // `picks`. The window listeners themselves are stable wrappers (below), so
  // they attach/detach symmetrically even if the component re-renders mid-drag.
  const moveRef = useRef<(e: globalThis.PointerEvent) => void>(() => {});
  const upRef = useRef<(e: globalThis.PointerEvent) => void>(() => {});

  moveRef.current = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < MOVE_THRESHOLD)
      return;
    d.moved = true;
    setGhost({ x: e.clientX, y: e.clientY, label: d.option });
    setHover(dropTargetAt(e.clientX, e.clientY));
  };

  upRef.current = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onWindowUp);
    window.removeEventListener("pointercancel", onWindowUp);
    dragRef.current = null;
    setGhost(null);
    setHover(null);

    // A plain press with no drag is a tap; let the button's onClick handle it
    // (covers mouse, touch, keyboard, and assistive tech uniformly).
    if (e.type === "pointercancel" || !d.moved) return;
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
    const target = dropTargetAt(e.clientX, e.clientY);
    if (target?.kind === "slot") assignToSlot(d.option, target.index);
    else if (target?.kind === "bank") clearOption(d.option);
    else if (d.from !== null) clearOption(d.option);
  };

  const onWindowMove = useRef((e: globalThis.PointerEvent) => moveRef.current(e)).current;
  const onWindowUp = useRef((e: globalThis.PointerEvent) => upRef.current(e)).current;

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
    };
  }, [onWindowMove, onWindowUp]);

  const startDrag = (
    e: ReactPointerEvent,
    option: string | null,
    from: number | null,
  ) => {
    if (disabled || e.button !== 0 || !option) return;
    dragRef.current = {
      option,
      from,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      moved: false,
    };
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
  };

  // While a drag is active (ghost shown), dim the tile/slot it originated from.
  const draggingOption = ghost ? dragRef.current?.option ?? null : null;
  const draggingFrom = ghost ? dragRef.current?.from ?? null : null;

  const optionBtn =
    "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm transition hover:border-indigo-400 active:scale-95 disabled:cursor-default disabled:opacity-60 touch-none cursor-grab select-none";

  return (
    <div ref={rootRef} className="space-y-4 select-none">
      <div className="space-y-2">
        {spec.pairs.map((pair, i) => {
          const chosen = picks[i];
          const isActive = active === i;
          const isHover = hover?.kind === "slot" && hover.index === i;
          const pairCorrect = chosen != null && chosen === pair.match;

          let slotClasses =
            "flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 px-3 py-2 text-base transition-colors ";
          if (reveal && chosen) {
            slotClasses += pairCorrect
              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
              : "border-rose-500 bg-rose-50 text-rose-900";
          } else if (isHover) {
            slotClasses += "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200";
          } else if (isActive) {
            slotClasses += "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200";
          } else if (chosen) {
            slotClasses += "border-indigo-300 bg-indigo-50 text-indigo-900";
          } else {
            slotClasses += "border-dashed border-slate-300 bg-white text-slate-300";
          }
          if (chosen) slotClasses += " touch-none cursor-grab";
          if (draggingFrom === i) slotClasses += " opacity-30";

          return (
            <div key={i} className="flex items-stretch gap-2 sm:gap-3">
              <div className="flex min-h-[52px] flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-800">
                <RichText text={pair.prompt} />
              </div>
              <span aria-hidden className="flex items-center text-xl text-slate-300">
                →
              </span>
              <button
                type="button"
                data-dropzone={`slot-${i}`}
                disabled={disabled}
                onPointerDown={(e) => startDrag(e, chosen, i)}
                onClick={() => onSlotTap(i)}
                aria-label={
                  chosen
                    ? `Match for ${pair.prompt} is ${chosen}. Drag it out, or activate to change it.`
                    : `Empty match for ${pair.prompt}. Drag an option here, or activate then tap an option.`
                }
                className={slotClasses}
              >
                {chosen ? <RichText text={chosen} /> : "Drag a label here"}
              </button>
            </div>
          );
        })}
      </div>

      <div
        data-dropzone="bank"
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
          hover?.kind === "bank"
            ? "border-indigo-400 bg-indigo-50/50"
            : "border-slate-300 bg-white"
        }`}
      >
        <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
          {active != null ? "Tap an option to place it" : "Drag a label onto a match — or tap"}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {available.length === 0 ? (
            <span className="py-2 text-sm text-slate-400">
              All labels placed — drag or tap a match to change it.
            </span>
          ) : (
            available.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                aria-label={`Option ${opt}. Drag onto a match, or tap to place it.`}
                onPointerDown={(e) => startDrag(e, opt, null)}
                onClick={() => onOptionTap(opt)}
                className={`${optionBtn} ${
                  draggingFrom === null && draggingOption === opt ? "opacity-30" : ""
                }`}
              >
                <RichText text={opt} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Floating ghost that follows the pointer during a drag. */}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-indigo-400 bg-white px-3 py-2 text-base text-slate-900 shadow-xl"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <RichText text={ghost.label} />
        </div>
      )}
    </div>
  );
}
