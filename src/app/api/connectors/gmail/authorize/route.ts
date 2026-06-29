import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import {
  buildGmailAuthorizeUrl,
  googleOAuthConfigured,
} from "@/lib/google/oauth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  try {
    const session = await requireSessionUser();
    if ("error" in session) {
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(session.error)}`,
      );
    }

    if (!googleOAuthConfigured()) {
      return NextResponse.redirect(`${origin}/profile?gmail_error=not_configured`);
    }

    const { searchParams } = new URL(req.url);
    const sendAccess = searchParams.get("send") === "true";
    const returnTo = searchParams.get("returnTo");
    const state = randomBytes(16).toString("hex");

    const target = buildGmailAuthorizeUrl(state, sendAccess);
    const response = NextResponse.redirect(target);

    response.cookies.set("gmail_oauth_state", state, COOKIE_OPTS);
    response.cookies.set("gmail_oauth_user", session.user.id, COOKIE_OPTS);
    if (returnTo?.startsWith("/")) {
      response.cookies.set("gmail_oauth_return", returnTo, COOKIE_OPTS);
    }

    return response;
  } catch (e) {
    console.error("[gmail/authorize]", e);
    const message = e instanceof Error ? e.message : "authorize_failed";
    return NextResponse.redirect(
      `${origin}/profile?gmail_error=${encodeURIComponent(message.slice(0, 80))}`,
    );
  }
}
