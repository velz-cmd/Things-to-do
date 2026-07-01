"use client";

import clsx from "clsx";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export type DiscoverWorkspaceLane = "gaps" | "radars" | "board" | "signals" | "earn";

const LANES: { id: DiscoverWorkspaceLane; label: string; roles: DiscoverRole[] | "all" }[] = [
  { id: "gaps", label: "Gaps", roles: "all" },
  { id: "radars", label: "Radars", roles: ["community", "founder", "operator", "dao", "all"] },
  { id: "board", label: "Board", roles: ["funder", "founder", "dao", "all"] },
  { id: "signals", label: "Signals", roles: ["founder", "operator", "funder", "all"] },
  { id: "earn", label: "Earnings", roles: ["community", "all"] },
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
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-resolve-border/50 bg-black/20 p-1"
      aria-label="Discover workspace"
    >
      {visible.map((item) => {
        const active = lane === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onLaneChange(item.id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-[11px] font-medium transition",
              active
                ? "bg-resolve-accent/20 text-white ring-1 ring-resolve-accent/30"
                : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
