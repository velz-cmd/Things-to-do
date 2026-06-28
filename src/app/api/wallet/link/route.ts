import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";

/** Link external wallet to profile without replacing the user's RESOLVE app wallet. */
export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const { walletAddress } = await req.json();
  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const external = walletAddress.toLowerCase();

  const identityOwner = await prisma.user.findFirst({
    where: {
      walletAddress: external,
      embeddedWallet: true,
      id: { not: session.user.id },
    },
    select: { id: true },
  });
  if (identityOwner) {
    return NextResponse.json(
      { error: "That address is another member's RESOLVE wallet" },
      { status: 409 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.walletAddress?.toLowerCase() === external) {
    return NextResponse.json({
      ok: true,
      appWalletAddress: user.walletAddress,
      externalWalletAddress: user.scanWalletAddress,
      message: "That is already your RESOLVE wallet address",
    });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      scanWalletAddress: external,
    },
  });

  return NextResponse.json({
    ok: true,
    appWalletAddress: updated.walletAddress,
    externalWalletAddress: updated.scanWalletAddress,
  });
}
