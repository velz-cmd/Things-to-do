import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  exchangeMusicBrainzCode,
  fetchMusicBrainzUserInfo,
  listenBrainzUsernameFromUserInfo,
} from "@/lib/integrations/musicbrainz-oauth";
import { syncUserMusicSensors } from "@/lib/connectors/user-music-sync";

function redirectWith(
  origin: string,
  returnTo: string | undefined,
  params: Record<string, string>,
) {
  const dest = returnTo?.startsWith("/") ? returnTo : "/profile";
  const url = new URL(dest, origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

/** MusicBrainz OAuth callback → store ListenBrainz username + sync plays. */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieStore = await cookies();

  const returnTo = cookieStore.get("lb_oauth_return")?.value;

  if (error) {
    cookieStore.delete("lb_oauth_state");
    cookieStore.delete("lb_oauth_user");
    cookieStore.delete("lb_oauth_verifier");
    cookieStore.delete("lb_oauth_return");
    return redirectWith(origin, returnTo, { listenbrainz_error: error });
  }

  const expectedState = cookieStore.get("lb_oauth_state")?.value;
  const userId = cookieStore.get("lb_oauth_user")?.value;
  const verifier = cookieStore.get("lb_oauth_verifier")?.value;

  cookieStore.delete("lb_oauth_state");
  cookieStore.delete("lb_oauth_user");
  cookieStore.delete("lb_oauth_verifier");
  cookieStore.delete("lb_oauth_return");

  if (!code || !state || !expectedState || state !== expectedState || !userId || !verifier) {
    return redirectWith(origin, returnTo, { listenbrainz_error: "invalid_state" });
  }

  try {
    const tokens = await exchangeMusicBrainzCode(code, verifier);
    const info = await fetchMusicBrainzUserInfo(tokens.access_token!);
    const username = listenBrainzUsernameFromUserInfo(info);

    if (!username) {
      return redirectWith(origin, returnTo, { listenbrainz_error: "no_username" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        listenbrainzUsername: username,
        listenbrainzToken: null,
      },
    });

    void syncUserMusicSensors(userId).catch(() => undefined);

    return redirectWith(origin, returnTo, { listenbrainz_connected: "1" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ListenBrainz connection failed";
    return redirectWith(origin, returnTo, {
      listenbrainz_error: message.slice(0, 120),
    });
  }
}
