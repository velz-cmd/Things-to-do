import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";

/** Link the user's connected Reown wallet to their RESOLVE profile. */
export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const { walletAddress } = await req.json();
  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      walletAddress: walletAddress.toLowerCase(),
      embeddedWallet: false,
    },
  });

  return NextResponse.json({ ok: true, walletAddress: user.walletAddress });
}
