import { NextResponse } from "next/server";
import { z } from "zod";
import { isHash } from "viem";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { verifyArcIdentityDeposit } from "@/lib/wallet/verify-crypto-deposit";

const bodySchema = z.object({
  txHash: z.string(),
  amountUsd: z.number().min(1).max(500),
});

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success || !isHash(parsed.data.txHash)) {
    return NextResponse.json({ error: "Invalid deposit request" }, { status: 400 });
  }

  const { txHash, amountUsd } = parsed.data;
  const refLabel = `crypto:${txHash}`;

  const existing = await prisma.walletTransaction.findFirst({
    where: { userId: ready.user.id, label: refLabel },
  });
  if (existing) {
    return NextResponse.json({ error: "Deposit already credited" }, { status: 409 });
  }

  if (!ready.profile.walletAddress) {
    return NextResponse.json({ error: "No wallet on profile" }, { status: 400 });
  }

  const verified = await verifyArcIdentityDeposit({
    txHash: txHash as `0x${string}`,
    expectedUsd: amountUsd,
    depositAddress: ready.profile.walletAddress,
  });

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const credit = verified.amountUsd;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: ready.user.id },
      data: { availableUsd: { increment: credit } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: ready.user.id,
        type: "deposit",
        method: "crypto",
        amountUsd: credit,
        label: refLabel,
        status: "completed",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: user.availableUsd,
    message: `$${credit.toFixed(2)} USDC confirmed on Arc`,
    txHash,
  });
}
