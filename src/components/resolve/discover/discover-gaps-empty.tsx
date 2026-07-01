"use client";

import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { gapsPrimaryActions, gapsRoleIntro } from "@/lib/discover/gaps-empty-state";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { DiscoverStatePanel } from "@/components/resolve/discover/discover-state-panel";

import type { DiscoverWorkspaceLane } from "@/components/resolve/discover/discover-workspace-nav";

export function DiscoverGapsEmpty({
  needType,
  role,
  signedIn,
  degraded: _degraded,
  onSwitchLane,
}: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  signedIn: boolean;
  degraded?: boolean;
  onSwitchLane?: (lane: DiscoverWorkspaceLane) => void;
}) {
  const actions = gapsPrimaryActions({ needType, role });

  return (
    <DiscoverStatePanel variant="empty">
      <p className="text-sm leading-relaxed text-resolve-muted">{gapsRoleIntro(role)}</p>

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <DiscoverActionChip
              key={`${action.id}-${action.communitySlug ?? index}`}
              action={action}
              signedIn={signedIn}
              primary={index === 0}
              surface="gaps-empty"
            />
          ))}
        </div>
      )}

      {onSwitchLane && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSwitchLane("board")}
            className="rounded-lg border border-resolve-calm-blue/30 bg-resolve-calm-blue/10 px-3 py-1.5 text-[11px] font-medium text-resolve-calm-blue hover:bg-resolve-calm-blue/15"
          >
            Open Board → attach
          </button>
          <button
            type="button"
            onClick={() => onSwitchLane("radars")}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-resolve-muted hover:text-white"
          >
            Browse Radars
          </button>
        </div>
      )}
    </DiscoverStatePanel>
  );
}
