import { gatherWorkspaceEvidence } from "@/lib/workspace/context";

export async function buildWorkbenchSnapshot(userId: string) {
  const evidence = await gatherWorkspaceEvidence();

  return {
    userId,
    gatheredAt: evidence.gatheredAt,
    treasury: {
      balanceUsd: evidence.treasury.balanceUsd,
      obligationsUsd: evidence.treasury.obligationsUsd,
      canSettleGlobally: evidence.treasury.canSettleGlobally,
      blockers: evidence.treasury.blockers,
    },
    ledger: evidence.ledger
      ? {
          count: evidence.ledger.count,
          claimableUsd: evidence.ledger.claimableUsd,
          pendingFundingUsd: evidence.ledger.pendingFundingUsd,
          settledUsd: evidence.ledger.settledUsd,
        }
      : null,
    connectors: evidence.connectors.map((c) => ({
      id: c.id,
      health: c.health,
      eventsToday: c.eventsToday,
      authorizationCount: c.authorizationCount,
      connectHref: "/profile",
    })),
    integrations: evidence.integrations
      ? {
          configured: evidence.integrations.configured,
          live: evidence.integrations.live,
        }
      : null,
    apis: [
      { id: "github-allocate", label: "GitHub allocation", href: "/api/github/allocate", live: Boolean(process.env.GITHUB_TOKEN) },
      { id: "workspace-ask", label: "Mission reasoning", href: "/api/workspace/ask", live: true },
      { id: "payment-allocation", label: "Settlement", href: "/api/payment/from-allocation", live: true },
      { id: "connectors-live", label: "Sensors", href: "/api/connectors/live", live: true },
      { id: "treasury", label: "Treasury", href: "/api/treasury/snapshot", live: true },
    ],
    opportunities: evidence.opportunities.slice(0, 6).map((o) => ({
      fullName: o.fullName,
      fundingGapUsd: o.health.fundingGapUsd,
      priority: o.priority,
    })),
  };
}
