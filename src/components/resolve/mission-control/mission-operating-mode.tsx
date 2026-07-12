"use client";

import clsx from "clsx";
import type { OperatingMode } from "@/lib/mission/capital-os";

const MISSION_ROLES: Array<{ id: OperatingMode; label: string; description: string }> = [
  { id: "creator", label: "Creator", description: "Royalties, usage, income, and linked work" },
  { id: "dao", label: "Funder", description: "Policies, programs, and treasury decisions" },
  { id: "founder", label: "Operator", description: "Budgets, distribution, and settlement" },
  { id: "research", label: "Agent", description: "Evidence, reports, and paid signals" },
];

function normalizedRole(active: OperatingMode): OperatingMode {
  if (active === "maintainer") return "creator";
  if (active === "community_manager") return "founder";
  return active;
}

export function MissionOperatingMode({
  active,
  onChange,
  disabled,
}: {
  active: OperatingMode;
  onChange: (mode: OperatingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-resolve-muted-dim">Mode</span>
      {MISSION_ROLES.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          title={m.description}
          onClick={() => onChange(m.id)}
          className={clsx(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition disabled:opacity-40",
            normalizedRole(active) === m.id ?
              "border-violet-500/40 bg-violet-500/15 text-violet-200"
            : "border-white/[0.08] text-resolve-muted hover:border-white/20 hover:text-white",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
