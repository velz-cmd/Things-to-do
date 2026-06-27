import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { INTEGRATIONS } from "@/lib/integrations/config";
import {
  SOURCE_CATALOG,
  domainForConnector,
  domainLabel,
  reasonForAuthorizations,
  type ValueDomain,
} from "@/lib/workspace/domains";
import { eventTypeLabel, explainRecognition } from "@/lib/workspace/events";
import { buildEvidenceActions } from "@/lib/workspace/advisors/evidence-actions";
import { getCapitalFlowSnapshot } from "@/lib/capital-flow/engine";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";
import { buildDomainIntelligence } from "@/lib/workspace/domain-intelligence";
import { RESOLVE_MISSION } from "@/lib/resolve/pillars";
import type { WorkspaceEvidence } from "@/lib/workspace/context";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type RecommendedAction = {
  id: string;
  label: string;
  href: string;
  priority: "high" | "medium" | "low";
  detail?: string;
  evidence?: string;
};

/** Universal Workspace OS — open ecosystems, one timeline, real APIs only */
export async function GET() {
  const sinceToday = startOfToday();
  const [ledger, treasury, connectors, todayRows, recentRows, opportunities, integrations] =
    await Promise.all([
    getGlobalAuthorizationSummary().catch(() => null),
    getTreasurySnapshot().catch(() => null),
    getConnectorLiveStatuses().catch(() => []),
    prisma.paymentAuthorization
      .findMany({
        where: { createdAt: { gte: sinceToday } },
        select: {
          connectorId: true,
          amountUsd: true,
          contextLabel: true,
          evidenceJson: true,
        },
      })
      .catch(() => []),
    prisma.paymentAuthorization
      .findMany({
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          connectorId: true,
          eventType: true,
          amountUsd: true,
          status: true,
          contextLabel: true,
          payeeKey: true,
          confidence: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
    process.env.CI === "true"
      ? Promise.resolve([])
      : scanAllOpportunities().catch(() => []),
    runIntegrationHealthCheck().catch(() => null),
  ]);

  const capitalFlow = await getCapitalFlowSnapshot(ledger?.count ?? 0);

  const treasurySnapshot =
    treasury ??
    ({
      balanceUsd: 0,
      obligationsUsd: 0,
      availableUsd: 0,
      authorizedUsd: 0,
      pendingFundingUsd: 0,
      claimableUsd: 0,
      fundingWallet: null,
      liveArc: false,
      canSettleGlobally: false,
      blockers: ["Treasury unavailable"],
      message: "Treasury snapshot unavailable",
      arc: {
        liveArc: false,
        blockers: ["Treasury unavailable"],
        clientWallet: null,
        balanceUsd: 0,
        canDistributeOnChain: false,
        message: "Unavailable",
      },
    } satisfies Awaited<ReturnType<typeof getTreasurySnapshot>>);

  const connectorById = new Map(connectors.map((c) => [c.id, c]));
  const githubLive = connectorById.get("github")?.health === "healthy";
  const musicConnector = connectorById.get("navidrome");
  const musicLive =
    musicConnector?.health === "healthy" ||
    musicConnector?.health === "syncing" ||
    (musicConnector?.authorizationCount ?? 0) > 0;

  const sources = SOURCE_CATALOG.map((s) => {
    const live = connectorById.get(s.id);
    const connected =
      s.id === "github" ? (INTEGRATIONS.github() && githubLive)
      : s.id === "navidrome" ? musicLive
      : s.id === "openalex" ? INTEGRATIONS.openAlex()
      : (live?.installed ?? false);

    let status: "connected" | "syncing" | "needs_attention" | "disconnected" | "soon" =
      "disconnected";
    if (s.id === "peertube" || s.id === "owncast" || s.id === "photos" || s.id === "mastodon") {
      status = "soon";
    } else if (connected) {
      status = live?.health === "healthy" ? "connected" : "syncing";
    } else if (live?.health === "waiting") {
      status = "needs_attention";
    }

    return { ...s, connected, status };
  });

  const domainGroups = new Map<
    ValueDomain,
    { count: number; amountUsd: number; connectorId: string; contextLabel?: string }
  >();

  const todayByDomain = new Map<
    ValueDomain,
    { count: number; amountUsd: number; payees: Set<string> }
  >();

  for (const row of todayRows) {
    const domain = domainForConnector(row.connectorId);
    const existing = domainGroups.get(domain);
    if (existing) {
      existing.count += 1;
      existing.amountUsd += row.amountUsd;
    } else {
      domainGroups.set(domain, {
        count: 1,
        amountUsd: row.amountUsd,
        connectorId: row.connectorId,
        contextLabel: row.contextLabel ?? undefined,
      });
    }

    const todayDomain = todayByDomain.get(domain);
    if (todayDomain) {
      todayDomain.count += 1;
      todayDomain.amountUsd += row.amountUsd;
    } else {
      todayByDomain.set(domain, { count: 1, amountUsd: row.amountUsd, payees: new Set() });
    }
  }

  const authByDomain = new Map<
    ValueDomain,
    { count: number; amountUsd: number; awaitingUsd: number }
  >();

  for (const row of recentRows) {
    const domain = domainForConnector(row.connectorId);
    const existing = authByDomain.get(domain);
    const awaiting =
      row.status === "claimable" || row.status === "pending_funding" ? row.amountUsd : 0;
    if (existing) {
      existing.count += 1;
      existing.amountUsd += row.amountUsd;
      existing.awaitingUsd += awaiting;
    } else {
      authByDomain.set(domain, {
        count: 1,
        amountUsd: row.amountUsd,
        awaitingUsd: awaiting,
      });
    }
  }

  const domainIntelligence = buildDomainIntelligence({
    connectors,
    ledger,
    todayByDomain,
    authByDomain,
  });

  const connectedEcosystems = sources.filter((s) => s.status === "connected" || s.status === "syncing").length;
  const liveDomains = domainIntelligence.filter((d) => d.status === "live").length;

  const timeline = [...domainGroups.entries()]
    .map(([domain, g]) => ({
      domain,
      label: domainLabel(g.connectorId),
      authorizationCount: g.count,
      amountUsd: Math.round(g.amountUsd * 100) / 100,
      reason: reasonForAuthorizations({
        domain,
        count: g.count,
        connectorId: g.connectorId,
        contextLabel: g.contextLabel,
      }),
    }))
    .sort((a, b) => b.authorizationCount - a.authorizationCount);

  const valueFlow = ledger
    ? [
        { stage: "Recognized", amountUsd: ledger.authorizedUsd, tone: "sky" as const },
        { stage: "Pending funding", amountUsd: ledger.pendingFundingUsd, tone: "amber" as const },
        { stage: "Claimable", amountUsd: ledger.claimableUsd, tone: "emerald" as const },
        { stage: "Settled", amountUsd: ledger.settledUsd, tone: "muted" as const },
      ]
    : [];

  const liveActivity = recentRows.map((r) => {
    const domain = domainLabel(r.connectorId);
    const context = r.contextLabel ?? r.payeeKey;
    return {
      id: r.id,
      domain,
      eventType: r.eventType,
      eventLabel: eventTypeLabel(r.eventType),
      amountUsd: r.amountUsd,
      status: r.status,
      context,
      confidence: r.confidence,
      explanation: explainRecognition({
        eventType: r.eventType,
        domain,
        context,
        status: r.status,
        amountUsd: r.amountUsd,
        confidence: r.confidence,
      }),
      at: r.updatedAt.toISOString(),
    };
  });

  const evidenceActions = buildEvidenceActions({
    gatheredAt: new Date().toISOString(),
    treasury: treasurySnapshot,
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
  });

  const recommendedActions: RecommendedAction[] = evidenceActions.map((a) => ({
    id: a.id,
    label: a.label,
    href: a.href,
    priority: a.priority,
    detail: a.detail,
    evidence: a.evidence,
  }));

  return NextResponse.json({
    ok: true,
    tagline: "Global value network",
    mission: RESOLVE_MISSION,
    subtitle:
      "Open ecosystems never sleep. Value is discovered continuously — capital allocation follows.",
    network: {
      ecosystemsConnected: connectedEcosystems,
      liveDomains,
      isLive: connectedEcosystems > 0 || (ledger?.count ?? 0) > 0,
    },
    domainIntelligence,
    capitalFlow: {
      participantCount: capitalFlow.participantCount,
      estimatedBatchFeeUsd: capitalFlow.estimatedBatchFeeUsd,
      canRouteGlobally: capitalFlow.canRouteGlobally,
      message: capitalFlow.scaleMessage,
    },
    sources,
    timeline,
    ledger,
    valueFlow,
    treasury: treasury
      ? {
          balanceUsd: treasury.balanceUsd,
          obligationsUsd: treasury.obligationsUsd,
          availableUsd: treasury.availableUsd,
          message: treasury.message,
        }
      : null,
    valueOwed: ledger
      ? {
          authorizedUsd: ledger.authorizedUsd,
          pendingFundingUsd: ledger.pendingFundingUsd,
          claimableUsd: ledger.claimableUsd,
          settledUsd: ledger.settledUsd,
          totalVerifiedUsd:
            ledger.authorizedUsd + ledger.pendingFundingUsd + ledger.claimableUsd,
        }
      : null,
    liveActivity,
    recommendedActions,
    aiInsight:
      timeline.length > 0
        ? `Today RESOLVE recognized value across ${timeline.length} open ecosystem${timeline.length === 1 ? "" : "s"}. ${timeline[0]?.label ?? "Activity"} leads with ${timeline[0]?.authorizationCount ?? 0} new authorizations — ${timeline[0]?.reason ?? "value flowing through the universal pipeline"}.`
        : INTEGRATIONS.github()
          ? "Sensors are online across open ecosystems. Value will appear here automatically as activity is discovered."
          : null,
    updatedAt: new Date().toISOString(),
  });
}
