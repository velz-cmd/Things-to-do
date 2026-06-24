import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import {
  buildGmailAuthorizeUrl,
  googleOAuthConfigured,
} from "@/lib/google/oauth";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(ready.error)}`, req.url)
    );
  }

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/start?gmail_error=not_configured", req.url)
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("gmail_oauth_user", ready.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const sendAccess = new URL(req.url).searchParams.get("send") === "true";
  const url = buildGmailAuthorizeUrl(state, sendAccess);
  return NextResponse.redirect(url);
}
