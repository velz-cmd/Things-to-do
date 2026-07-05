import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSessionUser } from "@/lib/auth/session";
import {
  buildGithubAuthorizeUrl,
  githubClientId,
  githubOAuthConfigured,
  githubOAuthRedirectUri,
} from "@/lib/integrations/github-oauth";
import { appOrigin } from "@/lib/integrations/musicbrainz-oauth";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function redirectToProfile(origin: string, error: string) {
  return NextResponse.redirect(`${origin}/profile?github_error=${encodeURIComponent(error)}`);
}

function redirectToCanonical(req: Request, origin: string, canonicalOrigin: string) {
  if (origin === canonicalOrigin) return null;
  const current = new URL(req.url);
  const target = new URL(current.pathname + current.search, canonicalOrigin);
  return NextResponse.redirect(target.toString());
}

/** Redirect user to GitHub OAuth — RESOLVE connector, separate from sign-in email. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const canonicalOrigin = appOrigin(origin);
  const canonicalRedirect = redirectToCanonical(req, origin, canonicalOrigin);
  if (canonicalRedirect) return canonicalRedirect;

  try {
    const session = await withTimeout(requireSessionUser(), 15_000);
    if (session === "timeout") {
      return redirectToProfile(canonicalOrigin, "session_timeout");
    }
    if ("error" in session) {
      return NextResponse.redirect(
        `${canonicalOrigin}/?auth_error=${encodeURIComponent(session.error)}`,
      );
    }

    if (!githubOAuthConfigured()) {
      return redirectToProfile(canonicalOrigin, "not_configured");
    }

    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get("returnTo");
    const state = randomBytes(16).toString("hex");

    const target = buildGithubAuthorizeUrl(state, canonicalOrigin);
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
    return redirectToProfile(canonicalOrigin, message.slice(0, 80));
  }
}

export async function POST(req: Request) {
  const origin = appOrigin(new URL(req.url).origin);
  return NextResponse.json({
    ok: githubOAuthConfigured(),
    clientId: githubClientId() ? `${githubClientId()!.slice(0, 6)}...` : null,
    redirectUri: githubOAuthRedirectUri(origin),
    authorizeUrl: "/api/connectors/github/authorize?returnTo=/profile",
    missing:
      githubOAuthConfigured() ?
        []
      : ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET"],
  });
}
