import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSessionUser } from "@/lib/auth/session";
import {
  buildGithubAuthorizeUrl,
  githubOAuthConfigured,
  githubOAuthRedirectUri,
} from "@/lib/integrations/github-oauth";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

/** Redirect user to GitHub OAuth — RESOLVE connector, separate from sign-in email. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  try {
    const session = await requireSessionUser();
    if ("error" in session) {
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(session.error)}`,
      );
    }

    if (!githubOAuthConfigured()) {
      return NextResponse.redirect(`${origin}/profile?github_error=not_configured`);
    }

    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get("returnTo");
    const state = randomBytes(16).toString("hex");

    const target = buildGithubAuthorizeUrl(state, origin);
    const response = NextResponse.redirect(target);

    response.cookies.set("gh_oauth_state", state, COOKIE_OPTS);
    response.cookies.set("gh_oauth_user", session.user.id, COOKIE_OPTS);
    if (returnTo?.startsWith("/")) {
      response.cookies.set("gh_oauth_return", returnTo, COOKIE_OPTS);
    }

    return response;
  } catch (e) {
    console.error("[github/authorize]", e);
    const message = e instanceof Error ? e.message : "authorize_failed";
    return NextResponse.redirect(
      `${origin}/profile?github_error=${encodeURIComponent(message.slice(0, 80))}`,
    );
  }
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: githubOAuthConfigured(),
    redirectUri: githubOAuthRedirectUri(origin),
    authorizeUrl: "/api/connectors/github/authorize?returnTo=/profile",
    missing:
      githubOAuthConfigured() ?
        []
      : ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET"],
  });
}
