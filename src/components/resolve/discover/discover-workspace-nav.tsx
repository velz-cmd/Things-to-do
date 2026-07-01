"use client";

import clsx from "clsx";
import { Activity, Coins, LayoutGrid, Radar, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export type DiscoverWorkspaceLane = "gaps" | "radars" | "board" | "signals" | "earn";

const LANES: {
  id: DiscoverWorkspaceLane;
  label: string;
  icon: LucideIcon;
  roles: DiscoverRole[] | "all";
}[] = [
  { id: "gaps", label: "Gaps", icon: Zap, roles: "all" },
  { id: "radars", label: "Radars", icon: Radar, roles: ["community", "founder", "operator", "dao", "all"] },
  { id: "board", label: "Board", icon: LayoutGrid, roles: ["funder", "founder", "dao", "all"] },
  { id: "signals", label: "Signals", icon: Activity, roles: ["founder", "operator", "funder", "all"] },
  { id: "earn", label: "Earnings", icon: Coins, roles: ["community", "all"] },
];

const JOB_LANE: Record<DiscoverJobId, DiscoverWorkspaceLane> = {
  earn: "earn",
  fund: "board",
  run: "signals",
  observe: "signals",
  grants: "radars",
  find: "board",
};

export function laneForJob(jobId: DiscoverJobId | null): DiscoverWorkspaceLane {
  if (!jobId) return "gaps";
  return JOB_LANE[jobId];
}

export function DiscoverWorkspaceNav({
  lane,
  role,
  onLaneChange,
}: {
  lane: DiscoverWorkspaceLane;
  role: DiscoverRole;
  onLaneChange: (lane: DiscoverWorkspaceLane) => void;
}) {
  const visible = LANES.filter((item) => {
    if (item.roles === "all") return true;
    return item.roles.includes(role) || role === "all";
  });

  return (
    <nav className="discover-workspace-nav" aria-label="Discover workspace">
      {visible.map((item) => {
        const active = lane === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onLaneChange(item.id)}
            className={clsx(
              "discover-workspace-tab",
              `discover-workspace-tab--${item.id}`,
              active && "discover-workspace-tab--active",
            )}
          >
            <Icon className="discover-workspace-tab__icon" strokeWidth={1.75} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
