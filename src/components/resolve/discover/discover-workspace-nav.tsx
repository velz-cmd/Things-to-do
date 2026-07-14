"use client";

import clsx from "clsx";
import { LayoutGrid, Radar, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import { WORKSPACE_LANE_LABELS } from "@/lib/discover/discover-lane-copy";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import styles from "./discover-workspace.module.css";

export type DiscoverWorkspaceLane = "gaps" | "radars" | "board";

export function defaultLaneForRole(role: DiscoverRole): DiscoverWorkspaceLane {
  switch (role) {
    case "community":
      return "gaps";
    case "funder":
    case "founder":
      return "board";
    case "operator":
    case "dao":
      return "radars";
    default:
      return "gaps";
  }
}

const LANES: {
  id: DiscoverWorkspaceLane;
  label: string;
  icon: LucideIcon;
  accent: "amber" | "violet" | "blue";
}[] = [
  { id: "gaps", label: WORKSPACE_LANE_LABELS.gaps, icon: Zap, accent: "amber" },
  { id: "radars", label: WORKSPACE_LANE_LABELS.radars, icon: Radar, accent: "violet" },
  { id: "board", label: WORKSPACE_LANE_LABELS.board, icon: LayoutGrid, accent: "blue" },
];

const JOB_LANE: Record<DiscoverJobId, DiscoverWorkspaceLane> = {
  earn: "gaps",
  fund: "board",
  run: "gaps",
  automate: "radars",
  grants: "radars",
  find: "gaps",
};

export function laneForJob(jobId: DiscoverJobId | null): DiscoverWorkspaceLane {
  if (!jobId) return "gaps";
  return JOB_LANE[jobId];
}

export function DiscoverWorkspaceNav({
  lane,
  onLaneChange,
  children,
}: {
  lane: DiscoverWorkspaceLane;
  onLaneChange: (lane: DiscoverWorkspaceLane) => void;
  children?: ReactNode;
}) {
  return (
    <DiscoverCapitalCard
      as="nav"
      className={clsx("discover-workspace-nav", styles.workspaceController)}
      padding={false}
      hover={false}
      ariaLabel="Discover workspace"
    >
      <div className={styles.workspaceControllerInner}>
        <div className={styles.workspaceTabs} role="tablist" aria-label="Discover workspaces">
          {LANES.map((item) => {
            const active = lane === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onLaneChange(item.id)}
                className={clsx(
                  styles.workspaceTab,
                  item.id === "gaps" && styles.workspaceTabUnpaid,
                  item.id === "radars" && styles.workspaceTabSignals,
                  item.id === "board" && styles.workspaceTabFund,
                  active && styles.workspaceTabActive,
                )}
              >
                <Icon strokeWidth={1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <span className={styles.workspaceLabel}>Workspace controller</span>
      </div>
      {children && <div className={styles.filterRow}>{children}</div>}
    </DiscoverCapitalCard>
  );
}
