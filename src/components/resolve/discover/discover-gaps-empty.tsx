"use client";

import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import {
  GAPS_TAB_EXAMPLES,
  GAPS_TAB_INTRO,
  gapsEmptyMessage,
  gapsExploreActions,
  gapsExploreCommunities,
} from "@/lib/discover/gaps-empty-state";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { DiscoverStatePanel } from "@/components/resolve/discover/discover-state-panel";

export function DiscoverGapsEmpty({
  needType,
  role,
  signedIn,
  degraded,
}: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  signedIn: boolean;
  degraded?: boolean;
}) {
  const communities = gapsExploreCommunities({ needType, role });
  const actions = gapsExploreActions({ needType, role });

  return (
    <DiscoverStatePanel variant="empty">
      <p className="text-sm leading-relaxed text-resolve-muted">{GAPS_TAB_INTRO}</p>

      <ul className="mt-3 space-y-1.5">
        {GAPS_TAB_EXAMPLES.map((example) => (
          <li key={example} className="flex items-start gap-2 text-[11px] text-white/80">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-resolve-accent" />
            {example}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-resolve-muted">{gapsEmptyMessage(needType)}</p>

      {degraded && (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Some rankings were slow — community previews below are still available.
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {communities.map((entry) => (
          <div
            key={entry.slug}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
          >
            <p className="text-xs font-medium text-white">{entry.name}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-resolve-muted-dim">
              {entry.tagline}
            </p>
            <p className="mt-1 text-[10px] text-resolve-muted-dim">{entry.upstream}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <DiscoverActionChip
            key={action.id}
            action={action}
            signedIn={signedIn}
            surface="gaps-preview"
          />
        ))}
      </div>
    </DiscoverStatePanel>
  );
}
