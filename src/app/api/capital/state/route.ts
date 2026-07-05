import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadCapitalState } from "@/lib/capital/state";
import { withCapitalStateInflight } from "@/lib/capital/state-inflight";
import { API_CACHE } from "@/lib/api/cache-headers";
import { reportApiError } from "@/lib/api/report-error";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UNAUTHORIZED = {
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
  lastKnownBalance: null,
  treasuryBalance: 0,
  programBalances: [],
  pendingTransactions: [],
  activity: [],
  claimableAmount: 0,
  lastSyncedAt: null,
  syncStatus: "no_wallet" as const,
  syncError: "Sign in to view your Arc wallet.",
  account: null,
  warnings: [] as string[],
  code: "UNAUTHORIZED",
  message: "Sign in to view your Arc wallet.",
};

export async function GET(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 });
  }

  const rl = await rateLimitRequest(
    `capital:state:${getRequestClientId(req, authUser.id)}`,
    40,
    60,
  );
  if (!rl.success) {
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        rateLimited: true,
        syncStatus: "cached",
        syncError: "Balance sync throttled — retry in a moment.",
        message: "Too many balance requests.",
      },
      { status: 200, headers: { "Cache-Control": API_CACHE.noStore } },
    );
  }

  const url = new URL(req.url);
  const fast = url.searchParams.get("fast") === "1";
  const liveSync = !fast;

  try {
    const state = await withCapitalStateInflight(authUser.id, liveSync, () =>
      loadCapitalState(authUser, { liveSync }),
    );

    return NextResponse.json(state, {
      status: 200,
      headers: { "Cache-Control": API_CACHE.noStore },
    });
  } catch (error) {
    reportApiError("capital/state", error, { userId: authUser.id, liveSync });
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        syncStatus: "cached",
        syncError: "Could not refresh wallet — showing last known state when available.",
        walletConnected: true,
        message: "Capital state temporarily unavailable.",
      },
      { status: 200, headers: { "Cache-Control": API_CACHE.noStore } },
    );
  }
}
