"use client";

import clsx from "clsx";
import type { PipelineStageState } from "@/lib/discover/discover-card-state";

type DiscoverProofPipelineProps = {
  stages: PipelineStageState[];
  className?: string;
};

/** Read-only status strip — not clickable; actions live in DiscoverActionBar. */
export function DiscoverProofPipeline({ stages, className }: DiscoverProofPipelineProps) {
  if (!stages.length) return null;

  return (
    <div
      className={clsx("flex flex-wrap items-center gap-1.5", className)}
      aria-label="Settlement progress"
      role="list"
    >
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-1.5" role="listitem">
          {index > 0 && (
            <span className="text-[10px] text-resolve-muted-dim/60" aria-hidden>
              →
            </span>
          )}
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 text-[10px]",
              stage.done ? "text-emerald-300/90" : stage.active ? "text-amber-100/90" : "text-resolve-muted-dim",
            )}
          >
            <span className="font-medium">{stage.label}</span>
            <span
              className={clsx(
                "rounded px-1.5 py-0.5 font-normal",
                stage.done
                  ? "bg-emerald-500/10"
                  : stage.active
                    ? "bg-amber-500/10"
                    : "bg-white/[0.04]",
              )}
            >
              {stage.status}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
