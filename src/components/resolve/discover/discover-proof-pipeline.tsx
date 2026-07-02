"use client";

import clsx from "clsx";
import type { UnpaidValueMetrics } from "@/lib/discover/community-value-profiles";

type DiscoverProofPipelineProps = {
  metrics?: UnpaidValueMetrics;
  connected?: boolean;
  amountVerified?: boolean;
  className?: string;
};

const STAGES = [
  { id: "extract", label: "Extract" },
  { id: "rule", label: "Rule" },
  { id: "settle", label: "Settle" },
] as const;

/** Compact proof strip — shows where value is in the loop without explanatory copy. */
export function DiscoverProofPipeline({
  metrics,
  connected = false,
  amountVerified = false,
  className,
}: DiscoverProofPipelineProps) {
  if (!metrics) return null;

  const extracted =
    connected ||
    amountVerified ||
    (!metrics.observedEvents.toLowerCase().includes("await") &&
      !metrics.observedEvents.toLowerCase().includes("0 "));
  const ruled = !metrics.payoutRules.includes("0");
  const settled = metrics.settlement !== "Not active";

  const done = [extracted, ruled, settled];

  return (
    <div
      className={clsx("flex flex-wrap items-center gap-1", className)}
      aria-label="Value proof pipeline"
    >
      {STAGES.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-1">
          {index > 0 && <span className="text-[8px] text-resolve-muted-dim/80">→</span>}
          <span
            className={clsx(
              "rounded-full border px-2 py-0.5 text-[9px] font-medium tabular-nums",
              done[index]
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : index === 0 || done[index - 1]
                  ? "border-amber-500/25 bg-amber-500/8 text-amber-100/90"
                  : "border-white/[0.08] bg-white/[0.02] text-resolve-muted-dim",
            )}
          >
            {stage.label}
          </span>
        </div>
      ))}
    </div>
  );
}
