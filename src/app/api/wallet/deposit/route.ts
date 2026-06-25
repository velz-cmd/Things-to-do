import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { isCardOnRampEnabled } from "@/lib/config/demo-mode";

const bodySchema = z.object({
  amountUsd: z.number().min(5).max(500),
  method: z.enum(["card", "debit", "paypal", "bank"]),
});

/** Card/bank path — demo instant credit only. Production uses Arc USDC deposit. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  if (!isCardOnRampEnabled()) {
    return NextResponse.json(
      {
        error: "Card and bank deposits are not live yet",
        message:
          "Use the Arc tab in Add funds to send USDC on Arc testnet, or Bridge from another chain.",
        useCrypto: true,
      },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deposit request" }, { status: 400 });
  }

  const { amountUsd, method } = parsed.data;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: ready.user.id },
      data: { availableUsd: { increment: amountUsd } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: ready.user.id,
        type: "deposit",
        method,
        amountUsd,
        label: `Demo credit via ${method}`,
        status: "completed",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: user.availableUsd,
    message: `$${amountUsd.toFixed(2)} demo credit added — not a real Circle on-ramp`,
    embedded: ready.profile.embeddedWallet,
    demo: true,
  });
}
