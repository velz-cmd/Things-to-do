"use client";

import clsx from "clsx";
import {
  computePoolMilestoneSegment,
  formatMilestoneUsd,
  type PoolMilestoneSegment,
} from "@/lib/capital/pool-milestone-progress";

type PoolMilestoneBarProps = {
  poolUsd: number;
  segment?: PoolMilestoneSegment;
  compact?: boolean;
  className?: string;
};

/** Milestone progress — active segment (e.g. $0→$500, then $500→$2.5k) with pool USD centered on bar. */
export function PoolMilestoneBar({
  poolUsd,
  segment,
  compact = false,
  className,
}: PoolMilestoneBarProps) {
  const seg = segment ?? computePoolMilestoneSegment(poolUsd);
  const complete = seg.progressPct >= 100 && seg.poolUsd >= seg.ceilingUsd;

  return (
    <div className={clsx("mt-3", className)} data-testid="pool-milestone-bar">
      <div className="flex items-center justify-between gap-2 text-[10px] text-resolve-muted-dim">
        <span>{complete ? "Checkpoint reached" : "Pool milestone"}</span>
        <span className="tabular-nums">
          {formatMilestoneUsd(seg.floorUsd)} → {formatMilestoneUsd(seg.ceilingUsd)}
        </span>
      </div>

      <div className="relative mt-2">
        <div
          className={clsx(
            "overflow-hidden rounded-full bg-white/[0.06]",
            compact ? "h-1.5" : "h-2.5",
          )}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-resolve-accent/85 to-emerald-400/85 transition-all duration-500"
            style={{ width: `${seg.progressPct}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={clsx(
              "rounded-full border border-white/10 bg-black/70 px-2 py-0.5 font-semibold tabular-nums text-white shadow-sm",
              compact ? "text-[9px]" : "text-[10px]",
            )}
          >
            ${seg.labelUsd.toFixed(seg.labelUsd >= 100 ? 0 : 2)}
          </span>
        </div>
      </div>

      <div className="mt-1 flex justify-between text-[9px] tabular-nums text-resolve-muted-dim">
        <span>{formatMilestoneUsd(seg.floorUsd)}</span>
        <span>{seg.progressPct}%</span>
        <span>{formatMilestoneUsd(seg.ceilingUsd)}</span>
      </div>
    </div>
  );
}
