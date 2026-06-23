import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser, assertTaskOwner } from "@/lib/auth/session";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";
import type { SettlementApiResponse } from "@/lib/settlement/settlement-types";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ ok: false, error: ready.error }, { status: ready.status });
  }

  const { taskId } = await req.json();
  const owned = await assertTaskOwner(taskId, ready.user.id);
  if ("error" in owned) {
    return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
  }

  const task = owned.task;
  const adapter = getSettlementAdapter();

  try {
    const settlement = await adapter.createEscrow({
      taskId,
      amountUsdc: task.budgetUsd,
      description: task.title,
      clientWallet: ready.profile.walletAddress ?? undefined,
    });

    if (settlement.status === "escrow_locked") {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          escrowLocked: true,
          escrowTxHash: settlement.fundTxHash ?? null,
          escrowTaskId:
            settlement.jobId && /^\d+$/.test(settlement.jobId)
              ? Number(settlement.jobId)
              : null,
          status: "authorized",
        },
      });
    }

    const body: SettlementApiResponse = {
      ok: settlement.status !== "failed",
      mode: settlement.mode,
      settlement,
      message:
        settlement.mode === "mock_arc"
          ? "Mock Arc escrow — no live transaction submitted"
          : "Arc ERC-8183 job funded",
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        mode: adapter.mode,
        error: e instanceof Error ? e.message : "Escrow failed",
      },
      { status: 500 }
    );
  }
}
