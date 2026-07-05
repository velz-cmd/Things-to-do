import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";

const bodySchema = z.object({
  amountUsd: z.number().min(5).max(500).default(25),
});

/**
 * Playwright-only balance credit — funds E2E without card on-ramp or Arc deposit.
 * Guarded by PLAYWRIGHT_ENABLED=true (set in CI workflow).
 */
export async function POST(req: Request) {
  if (process.env.PLAYWRIGHT_ENABLED !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credit request" }, { status: 400 });
  }

  const { amountUsd } = parsed.data;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: ready.profile.id },
      data: { availableUsd: { increment: amountUsd } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: ready.profile.id,
        type: "deposit",
        method: "e2e_credit",
        amountUsd,
        label: "E2E test credit",
        status: "completed",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: user.availableUsd,
    creditedUsd: amountUsd,
  });
}
