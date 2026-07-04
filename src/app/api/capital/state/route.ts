import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { loadCapitalState } from "@/lib/capital/state";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json(
      {
        ok: false,
        walletConnected: false,
        walletAddress: null,
        shortWalletAddress: null,
        walletSource: null,
        arcNetwork: {
          name: "Arc Testnet",
          chainId: 5042002,
          currency: "USDC",
          explorerUrl: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app",
        },
        usdcBalance: null,
        spendableBalance: null,
        treasuryBalance: 0,
        programBalances: [],
        pendingTransactions: [],
        claimableAmount: 0,
        lastSyncedAt: null,
        syncStatus: "no_wallet",
        syncError: "Sign in to view your Arc wallet.",
        account: null,
        warnings: [],
        code: "UNAUTHORIZED",
        message: "Sign in to view your Arc wallet.",
      },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const key = `capital:state:${authUser.id}`;
  const state = refresh
    ? await loadCapitalState(authUser)
    : await cacheGetOrSet(key, 25, () => loadCapitalState(authUser));

  return NextResponse.json(state, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
    },
  });
}
