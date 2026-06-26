import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import {
  SOURCE_CATALOG,
  domainForConnector,
  domainLabel,
  reasonForAuthorizations,
  type ValueDomain,
} from "@/lib/workspace/domains";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Universal Workspace OS — one timeline, invisible connectors */
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
        take: 30,
        select: {
          id: true,
          connectorId: true,
          eventType: true,
          amountUsd: true,
          status: true,
          contextLabel: true,
          payeeKey: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  const connectorById = new Map(connectors.map((c) => [c.id, c]));

  const sources = SOURCE_CATALOG.map((s) => {
    const live = connectorById.get(s.id);
    return {
      ...s,
      connected: live?.installed ?? s.id === "openalex",
      health:
        live?.health === "healthy" ? "live"
        : live?.health === "upcoming" ? "soon"
        : ("waiting" as const),
    };
  });

  const domainGroups = new Map<
    ValueDomain,
    { count: number; amountUsd: number; connectorId: string; contextLabel?: string }
  >();

  for (const row of todayRows) {
    const domain = domainForConnector(row.connectorId);
    const existing = domainGroups.get(domain);
    let metadata: Record<string, unknown> = {};
    try {
      if (row.evidenceJson) metadata = JSON.parse(row.evidenceJson);
    } catch {
      /* ignore */
    }
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

  return NextResponse.json({
    ok: true,
    tagline: "Where value is created and where money should flow.",
    sources,
    timeline,
    ledger,
    treasury: treasury
      ? {
          balanceUsd: treasury.balanceUsd,
          obligationsUsd: treasury.obligationsUsd,
          claimableUsd: treasury.claimableUsd,
          message: treasury.message,
        }
      : null,
    liveActivity: recentRows.map((r) => ({
      id: r.id,
      domain: domainLabel(r.connectorId),
      eventType: r.eventType,
      amountUsd: r.amountUsd,
      status: r.status,
      context: r.contextLabel ?? r.payeeKey,
      at: r.updatedAt.toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  });
}
