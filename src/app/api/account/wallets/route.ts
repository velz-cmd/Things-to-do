import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import type { ResolveWallet } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let profile;
  try {
    profile = await ensureProfileForUser(authUser);
  } catch {
    return NextResponse.json(
      { error: "Could not load account wallet", appWalletPending: true },
      { status: 503 },
    );
  }

  const resolved = resolveUserWallet(profile.id, profile);
  const payout = await prisma.payoutDestination.findFirst({
    where: { userId: profile.id, status: { in: ["verified", "pending"] } },
    orderBy: [{ verifiedAt: "desc" }, { updatedAt: "desc" }],
    select: { address: true, status: true },
  }).catch(() => null);
  const provider = appWalletProvider(profile);
  const wallets: ResolveWallet[] = [
    {
      id: `app-${profile.id}`,
      type: "app_managed",
      chain: "evm",
      address: resolved.address,
      provider: provider === "circle" ? "circle" : "embedded",
      isPrimary: true,
      createdAt: profile.createdAt.toISOString(),
    },
  ];

  if (profile.scanWalletAddress) {
    wallets.push({
      id: `ext-${profile.scanWalletAddress}`,
      type: "external",
      chain: "evm",
      address: profile.scanWalletAddress.toLowerCase(),
      provider: "wagmi",
      isPrimary: false,
      createdAt: profile.createdAt.toISOString(),
    });
  }

  return NextResponse.json({
    wallets,
    payoutDestination: payout
      ? {
          address: payout.address.toLowerCase(),
          status: payout.status === "verified" ? "verified" : payout.status === "pending" ? "pending" : "unverified",
        }
      : undefined,
    appWalletPending: false,
    notificationEmail: profile.email ?? undefined,
    notificationEmailVerified: Boolean(profile.email),
  });
}
