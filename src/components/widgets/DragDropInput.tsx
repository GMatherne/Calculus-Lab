import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DragDropAnswer } from "../../types/content";
import { MathBlock } from "./MathBlock";

interface DragDropInputProps {
  spec: DragDropAnswer;
  /** Placed tile value per blank (null where empty). */
  value: (string | null)[] | undefined;
  onChange: (value: (string | null)[]) => void;
  disabled?: boolean;
  /** When true, color the filled blanks to reflect correctness. */
  reveal?: boolean;
  /** Whether the submitted answer was correct (only meaningful when reveal is true). */
  isCorrect?: boolean;
}

interface Tile {
  /** Stable key: the tile's index in the original (unshuffled) bank. */
  id: number;
  latex: string;
}

type DropTarget = { kind: "blank"; index: number } | { kind: "bank" } | null;

interface DragInfo {
  latex: string;
  /** Blank index the tile is dragged from, or null when it comes from the bank. */
  from: number | null;
  startX: number;
  startY: number;
  pointerId: number;
  moved: boolean;
}

// A drag has to travel this far (px) before it counts as a drag rather than a
// tap, so a quick tap still places a tile without spawning a drag ghost.
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
 * Build an expression by dragging term tiles from a shared bank into ordered
 * blanks. Works with both mouse and touch via pointer events, and a tap also
 * places a tile (into the first empty blank) or returns it to the bank, so it's
 * usable without a precise drag.
 */
