import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getBankingAccountSnapshot } from "@/lib/banking/account";
import { bankingSnapshotFromWalletBalance } from "@/lib/banking/fallback-snapshot";
import { buildFallbackArcRail } from "@/lib/banking/arc-rail";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";

/** RESOLVE Banking — unified account snapshot (custody, no interest). */
export async function GET() {
  try {
    const authUser = await getSessionUser();
    const profile = authUser ? await ensureProfileForUser(authUser) : null;
    const snapshot = await getBankingAccountSnapshot({ authUser, profile });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[banking/account]", e);
    const authUser = await getSessionUser().catch(() => null);
    if (authUser) {
      try {
        const profile = await ensureProfileForUser(authUser);
        const address = resolveUserWallet(profile.id, profile).address;
        const realBalance = await getRealSpendableUsd(profile.id).catch(() => null);
        const arc = buildFallbackArcRail();
        arc.identityWallet = {
          address,
          label: `${address.slice(0, 6)}…${address.slice(-4)}`,
          provider: "embedded",
          circleWalletId: null,
          depositAddress: address,
          onChainUsdcUsd: realBalance?.onChainUsd ?? null,
        };

        const snapshot = bankingSnapshotFromWalletBalance({
          userId: profile.id,
          email: authUser.email,
          displayName:
            profile.displayName ??
            (authUser.user_metadata?.full_name as string | undefined) ??
            authUser.email?.split("@")[0] ??
            null,
          walletAddress: address,
          availableUsd: realBalance?.availableUsd ?? profile.availableUsd,
          onChainUsd: realBalance?.onChainUsd ?? null,
          reservedUsd: realBalance?.reservedUsd ?? 0,
        });

        return NextResponse.json({
          ...snapshot,
          arc,
          memberSince: profile.createdAt.toISOString(),
        });
      } catch (inner) {
        console.error("[banking/account] wallet fallback", inner);
      }
    }

    const snapshot = await getBankingAccountSnapshot({
      authUser: null,
      profile: null,
    }).catch(() => null);
    if (snapshot) return NextResponse.json(snapshot);
    return NextResponse.json({ error: "Account unavailable" }, { status: 503 });
  }
}
