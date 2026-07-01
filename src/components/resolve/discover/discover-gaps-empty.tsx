"use client";

import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { gapsPrimaryActions, gapsRoleIntro } from "@/lib/discover/gaps-empty-state";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { DiscoverStatePanel } from "@/components/resolve/discover/discover-state-panel";

export function DiscoverGapsEmpty({
  needType,
  role,
  signedIn,
  degraded: _degraded,
}: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  signedIn: boolean;
  degraded?: boolean;
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
    </DiscoverStatePanel>
  );
}
