import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getCapitalFlowSnapshot } from "@/lib/capital-flow/engine";
import { cachedScanAllOpportunities } from "@/lib/github/opportunity-cache";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";
import { domainLabel } from "@/lib/workspace/domains";

/** Real evidence bundle — advisors must only cite this data, never invent. */
export type WorkspaceEvidence = {
  gatheredAt: string;
  treasury: Awaited<ReturnType<typeof getTreasurySnapshot>>;
  ledger: Awaited<ReturnType<typeof getGlobalAuthorizationSummary>> | null;
  capitalFlow: Awaited<ReturnType<typeof getCapitalFlowSnapshot>>;
  connectors: Awaited<ReturnType<typeof getConnectorLiveStatuses>>;
  integrations: Awaited<ReturnType<typeof runIntegrationHealthCheck>>;
  opportunities: Awaited<ReturnType<typeof cachedScanAllOpportunities>>;
};

export async function gatherWorkspaceEvidence(): Promise<WorkspaceEvidence> {
  const [treasury, ledger, connectors, integrations, opportunities] = await Promise.all([
    getTreasurySnapshot(),
    getGlobalAuthorizationSummary().catch(() => null),
    getConnectorLiveStatuses().catch(() => []),
    runIntegrationHealthCheck().catch(() => null),
    process.env.CI === "true"
      ? Promise.resolve([])
      : cachedScanAllOpportunities().catch(() => []),
  ]);

  const capitalFlow = await getCapitalFlowSnapshot(ledger?.count ?? 0);

  return {
    gatheredAt: new Date().toISOString(),
    treasury,
    ledger,
    capitalFlow,
    connectors,
    integrations: (integrations ?? {
      checkedAt: new Date().toISOString(),
      configured: {},
      live: {},
      models: {},
    }) as WorkspaceEvidence["integrations"],
    opportunities: opportunities.slice(0, 8),
  };
}

export function evidenceSummary(evidence: WorkspaceEvidence): string {
  const lines: string[] = [];
  lines.push(`Treasury: $${evidence.treasury.balanceUsd.toFixed(2)} USDC available`);
  lines.push(`Obligations: $${evidence.treasury.obligationsUsd.toFixed(2)} USDC`);
  if (evidence.ledger) {
    lines.push(
      `Ledger: ${evidence.ledger.count} authorizations · claimable $${evidence.ledger.claimableUsd}`,
    );
  }
  lines.push(evidence.capitalFlow.scaleMessage);

  const live = evidence.connectors.filter((c) => c.health === "healthy");
  if (live.length) {
    lines.push(`Live sensors: ${live.map((c) => domainLabel(c.id)).join(", ")}`);
  }

  const critical = evidence.opportunities.filter((o) => o.priority === "critical" || o.priority === "high");
  if (critical.length) {
    lines.push(
      `Discovery: ${critical.length} high-priority unfunded repos (e.g. ${critical[0]?.fullName})`,
    );
  }

  return lines.join("\n");
}
