import { NextResponse } from "next/server";
import { ensureProfileForUser, requireSessionUser } from "@/lib/auth/session";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";

export const dynamic = "force-dynamic";

/** Persisted RESOLVE wallet for the signed-in user — same address every sign-in. */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const profile = await ensureProfileForUser(session.user);
  const resolved = resolveUserWallet(profile.id, profile);
  const provider = appWalletProvider(profile);

  return NextResponse.json({
    ok: true,
    address: resolved.address,
    label: `${resolved.address.slice(0, 6)}…${resolved.address.slice(-4)}`,
    embedded: profile.embeddedWallet,
    provider,
    lockedToProfile: true,
  });
}
