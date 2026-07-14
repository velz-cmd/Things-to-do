import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { bustCapitalStateCache } from "@/lib/capital/state-cache";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  wallet: z.enum(["app", "connected"]),
  idempotencyKey: z.string().min(8).max(160),
});

export async function POST(request: Request) {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: false, error: "Sign in to select a Capital wallet." }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid wallet selection." }, { status: 400 });
  }

  const idempotencyKey = `capital.select_wallet:${authUser.id}:${parsed.data.idempotencyKey}`;
  const existing = await prisma.actionRun.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return NextResponse.json({ ok: true, actionRunId: existing.id, wallet: parsed.data.wallet });
  }

  const profile = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { scanWalletAddress: true },
  });
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile is not ready." }, { status: 409 });
  }
  if (parsed.data.wallet === "connected" && !profile.scanWalletAddress) {
    return NextResponse.json(
      { ok: false, error: "Link a connected wallet before selecting it." },
      { status: 409 },
    );
  }

  const actionRun = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: authUser.id },
      data: { selectedCapitalWallet: parsed.data.wallet },
    });
    const run = await tx.actionRun.create({
      data: {
        userId: authUser.id,
        actionId: "capital.select_wallet",
        aggregateType: "user_capital_wallet",
        aggregateId: authUser.id,
        idempotencyKey,
        state: "confirmed",
        recommendationReason: "Use the selected wallet as the source for Capital availability and preflight.",
        input: { wallet: parsed.data.wallet },
        output: { selectedCapitalWallet: parsed.data.wallet },
        completedAt: new Date(),
      },
    });
    await tx.operationalEvent.create({
      data: {
        eventType: "capital.wallet_selected",
        aggregateType: "user_capital_wallet",
        aggregateId: authUser.id,
        userId: authUser.id,
        correlationId: request.headers.get("x-correlation-id") ?? run.id,
        idempotencyKey: `audit:${idempotencyKey}`,
        payload: { selectedCapitalWallet: parsed.data.wallet, actionRunId: run.id },
      },
    });
    return run;
  });

  await bustCapitalStateCache(authUser.id);
  return NextResponse.json({
    ok: true,
    actionRunId: actionRun.id,
    wallet: parsed.data.wallet,
  });
}
