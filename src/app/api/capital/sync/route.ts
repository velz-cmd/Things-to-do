import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadCapitalState } from "@/lib/capital/state";
import { withCapitalStateInflight } from "@/lib/capital/state-inflight";
import { bustCapitalStateCache } from "@/lib/capital/state-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const inputSchema = z.object({
  walletTypes: z.array(z.enum(["app", "connected"])).min(1).max(2).optional(),
  reason: z.enum([
    "manual_refresh",
    "transaction_submitted",
    "transaction_confirmed",
    "window_focus",
    "scheduled",
  ]),
  idempotencyKey: z.string().min(8).max(160),
});

export async function POST(request: Request) {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: false, error: "Sign in to synchronize Capital." }, { status: 401 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid Capital synchronization request." }, { status: 400 });
  }

  const idempotencyKey = `capital.refresh_snapshot:${authUser.id}:${parsed.data.idempotencyKey}`;
  const existing = await prisma.actionRun.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return NextResponse.json({ ok: true, accepted: true, actionRunId: existing.id, state: existing.state });
  }
  const active = await prisma.actionRun.findFirst({
    where: {
      userId: authUser.id,
      actionId: "capital.refresh_snapshot",
      state: { in: ["validating", "pending_external"] },
    },
    orderBy: { startedAt: "desc" },
  });
  if (active) {
    return NextResponse.json({ ok: true, accepted: true, actionRunId: active.id, state: active.state });
  }

  const actionRun = await prisma.actionRun.create({
    data: {
      userId: authUser.id,
      actionId: "capital.refresh_snapshot",
      aggregateType: "capital_snapshot",
      aggregateId: authUser.id,
      idempotencyKey,
      state: "pending_external",
      recommendationReason: `Refresh requested after ${parsed.data.reason.replaceAll("_", " ")}.`,
      input: parsed.data,
    },
  });

  after(async () => {
    try {
      const state = await withCapitalStateInflight(authUser.id, true, () =>
        loadCapitalState(authUser, { liveSync: true }),
      );
      const confirmed = state.networkHealth === "healthy" && state.syncStatus === "live";
      if (confirmed) await bustCapitalStateCache(authUser.id);
      await prisma.$transaction([
        prisma.actionRun.update({
          where: { id: actionRun.id },
          data: confirmed
            ? {
                state: "confirmed",
                output: {
                  selectedWallet: state.selectedWallet,
                  lastSuccessfulSyncAt: state.lastSyncedAt,
                  networkHealth: state.networkHealth,
                },
                completedAt: new Date(),
              }
            : {
                state: "sync_failed",
                errorCode: state.code ?? "ARC_RPC_UNAVAILABLE",
                errorMessage: state.syncError ?? "Arc synchronization did not complete.",
                output: { priorConfirmedStatePreserved: true, networkHealth: state.networkHealth },
                completedAt: new Date(),
              },
        }),
        prisma.operationalEvent.create({
          data: {
            eventType: confirmed ? "capital.snapshot_refreshed" : "capital.snapshot_refresh_failed",
            aggregateType: "capital_snapshot",
            aggregateId: authUser.id,
            userId: authUser.id,
            correlationId: request.headers.get("x-correlation-id") ?? actionRun.id,
            idempotencyKey: `audit:${idempotencyKey}`,
            payload: {
              actionRunId: actionRun.id,
              reason: parsed.data.reason,
              confirmed,
              priorConfirmedStatePreserved: !confirmed,
            },
          },
        }),
      ]);
    } catch (error) {
      await prisma.actionRun.update({
        where: { id: actionRun.id },
        data: {
          state: "sync_failed",
          errorCode: "CAPITAL_SYNC_FAILED",
          errorMessage: error instanceof Error ? error.message : "Capital synchronization failed.",
          completedAt: new Date(),
        },
      }).catch(() => null);
    }
  });

  return NextResponse.json(
    { ok: true, accepted: true, actionRunId: actionRun.id, state: actionRun.state },
    { status: 202 },
  );
}
