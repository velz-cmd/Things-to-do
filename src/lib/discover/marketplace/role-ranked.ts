import {
  inferPrimaryRole,
  rankForRole,
  type DiscoverRole,
  type RankableItem,
} from "@/lib/discover/impact/role-ranking";
import type { MarketplaceOpportunity } from "./contracts";

/**
 * Applies role-aware ordering to the canonical marketplace.
 *
 * This is ordering only. Every item the projection produced is still present
 * afterwards - a wrong role guess can change what leads, never what exists.
 */

/** Actions that inspect rather than move the economy forward. */
const PASSIVE_ACTION_IDS = new Set([
  "discover.open_evidence",
  "discover.open_program",
  "discover.view_request",
]);

function rankableFrom(
  item: MarketplaceOpportunity,
  viewerUserId?: string,
): RankableItem {
  const primary = item.primaryAction;
  const actionable = Boolean(
    primary && primary.enabled !== false && !PASSIVE_ACTION_IDS.has(primary.id),
  );
  const isSelf = Boolean(viewerUserId && item.creator.id === viewerUserId);

  return {
    id: item.id,
    actionable,
    hasSourcedImpact: item.impactProfile?.measurable === true,
    hasFundingIntent: Boolean(item.economicMatch?.eligible.length),
    uncovered: (item.economicMatch?.coverage.length ?? 0) === 0,
    // Only the owner of a blocked record can clear it.
    needsViewerResolution: isSelf && Boolean(item.entityState?.blocker),
    earnable: isSelf,
    updatedAt: item.updatedAt,
  };
}

export function viewerRole(input: {
  operatesPools: boolean;
  hasSpendableCapital: boolean;
  hasPayoutDestination: boolean;
}): DiscoverRole {
  return inferPrimaryRole(input);
}

export function rankOpportunitiesForViewer(
  opportunities: MarketplaceOpportunity[],
  role: DiscoverRole,
  viewerUserId?: string,
): MarketplaceOpportunity[] {
  const ranked = rankForRole(
    opportunities.map((item) => ({
      ...rankableFrom(item, viewerUserId),
      opportunity: item,
    })),
    role,
  );
  return ranked.map((entry) => entry.opportunity);
}
