"use client";

import clsx from "clsx";
import {
  computePoolMilestoneSegment,
  formatMilestoneUsd,
  type PoolMilestoneSegment,
} from "@/lib/capital/pool-milestone-progress";
import styles from "./discover-workspace.module.css";

type PoolMilestoneBarProps = {
  poolUsd: number;
  segment?: PoolMilestoneSegment;
  compact?: boolean;
  className?: string;
};

/** One consistent milestone presentation driven only by the real pool segment. */
export function PoolMilestoneBar({
  poolUsd,
  segment,
  compact: _compact = false,
  className,
}: PoolMilestoneBarProps) {
  const seg = segment ?? computePoolMilestoneSegment(poolUsd);
  const complete = seg.progressPct >= 100 && seg.poolUsd >= seg.ceilingUsd;
  const remaining = Math.max(0, seg.ceilingUsd - seg.poolUsd);

  return (
    <div className={clsx(styles.progressBlock, className)} data-testid="pool-milestone-bar">
      <div className={styles.progressHeader}>
        <span>{complete ? "Checkpoint reached" : "Pool milestone"}</span>
        <span className="tabular-nums">
          {formatMilestoneUsd(seg.poolUsd)} / {formatMilestoneUsd(seg.ceilingUsd)}
        </span>
      </div>
      <div className={styles.progressTrack}>
        <span
          className={clsx(styles.progressFill, complete && styles.progressFillComplete)}
          style={{ transform: `scaleX(${Math.min(1, Math.max(0, seg.progressPct / 100))})` }}
        />
      </div>
      <div className={styles.progressDetail}>
        <span>{seg.progressPct}% funded</span>
        <span className="tabular-nums">
          {complete ? "Ready for checkpoint" : `${formatMilestoneUsd(remaining)} remaining`}
        </span>
      </div>
    </div>
  );
}
