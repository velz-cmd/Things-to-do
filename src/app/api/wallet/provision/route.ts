import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/wallet/service";
import { ensureAppWalletForUser } from "@/lib/wallet/app-wallet-service";

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const provider =
    authUser.app_metadata?.provider === "email"
      ? "email"
      : authUser.app_metadata?.provider ?? "google";

  let user = await ensureUserProfile({
    id: authUser.id,
    email: authUser.email,
    displayName:
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      authUser.email?.split("@")[0],
    authProvider: provider,
  });

  user = await ensureAppWalletForUser(user);

  return NextResponse.json({
    ok: true,
    walletAddress: user.walletAddress,
    embedded: user.embeddedWallet,
    externalWalletAddress: user.scanWalletAddress,
    needsExternalWallet: false,
    email: user.email,
  });
}
