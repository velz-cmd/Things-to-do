import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";

/** Pull faucet / direct Arc USDC deposits into the user's spendable balance. */
export async function POST() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const result = await syncIdentityBalance(ready.user.id);

  return NextResponse.json({
    ok: true,
    ...result,
    message:
      result.synced ?
        result.adjustedUsd >= 0
          ? `$${result.adjustedUsd.toFixed(2)} synced from your Arc wallet`
          : `Balance corrected to $${result.availableUsd.toFixed(2)} (on-chain)`
      : "Balance is up to date",
  });
}
