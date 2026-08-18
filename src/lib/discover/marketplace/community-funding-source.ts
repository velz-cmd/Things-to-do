import {
  fetchCollectiveContributions,
  isOpenCollectiveConfigured,
} from "@/lib/integrations/opencollective";
import { discoverNavigationAction } from "@/lib/discover/marketplace/action-contract";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

/**
 * Real-money-domain outcomes sourced from Open Collective, RESOLVE's own
 * registered fiscal host. Each item is a confirmed contribution that
 * actually happened - not an inference from popularity, and not a policy
 * obligation (RESOLVE's own funded Requests/Pools already cover that path).
 *
 * What this proves: a named contributor sent a specific USD amount to a
 * named recipient account on a specific date, per Open Collective's public
 * transaction ledger.
 * What this does not prove: that the funds were spent on any particular
 * piece of work, or that the amount reflects the recipient's total funding.
 */
const RESOLVE_OPEN_COLLECTIVE_SLUG = "resolve";
const MAX_CONTRIBUTIONS = 20;

export async function loadCommunityFundingSignals(): Promise<
  MarketplaceOpportunity[]
> {
  if (!isOpenCollectiveConfigured()) return [];

  let contributions;
  try {
    contributions = await fetchCollectiveContributions(
      RESOLVE_OPEN_COLLECTIVE_SLUG,
      { limit: MAX_CONTRIBUTIONS },
    );
  } catch {
    return [];
  }

  return contributions.map((c): MarketplaceOpportunity => {
    const recipientUrl = `https://opencollective.com/${c.recipientSlug}`;
    return {
      id: `open-collective:${c.id}`,
      slug: `open-collective-${c.id}`,
      title: `${c.recipientName} received community funding`,
      summary: `${c.contributorName} contributed ${formatUsd(c.amountUsd)} to ${c.recipientName} on Open Collective.`,
      description: `A confirmed Open Collective transaction: ${c.contributorName} funded ${c.recipientName} with ${formatUsd(c.amountUsd)}. This is a real, published contribution record - it does not by itself attribute the funds to any specific piece of work.`,
      type: "grant",
      status: "confirmed",
      creator: {
        type: "community",
        name: c.recipientName,
        verified: true,
      },
      community: { name: c.recipientName },
      skills: [],
      deliverables: [],
      evidenceRequirements: [],
      eligibility: [],
      funding: {
        fundedAmountUsd: c.amountUsd,
        status: "funded",
        source: "open_collective",
        amountState: "confirmed",
      },
      provider: { preference: "open" },
      publishedAt: c.createdAt,
      updatedAt: c.createdAt,
      verificationStatus: "confirmed_external_funding",
      riskFlags: [],
      source: { type: "open_collective_contribution", id: c.id },
      marketplaceKind: "verified_work",
      sourceUrl: `${recipientUrl}/transactions`,
      entityState: {
        provenance: "external_integration",
        lifecycle: "confirmed",
        financialReadiness: "not_applicable",
      },
      primaryAction: discoverNavigationAction(
        {
          id: "discover.open_external_record",
          label: "View on Open Collective",
          href: `${recipientUrl}/transactions`,
        },
        { target: "external", secondary: true },
      ),
      secondaryActions: [],
    };
  });
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
