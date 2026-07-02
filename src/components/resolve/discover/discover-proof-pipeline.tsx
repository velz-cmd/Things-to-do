"use client";

import clsx from "clsx";
import type { PipelineStageState } from "@/lib/discover/discover-card-state";

type DiscoverProofPipelineProps = {
  stages: PipelineStageState[];
  className?: string;
  onStageClick?: (stage: PipelineStageState) => void;
};

/** Extract → Rule → Settle with real states — clickable when an action is available. */
export function DiscoverProofPipeline({
  stages,
  className,
  onStageClick,
}: DiscoverProofPipelineProps) {
  if (!stages.length) return null;

  return (
    <div
      className={clsx("flex flex-wrap items-center gap-1", className)}
      aria-label="Value proof pipeline"
    >
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-1">
          {index > 0 && <span className="text-[8px] text-resolve-muted-dim/80">→</span>}
          <button
            type="button"
            disabled={!onStageClick}
            onClick={() => onStageClick?.(stage)}
            className={clsx(
              "rounded-full border px-2 py-0.5 text-[9px] font-medium tabular-nums transition",
              stage.done
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : stage.active
                  ? "border-amber-500/25 bg-amber-500/8 text-amber-100/90"
                  : "border-white/[0.08] bg-white/[0.02] text-resolve-muted-dim",
              onStageClick && stage.active && "hover:border-amber-400/40",
            )}
            title={`${stage.label}: ${stage.status}`}
          >
            {stage.label}
            <span className="ml-1 opacity-80">{stage.status}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
