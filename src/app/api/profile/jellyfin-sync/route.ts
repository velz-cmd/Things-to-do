import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { userJellyfinConfigured } from "@/lib/profile/user-connections";

export const dynamic = "force-dynamic";

/** Lightweight Jellyfin poll config — avoids full profile bootstrap on background sync. */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: true, signedIn: false, jellyfinSync: null });
  }

  const profile = await ensureProfileForUser(authUser);
  const jellyfinConnected = userJellyfinConfigured(profile);

  const jellyfinSync =
    jellyfinConnected && profile.jellyfinUrl && profile.jellyfinAccessToken
      ? {
          url: profile.jellyfinUrl,
          accessToken: profile.jellyfinAccessToken,
        }
      : null;

  return NextResponse.json(
    { ok: true, signedIn: true, jellyfinSync },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
