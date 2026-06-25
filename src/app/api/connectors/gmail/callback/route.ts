import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeGoogleCode } from "@/lib/google/oauth";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/start?gmail_error=${encodeURIComponent(error)}`
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;
  const userId = cookieStore.get("gmail_oauth_user")?.value;

  cookieStore.delete("gmail_oauth_state");
  cookieStore.delete("gmail_oauth_user");

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    return NextResponse.redirect(`${origin}/start?gmail_error=invalid_state`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    await prisma.user.update({
      where: { id: userId },
      data: {
        gmailConnected: true,
        ...(tokens.refresh_token ? { gmailRefreshToken: tokens.refresh_token } : {}),
      },
    });
    const returnTo = cookieStore.get("gmail_oauth_return")?.value;
    cookieStore.delete("gmail_oauth_return");
    const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/start";
    const suffix = dest.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${origin}${dest}${suffix}gmail_connected=1`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gmail connection failed";
    return NextResponse.redirect(
      `${origin}/start?gmail_error=${encodeURIComponent(message)}`
    );
  }
}
