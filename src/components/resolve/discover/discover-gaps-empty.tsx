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

      {role === "community" ? (
        <p className="mt-3 text-[11px] text-resolve-muted-dim">
          Gaps is for funders fulfilling authorizations. Your lane is{" "}
          <span className="text-white">Earnings</span>.
        </p>
      ) : role === "all" ? (
        <p className="mt-3 text-[11px] font-medium text-amber-200/90">
          Select a job pill above first — Fund, Earn, Run my community, etc.
        </p>
      ) : null}

      {actions.length > 0 && role !== "community" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <DiscoverActionChip
              key={action.id}
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
