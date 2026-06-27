import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";

export async function buildWorkbenchSnapshot(userId: string) {
  const [evidence, connectors, treasury, ledger, integrations] = await Promise.all([
    gatherWorkspaceEvidence(),
    getConnectorLiveStatuses().catch(() => []),
    getTreasurySnapshot(),
    getGlobalAuthorizationSummary().catch(() => null),
    runIntegrationHealthCheck().catch(() => null),
  ]);

  return {
    userId,
    gatheredAt: new Date().toISOString(),
    treasury: {
      balanceUsd: treasury.balanceUsd,
      obligationsUsd: treasury.obligationsUsd,
      canSettleGlobally: treasury.canSettleGlobally,
      blockers: treasury.blockers,
    },
    ledger: ledger
      ? {
          count: ledger.count,
          claimableUsd: ledger.claimableUsd,
          pendingFundingUsd: ledger.pendingFundingUsd,
          settledUsd: ledger.settledUsd,
        }
      : null,
    connectors: connectors.map((c) => ({
      id: c.id,
      health: c.health,
      eventsToday: c.eventsToday,
      authorizationCount: c.authorizationCount,
      connectHref: "/profile",
    })),
    integrations: integrations
      ? {
          configured: integrations.configured,
          live: integrations.live,
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
