import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";

const bodySchema = z.object({
  amountUsd: z.number().min(5).max(500),
  method: z.enum(["card", "debit", "paypal", "bank"]),
});

/** Email / card path — credits balance instantly; Arc USDC handled server-side. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deposit request" }, { status: 400 });
  }

  const { amountUsd, method } = parsed.data;

  // Production: Circle on-ramp → agent escrow. Hackathon: instant credit after email sign-in.
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
        label: `Added via ${method} — settled to agent escrow`,
        status: "completed",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: user.availableUsd,
    message: `$${amountUsd.toFixed(2)} ready for tasks — we handle Arc USDC for you`,
    embedded: ready.profile.embeddedWallet,
  });
}

