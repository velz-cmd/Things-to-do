import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureProfileForUser, getSessionUser } from "@/lib/auth/session";
import { getBankingAccountSnapshot } from "@/lib/banking/account";
import { bankingSnapshotFromWalletBalance } from "@/lib/banking/fallback-snapshot";
import { buildFallbackArcRail } from "@/lib/banking/arc-rail";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";

export const maxDuration = 30;

async function loadProfileLight(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

/** RESOLVE Banking — unified account snapshot (custody, no interest). */
export async function GET(req: Request) {
  const light = new URL(req.url).searchParams.get("light") === "1";

  try {
    const authUser = await getSessionUser();
    if (!authUser) {
      const snapshot = await getBankingAccountSnapshot({
        authUser: null,
        profile: null,
        light,
      });
      return NextResponse.json(snapshot);
    }

    let profile = await Promise.race([
      loadProfileLight(authUser.id),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), light ? 3_000 : 8_000)),
    ]);

    if (!profile) {
      profile = await ensureProfileForUser(authUser);
    }

    const snapshot = await getBankingAccountSnapshot({ authUser, profile, light });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[banking/account]", e);
    const authUser = await getSessionUser().catch(() => null);
    if (authUser) {
      try {
        const profile = await ensureProfileForUser(authUser);
        const address = resolveUserWallet(profile.id, profile).address;
        const arc = buildFallbackArcRail();
        arc.identityWallet = {
          address,
          label: `${address.slice(0, 6)}…${address.slice(-4)}`,
          provider: appWalletProvider(profile),
          circleWalletId: null,
          depositAddress: address,
          onChainUsdcUsd: null,
        };

        const snapshot = bankingSnapshotFromWalletBalance({
          userId: authUser.id,
          email: authUser.email,
          displayName:
            (authUser.user_metadata?.full_name as string | undefined) ??
            authUser.email?.split("@")[0] ??
            null,
          walletAddress: address,
          availableUsd: 0,
          onChainUsd: null,
        });

        return NextResponse.json({ ...snapshot, arc });
      } catch (inner) {
        console.error("[banking/account] wallet fallback", inner);
      }
    }

    return NextResponse.json({ error: "Account unavailable" }, { status: 503 });
  }
}
