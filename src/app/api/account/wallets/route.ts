import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import type { ResolveWallet } from "@/lib/auth/types";

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

  const profile = await ensureProfileForUser(authUser);
  const wallets: ResolveWallet[] = [];
  const createdAt = profile.createdAt.toISOString();

  if (profile.walletAddress && profile.embeddedWallet) {
    wallets.push({
      id: `app-${profile.id}`,
      type: "app_managed",
      chain: "evm",
      address: profile.walletAddress,
      provider: "circle",
      isPrimary: !profile.scanWalletAddress,
      createdAt,
    });
  } else if (profile.walletAddress) {
    wallets.push({
      id: `primary-${profile.id}`,
      type: "app_managed",
      chain: "evm",
      address: profile.walletAddress,
      isPrimary: true,
      createdAt,
    });
  }

  if (
    profile.scanWalletAddress &&
    profile.scanWalletAddress.toLowerCase() !==
      profile.walletAddress?.toLowerCase()
  ) {
    wallets.push({
      id: `ext-${profile.scanWalletAddress}`,
      type: "external",
      chain: "evm",
      address: profile.scanWalletAddress,
      provider: "wagmi",
      isPrimary: true,
      createdAt,
    });
    const appWallet = wallets.find((w) => w.type === "app_managed");
    if (appWallet) appWallet.isPrimary = false;
  }

  if (wallets.length === 0) {
    return NextResponse.json({
      wallets: [],
      appWalletPending: true,
    });
  }

  return NextResponse.json({
    wallets,
    appWalletPending: false,
    notificationEmail: profile.email ?? undefined,
    notificationEmailVerified: Boolean(profile.email),
  });
}
