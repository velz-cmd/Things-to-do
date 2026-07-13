"use client";

import { ChevronDown } from "lucide-react";
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
    <label className="mission-mode-select" title="Choose how Mission should frame the decision">
      <span className="sr-only">Mission mode</span>
      <select
        value={normalizedRole(active)}
        onChange={(event) => onChange(event.target.value as OperatingMode)}
        disabled={disabled}
      >
        {MISSION_ROLES.map((mode) => (
          <option key={mode.id} value={mode.id} title={mode.description}>
            {mode.label}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
    </label>
  );
}
