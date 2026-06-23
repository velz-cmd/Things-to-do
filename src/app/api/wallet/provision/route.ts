import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/wallet/service";
import { randomBytes } from "crypto";

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

  const embeddedAddress =
    "0x" + randomBytes(20).toString("hex");

  const user = await ensureUserProfile({
    id: authUser.id,
    email: authUser.email,
    displayName:
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      authUser.email?.split("@")[0],
    authProvider: provider,
  });

  if (!user.walletAddress) {
    const { prisma } = await import("@/lib/db");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        walletAddress: embeddedAddress,
        embeddedWallet: true,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    walletAddress: user.walletAddress ?? embeddedAddress,
    embedded: true,
  });
}