export function DragDropInput({
  spec,
  value,
  onChange,
  disabled,
  reveal,
  isCorrect,
}: DragDropInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragInfo | null>(null);
  // True for the instant after a real drag ends, so the click event browsers
  // fire after pointerup doesn't also trigger the tap-to-place handler.
  const justDraggedRef = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; latex: string } | null>(
    null,
  );
  const [hover, setHover] = useState<DropTarget>(null);

  // Shuffle once per question. The spec reference is stable within a step, so a
  // retry keeps the same bank layout; it only reshuffles when the step changes.
  const tiles = useMemo<Tile[]>(
    () => shuffle(spec.bank.map((latex, id) => ({ id, latex }))),
    [spec],
  );

  const placed: (string | null)[] = spec.blanks.map((_, i) => value?.[i] ?? null);
  const available = tiles.filter((t) => !placed.includes(t.latex));

  const dropTargetAt = (x: number, y: number): DropTarget => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const zone = el?.closest("[data-dropzone]") as HTMLElement | null;
    if (!zone || !rootRef.current?.contains(zone)) return null;
    const v = zone.getAttribute("data-dropzone");
    if (v === "bank") return { kind: "bank" };
    if (v?.startsWith("blank-")) return { kind: "blank", index: Number(v.slice(6)) };
    return null;
  };

  const placeTile = (latex: string, from: number | null, to: DropTarget) => {
    const next = [...placed];
    if (from !== null) next[from] = null;
    // Dropping onto an occupied blank overwrites it; the displaced tile is no
    // longer in `next`, so it automatically reappears in the bank.
    if (to?.kind === "blank") next[to.index] = latex;
    onChange(next);
  };

  const tapTile = (latex: string, from: number | null) => {
    if (from !== null) {
      placeTile(latex, from, { kind: "bank" });
      return;
    }
    const firstEmpty = placed.findIndex((p) => p === null);
    if (firstEmpty === -1) return;
    placeTile(latex, null, { kind: "blank", index: firstEmpty });
  };

  // Latest move/up logic, refreshed every render so it always sees current
  // `placed`. The window listeners themselves are stable wrappers (below), so
  // they attach/detach symmetrically even if the component re-renders mid-drag.
  const moveRef = useRef<(e: globalThis.PointerEvent) => void>(() => {});
  const upRef = useRef<(e: globalThis.PointerEvent) => void>(() => {});

  moveRef.current = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < MOVE_THRESHOLD)
      return;
    d.moved = true;
    setGhost({ x: e.clientX, y: e.clientY, latex: d.latex });
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
    if (target?.kind === "blank") placeTile(d.latex, d.from, target);
    else if (target?.kind === "bank") placeTile(d.latex, d.from, { kind: "bank" });
    else if (d.from !== null) placeTile(d.latex, d.from, { kind: "bank" });
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
    latex: string,
    from: number | null,
  ) => {
    if (disabled || e.button !== 0) return;
    dragRef.current = {
      latex,
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

  // Tap-to-place: clicking a bank tile drops it into the first empty blank;
  // clicking a placed tile returns it to the bank. Skipped right after a drag so
  // the trailing click doesn't double-fire.
  const onTileClick = (latex: string, from: number | null) => {
    if (disabled || justDraggedRef.current) return;
    tapTile(latex, from);
  };

  // While a drag is active (ghost shown), dim the tile it originated from.
  const draggingLatex = ghost ? dragRef.current?.latex ?? null : null;
  const draggingFrom = ghost ? dragRef.current?.from ?? null : null;

  const tileBtn =
    "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg text-slate-900 shadow-sm transition hover:border-indigo-400 active:scale-95 disabled:cursor-default disabled:opacity-60 touch-none cursor-grab select-none";

  return (
    <div ref={rootRef} className="space-y-4 select-none">
      {/* The expression being assembled: prefix + blanks joined by connectors. */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6">
        {spec.prefix && (
          <span className="text-lg text-slate-800">
            <MathBlock latex={spec.prefix} />
          </span>
        )}
        {spec.blanks.map((blank, i) => {
          const tileLatex = placed[i];
          const isHover = hover?.kind === "blank" && hover.index === i;
          let blankClasses =
            "inline-flex min-w-[72px] min-h-[48px] items-center justify-center rounded-lg border-2 px-2 py-1 text-lg transition-colors ";
          if (reveal && tileLatex) {
            blankClasses += isCorrect
              ? "border-emerald-500 bg-emerald-50"
              : "border-rose-500 bg-rose-50";
          } else if (isHover) {
            blankClasses += "border-indigo-500 bg-indigo-50";
          } else if (tileLatex) {
            blankClasses += "border-indigo-300 bg-indigo-50";
          } else {
            blankClasses += "border-dashed border-slate-300 bg-white";
          }

          return (
            <span key={i} className="inline-flex items-center gap-2">
              {i > 0 && (
                <span className="text-lg font-semibold text-slate-500">
                  {blank.connector ?? "+"}
                </span>
              )}
              <span data-dropzone={`blank-${i}`} className={blankClasses}>
                {tileLatex ? (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Term ${tileLatex} in blank ${i + 1}. Activate to return it to the bank.`}
                    onPointerDown={(e) => startDrag(e, tileLatex, i)}
                    onClick={() => onTileClick(tileLatex, i)}
                    className={`min-h-[40px] px-1 text-lg text-slate-900 touch-none cursor-grab disabled:cursor-default ${
                      draggingFrom === i ? "opacity-30" : ""
                    }`}
                  >
                    <MathBlock latex={tileLatex} />
                  </button>
                ) : (
                  <span aria-hidden className="text-slate-300">
                    ?
                  </span>
                )}
              </span>
            </span>
          );
        })}
      </div>

      {/* The shared bank of draggable tiles. */}
      <div
        data-dropzone="bank"
        className={`flex min-h-[68px] flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
          hover?.kind === "bank"
            ? "border-indigo-400 bg-indigo-50/50"
            : "border-slate-300 bg-white"
        }`}
      >
        {available.length === 0 ? (
          <span className="py-2 text-sm text-slate-400">
            All terms placed — drag one back here to undo.
          </span>
        ) : (
          available.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              aria-label={`Term ${t.latex}. Drag into a blank, or activate to place it.`}
              onPointerDown={(e) => startDrag(e, t.latex, null)}
              onClick={() => onTileClick(t.latex, null)}
              className={`${tileBtn} ${
                draggingFrom === null && draggingLatex === t.latex ? "opacity-30" : ""
              }`}
            >
              <MathBlock latex={t.latex} />
            </button>
          ))
        )}
      </div>

      {/* Floating ghost that follows the pointer during a drag. */}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-indigo-400 bg-white px-3 py-2 text-lg text-slate-900 shadow-xl"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <MathBlock latex={ghost.latex} />
        </div>
      )}
    </div>
  );
}
