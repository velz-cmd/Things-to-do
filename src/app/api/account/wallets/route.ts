import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
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
  const provider = appWalletProvider(profile);

  if (profile.walletAddress && profile.embeddedWallet) {
    wallets.push({
      id: `app-${profile.id}`,
      type: "app_managed",
      chain: "evm",
      address: profile.walletAddress,
      provider: provider === "circle" ? "circle" : "embedded",
      isPrimary: true,
      createdAt,
    });
  }

  if (profile.scanWalletAddress) {
    const app = wallets.find((w) => w.type === "app_managed");
    wallets.push({
      id: `ext-${profile.scanWalletAddress}`,
      type: "external",
      chain: "evm",
      address: profile.scanWalletAddress,
      provider: "wagmi",
      isPrimary: false,
      createdAt,
    });
    if (app) app.isPrimary = true;
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
