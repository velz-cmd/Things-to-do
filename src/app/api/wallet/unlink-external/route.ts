import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/** Remove linked external wallet only — RESOLVE app wallet (Gmail) is unchanged. */
export async function POST() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { scanWalletAddress: null },
    select: { walletAddress: true, scanWalletAddress: true },
  });

  return NextResponse.json({
    ok: true,
    appWalletAddress: updated.walletAddress,
    externalWalletAddress: updated.scanWalletAddress,
  });
}
