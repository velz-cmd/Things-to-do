"use client";

import clsx from "clsx";
import { Activity, Coins, LayoutGrid, Radar, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export type DiscoverWorkspaceLane = "gaps" | "radars" | "board" | "signals" | "earn";

const ROLE_LANES: Record<DiscoverRole, DiscoverWorkspaceLane[] | "all"> = {
  community: ["earn", "gaps"],
  funder: ["gaps", "board", "radars"],
  founder: ["signals", "radars", "gaps"],
  operator: ["signals", "radars"],
  dao: ["radars", "board", "gaps"],
  all: "all",
};

export function laneVisibleForRole(lane: DiscoverWorkspaceLane, role: DiscoverRole): boolean {
  if (role === "all") return true;
  const allowed = ROLE_LANES[role];
  if (allowed === "all") return true;
  return allowed.includes(lane);
}

export function defaultLaneForRole(role: DiscoverRole): DiscoverWorkspaceLane {
  if (role === "community") return "earn";
  if (role === "funder") return "gaps";
  if (role === "founder" || role === "operator") return "signals";
  if (role === "dao") return "radars";
  return "gaps";
}

const LANES: {
  id: DiscoverWorkspaceLane;
  label: string;
  icon: LucideIcon;
  accent: "amber" | "violet" | "blue" | "teal" | "emerald";
}[] = [
  { id: "gaps", label: "Gaps", icon: Zap, accent: "amber" },
  { id: "radars", label: "Radars", icon: Radar, accent: "violet" },
  { id: "board", label: "Board", icon: LayoutGrid, accent: "blue" },
  { id: "signals", label: "Signals", icon: Activity, accent: "teal" },
  { id: "earn", label: "Earnings", icon: Coins, accent: "emerald" },
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
  role = "all",
  onLaneChange,
}: {
  lane: DiscoverWorkspaceLane;
  role?: DiscoverRole;
  onLaneChange: (lane: DiscoverWorkspaceLane) => void;
}) {
  const visible = LANES.filter((item) => laneVisibleForRole(item.id, role));

  return (
    <DiscoverCapitalCard
      as="nav"
      className="discover-workspace-nav"
      padding={false}
      hover={false}
      ariaLabel="Discover workspace"
    >
      <div className="flex flex-wrap gap-1 p-1.5">
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
      </div>
    </DiscoverCapitalCard>
  );
}
