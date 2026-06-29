import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { requireReadyUser } from "@/lib/auth/session";
import {
  buildMusicBrainzAuthorizeUrl,
  createPkcePair,
  musicBrainzOAuthConfigured,
} from "@/lib/integrations/musicbrainz-oauth";

/** Redirect user to MusicBrainz OAuth — same identity as ListenBrainz. */
export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(ready.error)}`, req.url),
    );
  }

  if (!musicBrainzOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/profile?listenbrainz_error=not_configured", req.url),
    );
  }

  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get("returnTo");
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkcePair();

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  cookieStore.set("lb_oauth_state", state, cookieOpts);
  cookieStore.set("lb_oauth_user", ready.user.id, cookieOpts);
  cookieStore.set("lb_oauth_verifier", verifier, cookieOpts);

  if (returnTo?.startsWith("/")) {
    cookieStore.set("lb_oauth_return", returnTo, cookieOpts);
  }

  return NextResponse.redirect(buildMusicBrainzAuthorizeUrl(state, challenge));
}
