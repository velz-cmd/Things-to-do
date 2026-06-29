import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSessionUser } from "@/lib/auth/session";
import {
  buildMusicBrainzAuthorizeUrl,
  createPkcePair,
  listenBrainzOAuthRedirectUri,
  musicBrainzOAuthConfigured,
} from "@/lib/integrations/musicbrainz-oauth";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

/** Redirect user to MusicBrainz OAuth — same identity as ListenBrainz. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  try {
    const session = await requireSessionUser();
    if ("error" in session) {
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(session.error)}`,
      );
    }

    if (!musicBrainzOAuthConfigured()) {
      return NextResponse.redirect(`${origin}/profile?listenbrainz_error=not_configured`);
    }

    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get("returnTo");
    const state = randomBytes(16).toString("hex");
    const { verifier, challenge } = createPkcePair();

    const target = buildMusicBrainzAuthorizeUrl(state, challenge, origin);
    const response = NextResponse.redirect(target);

    response.cookies.set("lb_oauth_state", state, COOKIE_OPTS);
    response.cookies.set("lb_oauth_user", session.user.id, COOKIE_OPTS);
    response.cookies.set("lb_oauth_verifier", verifier, COOKIE_OPTS);
    if (returnTo?.startsWith("/")) {
      response.cookies.set("lb_oauth_return", returnTo, COOKIE_OPTS);
    }

    return response;
  } catch (e) {
    console.error("[listenbrainz/authorize]", e);
    const message = e instanceof Error ? e.message : "authorize_failed";
    return NextResponse.redirect(
      `${origin}/profile?listenbrainz_error=${encodeURIComponent(message.slice(0, 80))}`,
    );
  }
}

/** OAuth readiness — shows redirect URI to register on MusicBrainz. */
export async function HEAD() {
  return new NextResponse(null, { status: musicBrainzOAuthConfigured() ? 200 : 503 });
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: musicBrainzOAuthConfigured(),
    redirectUri: listenBrainzOAuthRedirectUri(origin),
    authorizeUrl: "/api/connectors/listenbrainz/authorize?returnTo=/profile",
  });
}
