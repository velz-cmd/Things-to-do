import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadCapitalState } from "@/lib/capital/state";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Backward-compatible wallet endpoint. New UI should prefer GET /api/capital/state. */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Sign in to view your wallet." },
      { status: 401 },
    );
  }

  const state = await loadCapitalState(authUser);
  if (!state.ok || !state.wallet || !state.balance) {
    return NextResponse.json(
      {
        ok: false,
        code: state.code ?? "ARC_RPC_UNAVAILABLE",
        message:
          state.message ?? "Could not sync Arc balance. Retry sync or check wallet connection.",
        wallet: state.wallet,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    wallet: state.wallet,
    balance: state.balance,
    account: state.account,
    warnings: state.warnings,
  });
}
