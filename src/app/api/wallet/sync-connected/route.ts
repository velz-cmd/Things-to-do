import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { requireSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import { getArcUsdcBalance } from "@/lib/wallet/arc-usdc-balance";

/** Sync Arc USDC from the user's linked external wallet into spendable balance. */
export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = await req.json().catch(() => ({}));
  const walletAddress =
    typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";

  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const external = walletAddress.toLowerCase();
  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { scanWalletAddress: true, walletAddress: true },
  });

  if (!profile?.scanWalletAddress) {
    return NextResponse.json(
      { error: "Link your wallet from the account menu first" },
      { status: 400 },
    );
  }

  if (profile.scanWalletAddress.toLowerCase() !== external) {
    return NextResponse.json(
      { error: "Connected wallet does not match your linked address" },
      { status: 409 },
    );
  }

  const [chainBalance, sync] = await Promise.all([
    getArcUsdcBalance(external).catch(() => null),
    syncIdentityBalance(session.user.id).catch(() => null),
  ]);

  return NextResponse.json({
    ok: true,
    walletAddress: external,
    onChainUsd: chainBalance ? Number(chainBalance.totalUsdc) : sync?.onChainUsd ?? null,
    spendableUsd: sync?.availableUsd ?? null,
    synced: Boolean(sync?.synced),
    syncedAt: chainBalance?.syncedAt ?? new Date().toISOString(),
  });
}
