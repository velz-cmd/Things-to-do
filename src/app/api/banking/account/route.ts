import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getBankingAccountSnapshot } from "@/lib/banking/account";
import { embeddedWalletFor } from "@/lib/wallet/embedded";

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
      const address = embeddedWalletFor(authUser.id).toLowerCase();
      return NextResponse.json({
        ok: true,
        signedIn: true,
        accountId: authUser.id,
        displayName:
          (authUser.user_metadata?.full_name as string | undefined) ??
          authUser.email?.split("@")[0] ??
          null,
        email: authUser.email ?? null,
        memberSince: new Date().toISOString(),
        walletAddress: address,
        walletLabel: `${address.slice(0, 6)}…${address.slice(-4)}`,
        policy: { custody: "non_custodial", interest: false },
        balances: {
          availableUsd: 0,
          reservedUsd: 0,
          earnedClaimableUsd: 0,
          earnedAuthorizedUsd: 0,
          earnedSettledUsd: 0,
          totalDepositedUsd: 0,
          onChainUsdcUsd: 0,
        },
        programs: [],
        statement: [],
        network: {
          authorizedUsd: 0,
          claimableUsd: 0,
          settledUsd: 0,
          pendingFundingUsd: 0,
        },
        arc: {
          chain: "arc-testnet",
          usdcReady: true,
          identityWallet: {
            address,
            label: `${address.slice(0, 6)}…${address.slice(-4)}`,
            depositAddress: address,
            onChainUsdcUsd: 0,
          },
        },
        identities: {
          github: null,
          emailVerified: Boolean(authUser.email_confirmed_at),
          gmailConnected: false,
          gmailOperatorLive: false,
        },
        updatedAt: new Date().toISOString(),
      });
    }
    const snapshot = await getBankingAccountSnapshot({ authUser: null, profile: null });
    return NextResponse.json(snapshot);
  }
}
