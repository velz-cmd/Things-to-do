import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  exchangeMusicBrainzCode,
  fetchMusicBrainzUserInfo,
  listenBrainzUsernameFromUserInfo,
} from "@/lib/integrations/musicbrainz-oauth";
import { syncUserSensors } from "@/lib/connectors/user-sensor-sync";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";

export const dynamic = "force-dynamic";

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

function clearOAuthCookies(response: NextResponse) {
  const clear = { maxAge: 0, path: "/" };
  response.cookies.set("lb_oauth_state", "", clear);
  response.cookies.set("lb_oauth_user", "", clear);
  response.cookies.set("lb_oauth_verifier", "", clear);
  response.cookies.set("lb_oauth_return", "", clear);
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
    const response = redirectWith(origin, returnTo, { listenbrainz_error: error });
    clearOAuthCookies(response);
    return response;
  }

  const expectedState = cookieStore.get("lb_oauth_state")?.value;
  const userId = cookieStore.get("lb_oauth_user")?.value;
  const verifier = cookieStore.get("lb_oauth_verifier")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !userId || !verifier) {
    const response = redirectWith(origin, returnTo, { listenbrainz_error: "invalid_state" });
    clearOAuthCookies(response);
    return response;
  }

  try {
    const tokens = await exchangeMusicBrainzCode(code, verifier, origin);
    const info = await fetchMusicBrainzUserInfo(tokens.access_token!);
    const username = listenBrainzUsernameFromUserInfo(info);

    if (!username) {
      const response = redirectWith(origin, returnTo, { listenbrainz_error: "no_username" });
      clearOAuthCookies(response);
      return response;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        listenbrainzUsername: username,
        listenbrainzToken: null,
      },
    });

    void autoInstallCommunitiesForUser(userId, { listenbrainzUsername: username }).catch(
      () => undefined,
    );
    void syncUserSensors(userId).catch(() => undefined);

    const response = redirectWith(origin, returnTo, { listenbrainz_connected: "1" });
    clearOAuthCookies(response);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "ListenBrainz connection failed";
    const response = redirectWith(origin, returnTo, {
      listenbrainz_error: message.slice(0, 120),
    });
    clearOAuthCookies(response);
    return response;
  }
}
