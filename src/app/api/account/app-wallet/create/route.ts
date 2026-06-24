import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";

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

  let profile = await ensureProfileForUser(authUser);

  if (!profile.walletAddress) {
    return NextResponse.json({
      ok: false,
      status: "wallet_pending",
      message: "App wallet setup needs retry.",
    });
  }

  return NextResponse.json({
    ok: true,
    status: "ready",
    walletAddress: profile.walletAddress,
    embedded: profile.embeddedWallet,
    email: profile.email,
    authProvider: provider,
  });
}
