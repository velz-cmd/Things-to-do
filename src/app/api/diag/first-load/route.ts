import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { loadDiscoverPageData } from "@/lib/discover/marketplace/query";
import { parseOpportunityFilters } from "@/lib/discover/marketplace/filters";

/**
 * TEMPORARY diagnostic. Remove before finalising.
 *
 * Two failures could not be diagnosed from the outside: the first
 * authenticated request to any page returns 500 and then recovers, and
 * Activity renders empty even though the ledger write reports success.
 * Vercel runtime logs are not reachable from here, so this route runs the
 * same paths inside try/catch and reports what actually throws.
 *
 * Returns error strings and row counts only - never record contents.
 */
function describe(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, 400),
      frame: (error.stack ?? "").split("\n")[1]?.trim().slice(0, 200) ?? null,
    };
  }
  return { name: "unknown", message: String(error).slice(0, 300), frame: null };
}

export async function GET() {
  const out: Record<string, unknown> = {};

  // Stage 1 - auth/profile/wallet provisioning.
  let userId: string | null = null;
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      out.auth = { ok: false, error: ready.error, status: ready.status };
    } else {
      userId = ready.profile.id;
      out.auth = { ok: true, userId };
    }
  } catch (error) {
    out.auth = { ok: false, threw: describe(error) };
  }

  // Stage 2 - the Discover page data load, exactly as the page calls it.
  try {
    const data = await loadDiscoverPageData(
      parseOpportunityFilters({}),
      "for_you",
    );
    out.discover = {
      ok: true,
      opportunities: data.opportunities.items.length,
      pools: data.pools.length,
      activity: (data.activity ?? []).length,
      signedIn: data.signedIn,
    };
  } catch (error) {
    out.discover = { ok: false, threw: describe(error) };
  }

  // Stage 3 - the Activity ledger, stage by stage.
  if (userId) {
    try {
      const total = await prisma.operationalEvent.count({ where: { userId } });
      const poolFunding = await prisma.operationalEvent.count({
        where: { userId, eventType: "pool_funding_pending" },
      });
      const sample = await prisma.operationalEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: 8,
        select: { eventType: true, occurredAt: true, communitySlug: true },
      });
      // Replicate the projection's own query to see where rows are lost.
      const started = Date.now();
      const matched = await prisma.operationalEvent.findMany({
        where: {
          userId,
          OR: [
            { eventType: { startsWith: "discover." } },
            { eventType: { startsWith: "capital." } },
            { eventType: { startsWith: "settlement." } },
            { eventType: { startsWith: "program." } },
            { eventType: { startsWith: "profile.payout" } },
            { eventType: { startsWith: "source.sync" } },
            { eventType: "pool_funding_pending" },
            { eventType: "application_submitted" },
          ],
        },
        orderBy: { occurredAt: "desc" },
        take: 40,
        select: { eventType: true },
      });
      const queryMs = Date.now() - started;
      const agentTx = await prisma.walletTransaction.count({
        where: { userId, type: "agent_service" },
      });
      out.ledger = {
        total,
        poolFunding,
        recentTypes: sample.map((s) => s.eventType),
        projectionQueryMatched: matched.length,
        projectionQueryMs: queryMs,
        matchedTypes: [...new Set(matched.map((m) => m.eventType))],
        agentServiceTransactions: agentTx,
      };
    } catch (error) {
      out.ledger = { threw: describe(error) };
    }
  }

  return NextResponse.json(out);
}
