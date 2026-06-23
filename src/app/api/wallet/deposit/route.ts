import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/wallet/service";

const bodySchema = z.object({
  amountUsd: z.number().min(5).max(500),
  method: z.enum(["card", "debit", "paypal", "bank"]),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to add funds" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deposit request" }, { status: 400 });
  }

  const { amountUsd, method } = parsed.data;

  // Demo: instant USDC credit. Production: Circle on-ramp / Gateway.
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { availableUsd: { increment: amountUsd } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId,
        type: "deposit",
        method,
        amountUsd,
        label: `Added via ${method}`,
        status: "completed",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: user.availableUsd,
    message: `$${amountUsd.toFixed(2)} USDC added to your balance`,
  });
}
