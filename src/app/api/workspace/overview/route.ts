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
};

function buildRecommendedActions(input: {
  ledger: Awaited<ReturnType<typeof getGlobalAuthorizationSummary>> | null;
  treasury: Awaited<ReturnType<typeof getTreasurySnapshot>> | null;
  githubLive: boolean;
  musicLive: boolean;
  timelineCount: number;
}): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if ((input.ledger?.claimableUsd ?? 0) > 0) {
    actions.push({
      id: "claim",
      label: "Claim your earnings",
      href: "/claim",
      priority: "high",
    });
  }

  if (
    input.treasury &&
    input.treasury.obligationsUsd > input.treasury.balanceUsd &&
    input.treasury.balanceUsd > 0
  ) {
    actions.push({
      id: "fund",
      label: "Fund settlement treasury",
      href: "/payments",
      priority: "high",
    });
  } else if (input.treasury && input.treasury.balanceUsd < 0.01 && (input.ledger?.count ?? 0) > 0) {
    actions.push({
      id: "fund",
      label: "Fund treasury for global settlement",
      href: "/payments",
      priority: "high",
    });
  }

  if (!input.githubLive) {
    actions.push({
      id: "connect-code",
      label: "Connect code ecosystems",
      href: "/profile",
      priority: "medium",
    });
  }

  if (!input.musicLive) {
    actions.push({
      id: "connect-music",
      label: "Enable music attribution",
      href: "/profile",
      priority: "medium",
    });
  }

  if (input.timelineCount === 0) {
    actions.push({
      id: "discover",
      label: "Discover value in a project",
      href: "/workspace#discover",
      priority: "low",
    });
  }

  if ((input.ledger?.pendingFundingUsd ?? 0) > 0) {
    actions.push({
      id: "settle",
      label: "Review pending settlement",
      href: "/payments",
      priority: "medium",
    });
  }

  return actions.slice(0, 5);
}

/** Universal Workspace OS — open ecosystems, one timeline, real APIs only */
export async function GET() {
  const sinceToday = startOfToday();
  const [ledger, treasury, connectors, todayRows, recentRows] = await Promise.all([
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
  ]);

  const connectorById = new Map(connectors.map((c) => [c.id, c]));
  const githubLive = connectorById.get("github")?.health === "healthy";
  const musicLive = (connectorById.get("navidrome")?.authorizationCount ?? 0) > 0;

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
  }

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

  const recommendedActions = buildRecommendedActions({
    ledger,
    treasury,
    githubLive: Boolean(githubLive),
    musicLive,
    timelineCount: timeline.length,
  });

  return NextResponse.json({
    ok: true,
    tagline: "The operating system for open ecosystems.",
    subtitle:
      "Everything you create across the open internet — code, music, research, video — flows here as value.",
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
