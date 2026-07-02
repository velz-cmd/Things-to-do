"use client";

import clsx from "clsx";
import { LayoutGrid, Radar, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import type { DiscoverRole } from "@/lib/discover/role-filters";

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
  { id: "gaps", label: "Gaps", icon: Zap, accent: "amber" },
  { id: "radars", label: "Radars", icon: Radar, accent: "violet" },
  { id: "board", label: "Board", icon: LayoutGrid, accent: "blue" },
];

const JOB_LANE: Record<DiscoverJobId, DiscoverWorkspaceLane> = {
  earn: "gaps",
  fund: "board",
  run: "board",
  observe: "radars",
  grants: "radars",
  find: "board",
};

export function laneForJob(jobId: DiscoverJobId | null): DiscoverWorkspaceLane {
  if (!jobId) return "gaps";
  return JOB_LANE[jobId];
}

export function DiscoverWorkspaceNav({
  lane,
  onLaneChange,
}: {
  lane: DiscoverWorkspaceLane;
  onLaneChange: (lane: DiscoverWorkspaceLane) => void;
}) {
  return (
    <DiscoverCapitalCard
      as="nav"
      className="discover-workspace-nav"
      padding={false}
      hover={false}
      ariaLabel="Discover workspace"
    >
      <div className="flex flex-wrap gap-1 p-1.5">
        {LANES.map((item) => {
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
      </div>
    </DiscoverCapitalCard>
  );
}
