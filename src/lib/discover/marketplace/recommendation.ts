import type {
  DiscoverPageData,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import {
  discoverNavigationAction,
  workbenchAction,
} from "@/lib/discover/marketplace/action-contract";
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
      primaryAction: workbenchAction(
        { id: "source.reconnect", label: "Repair GitHub access", href: "/discover?view=for_you" },
        { panel: "source_sync", subjectId: "github", provider: "github" },
      ),
      secondaryActions: [],
    };
  }
  if (
    readiness &&
    ["connected", "syncing", "stale"].includes(readiness.github.personal.state) &&
    readiness.wallets.payout.state !== "connected"
  ) {
    const eligibleWallets = [readiness.wallets.app, readiness.wallets.connected]
      .filter((wallet) => Boolean(wallet.address) && ["connected", "stale"].includes(wallet.state));
    return {
      id: "complete-payout",
      title: "Complete payout readiness",
      reason: eligibleWallets.length >= 2
        ? "Two eligible wallets are available. Choose one payout destination."
        : "Your GitHub identity is connected, but verified work cannot settle to you until one eligible wallet is chosen.",
      state: readiness.wallets.payout.state,
      primaryAction: workbenchAction(
        { id: "profile.set_payout_destination", label: "Choose payout wallet", href: "/discover?view=for_you" },
        { panel: "payout_destination", subjectId: readiness.userId },
      ),
      secondaryActions: [discoverNavigationAction(
        { id: "discover.open_verified_work", label: "View recognised work", href: "/discover?view=explore&kind=work" },
        { secondary: true },
      )],
    };
  }
  if (readiness && readiness.capital.pendingAuthorizations > 0) {
    return {
      id: "review-authorizations",
      title: "Review funding awaiting authorization",
      reason: `${readiness.capital.pendingAuthorizations} persisted funding package${readiness.capital.pendingAuthorizations === 1 ? " is" : "s are"} ready for financial review.`,
      state: "awaiting_authorization",
      primaryAction: workbenchAction(
        { id: "capital.review_authorization", label: "Review authorization", href: "/discover?view=for_you" },
        { panel: "authorization_review", subjectId: "pending-authorizations" },
        { requiresConfirmation: true },
      ),
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
      primaryAction: shortfall.primaryAction ?? discoverNavigationAction({
        id: "discover.open_pools",
        label: "Inspect Pool",
        href: `/discover?view=explore&kind=pools&pool=${encodeURIComponent(shortfall.id)}`,
      }),
      secondaryActions: [discoverNavigationAction(
        { id: "discover.open_record", label: "View details", href: `/opportunities/${shortfall.slug}` },
        { target: "workspace", secondary: true },
      )],
    };
  }
  const publicOpportunity = opportunities[0];
  if (publicOpportunity) {
    return {
      id: `public-opportunity:${publicOpportunity.id}`,
      title: publicOpportunity.title,
      reason: "This is the newest published opportunity with an inspectable source.",
      state: publicOpportunity.verificationStatus,
      primaryAction: publicOpportunity.primaryAction ?? workbenchAction({
        id: "discover.open_evidence",
        label: "Inspect opportunity",
        href: `/discover?view=for_you&action=discover.open_evidence&subject=${encodeURIComponent(publicOpportunity.source.id)}`,
      }, {
        panel: "evidence",
        subjectId: publicOpportunity.source.id,
        sourceUrl: publicOpportunity.sourceUrl,
        repository: publicOpportunity.repository,
        evidenceIds: [publicOpportunity.source.id],
      }),
      secondaryActions: [],
    };
  }
  return {
    id: "no-immediate-action",
    title: "Analyze public repository activity",
    reason: "No persisted action is ready, but any public GitHub repository can be inspected without connecting an account.",
    state: "current",
    primaryAction: discoverNavigationAction({
      id: "discover.open_public_repository_analysis",
      label: "Analyze a repository",
      href: "/discover?view=explore#public-repository-analysis",
    }),
    secondaryActions: [],
  };
}
