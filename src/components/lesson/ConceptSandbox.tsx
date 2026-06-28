import { useState, type ReactNode } from "react";
import type {
  IntegralBoundsAnswer,
  RiemannAnswer,
  Sandbox,
} from "../../types/content";
import {
  buildSandboxArea,
  buildSandboxFtc,
  buildSandboxGraph,
  buildSandboxRiemann,
  buildSandboxShape,
  sandboxKind,
} from "../../lib/sandbox";
import { GraphWidget } from "../widgets/GraphWidget";
import { RiemannInput } from "../widgets/RiemannInput";
import { IntegralBoundsInput } from "../widgets/IntegralBoundsInput";
import { PowerRuleExplorer } from "./PowerRuleExplorer";
import { ReversePowerRuleExplorer } from "./ReversePowerRuleExplorer";
import { RichText } from "../widgets/MathBlock";
import { Icon } from "../common/Icon";

interface ConceptSandboxProps {
  sandbox: Sandbox;
}

/** The riemann sandbox body: drag rectangles under a DIFFERENT curve, ungraded. */
function RiemannSandboxBody({ spec }: { spec: RiemannAnswer }) {
  const [n, setN] = useState(1);
  return <RiemannInput spec={spec} value={n} onChange={setN} />;
}

/**
 * The ftc sandbox body: drag the two limits of a definite integral on a DIFFERENT
 * curve and watch the signed area between them update — ungraded, so nothing is
 * checked or revealed.
 */
function FtcSandboxBody({ spec }: { spec: IntegralBoundsAnswer }) {
  const [bounds, setBounds] = useState<{ a: number; b: number }>({
    a: spec.a,
    b: spec.b,
  });
  return <IntegralBoundsInput spec={spec} value={bounds} onChange={setBounds} />;
}

/**
 * An ungraded, collapsible "concept sandbox" shown in the "hints" assistance
 * level: a self-contained explorer on a DIFFERENT example than the graded
 * question, with the readout the question hides switched on. The learner expands
 * it, experiments to feel the mechanic, then answers the real question
 * themselves.
 *
 * It owns all of its state and shares nothing with the graded widget, so it can
 * teach the move without ever revealing — or being driven by — this question's
 * answer. Several presets render different explorers (slope point, derivative
 * overlay, power-rule and reverse-power-rule drops, Riemann rectangles, area
 * accumulation, and definite-integral bounds); see {@link sandboxKind}. Mount it
 * with a `key` tied to the step so it collapses and resets when the learner moves
 * on.
 */
export function ConceptSandbox({ sandbox }: ConceptSandboxProps) {
  const kind = sandboxKind(sandbox);
  const [open, setOpen] = useState(false);

  // Nothing renders if the sandbox is misauthored for its preset.
  if (!kind) return null;

  if (!open) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition"
        >
          <Icon name="wrench" className="h-4 w-4" />
          Experiment with this idea
        </button>
        <p className="mt-2 text-xs text-indigo-700/70">
          Try the idea on a different example — it won't give away this answer.
        </p>
      </div>
    );
  }

  let body: ReactNode = null;
  if (kind === "graph") {
    const graph = buildSandboxGraph(sandbox);
    // Uncontrolled: the widget owns its own point so the sandbox shares no state
    // with the graded question.
    if (graph) body = <GraphWidget config={graph} exploreDrag={graph.explore === true} />;
  } else if (kind === "shape") {
    const graph = buildSandboxShape(sandbox);
    if (graph) body = <GraphWidget config={graph} exploreDrag={graph.explore === true} />;
  } else if (kind === "area") {
    const graph = buildSandboxArea(sandbox);
    if (graph) body = <GraphWidget config={graph} exploreDrag={graph.explore === true} />;
  } else if (kind === "ftc") {
    const spec = buildSandboxFtc(sandbox);
    if (spec) body = <FtcSandboxBody spec={spec} />;
  } else if (kind === "power_rule") {
    body = <PowerRuleExplorer />;
  } else if (kind === "reverse_power_rule") {
    body = <ReversePowerRuleExplorer />;
  } else if (kind === "riemann") {
    const spec = buildSandboxRiemann(sandbox);
    if (spec) body = <RiemannSandboxBody spec={spec} />;
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
          <Icon name="wrench" className="h-4 w-4" />
          Sandbox — a different example
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-[0.98] transition"
        >
          Hide
        </button>
      </div>
      {sandbox.caption && (
        <p className="mb-3 text-sm text-slate-700">
          <RichText text={sandbox.caption} />
        </p>
      )}
      {body}
    </div>
  );
}
