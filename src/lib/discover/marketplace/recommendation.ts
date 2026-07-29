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
        label: "Open integration settings",
        href: "/communities?view=integrations&source=github",
      },
      secondaryActions: [{ label: "View Profile", href: "/profile?view=sources" }],
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
        label: "Add payout destination",
        href: "/profile?view=wallets&returnTo=/discover",
      },
      secondaryActions: [{ label: "View recognised work", href: "/earn" }],
    };
  }
  if (readiness && readiness.capital.pendingAuthorizations > 0) {
    return {
      id: "review-authorizations",
      title: "Review funding awaiting authorization",
      reason: `${readiness.capital.pendingAuthorizations} persisted funding package${readiness.capital.pendingAuthorizations === 1 ? " is" : "s are"} ready for financial review.`,
      state: "awaiting_authorization",
      primaryAction: { label: "Open Capital", href: "/capital?view=authorizations" },
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
        label: "Inspect Pool",
        href: `/opportunities/${shortfall.slug}?intent=back-pool`,
      },
      secondaryActions: [
        { label: "View rule", href: `/opportunities/${shortfall.slug}#distribution-rule` },
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
        label: "Inspect opportunity",
        href: `/opportunities/${publicOpportunity.slug}`,
      },
      secondaryActions: [],
    };
  }
  return {
    id: "no-immediate-action",
    title: "No immediate funding action",
    reason: "No eligible public opportunity is available from the confirmed sources.",
    state: "current",
    primaryAction: { label: "Connect my community", href: "/communities" },
    secondaryActions: [],
  };
}
