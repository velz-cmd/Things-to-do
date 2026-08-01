import type {
  DiscoverPageData,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import type { WorkspaceReadiness } from "@/lib/workspace/readiness-contract";

export function selectDiscoverRecommendation(
  readiness: WorkspaceReadiness | null,
  opportunities: MarketplaceOpportunity[],
): DiscoverPageData["recommendation"] {
  if (
    readiness &&
    ["sync_failed", "permission_missing", "revoked"].includes(
      readiness.github.repositorySync.state,
    )
  ) {
    return {
      id: "repair-repository-sync",
      title: "Repair repository access",
      reason: "An installed GitHub source is blocking current community operations.",
      state: readiness.github.repositorySync.state,
      primaryAction: {
        id: "profile.manage_connections",
        label: "Open integration settings",
        href: "/profile?section=connections&source=github&returnTo=/discover",
      },
      secondaryActions: [{ id: "profile.open_source_details", label: "View Profile", href: "/profile?view=sources" }],
    };
  }
  if (
    readiness &&
    ["connected", "syncing", "stale"].includes(readiness.github.personal.state) &&
    readiness.wallets.payout.state !== "connected"
  ) {
    return {
      id: "complete-payout",
      title: "Complete payout readiness",
      reason: "Your GitHub identity is connected, but verified work cannot settle to you yet.",
      state: readiness.wallets.payout.state,
      primaryAction: {
        id: "discover.resolve_identity",
        label: "Add payout destination",
        href: "/profile?view=wallets&returnTo=/discover",
      },
      secondaryActions: [{ id: "discover.open_verified_work", label: "View recognised work", href: "/discover?view=explore&kind=work" }],
    };
  }
  if (readiness && readiness.capital.pendingAuthorizations > 0) {
    return {
      id: "review-authorizations",
      title: "Review funding awaiting authorization",
      reason: `${readiness.capital.pendingAuthorizations} persisted funding package${readiness.capital.pendingAuthorizations === 1 ? " is" : "s are"} ready for financial review.`,
      state: "awaiting_authorization",
      primaryAction: { id: "capital.review_authorization", label: "Open Capital", href: "/capital?view=authorizations" },
      secondaryActions: [],
    };
  }
  const shortfall = opportunities.find(
    (item) =>
      item.pool &&
      item.funding?.goalAmountUsd != null &&
      (item.funding.fundedAmountUsd ?? 0) < item.funding.goalAmountUsd,
  );
  if (shortfall) {
    return {
      id: `pool-shortfall:${shortfall.id}`,
      title: `Back ${shortfall.pool?.name ?? shortfall.title}`,
      reason: "This published Pool has a real funding target and a confirmed shortfall.",
      state: shortfall.funding?.status ?? "unfunded",
      primaryAction: {
        id: shortfall.primaryAction?.id ?? "discover.open_pools",
        label: shortfall.primaryAction?.label ?? "Inspect Pool",
        href: shortfall.primaryAction?.href ?? `/discover?view=explore&kind=pools&pool=${encodeURIComponent(shortfall.id)}`,
      },
      secondaryActions: [
        { id: "discover.open_record", label: "View details", href: `/opportunities/${shortfall.slug}` },
      ],
    };
  }
  const publicOpportunity = opportunities[0];
  if (publicOpportunity) {
    return {
      id: `public-opportunity:${publicOpportunity.id}`,
      title: publicOpportunity.title,
      reason: "This is the newest published opportunity with an inspectable source.",
      state: publicOpportunity.verificationStatus,
      primaryAction: {
        id: publicOpportunity.primaryAction?.id ?? "discover.open_record",
        label: publicOpportunity.primaryAction?.label ?? "Inspect opportunity",
        href: publicOpportunity.primaryAction?.href ?? `/opportunities/${publicOpportunity.slug}`,
      },
      secondaryActions: [],
    };
  }
  return {
    id: "no-immediate-action",
    title: "Analyze public repository activity",
    reason: "No persisted action is ready, but any public GitHub repository can be inspected without connecting an account.",
    state: "current",
    primaryAction: { id: "discover.open_public_repository_analysis", label: "Analyze a repository", href: "/discover?view=explore#public-repository-analysis" },
    secondaryActions: [],
  };
}
