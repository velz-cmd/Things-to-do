import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeGoogleCode } from "@/lib/google/oauth";

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
  response.cookies.set("gmail_oauth_state", "", clear);
  response.cookies.set("gmail_oauth_user", "", clear);
  response.cookies.set("gmail_oauth_return", "", clear);
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieStore = await cookies();

  const returnTo = cookieStore.get("gmail_oauth_return")?.value;

  if (error) {
    const response = redirectWith(origin, returnTo, { gmail_error: error });
    clearOAuthCookies(response);
    return response;
  }

  const expectedState = cookieStore.get("gmail_oauth_state")?.value;
  const userId = cookieStore.get("gmail_oauth_user")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    const response = redirectWith(origin, returnTo, { gmail_error: "invalid_state" });
    clearOAuthCookies(response);
    return response;
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

    const response = redirectWith(origin, returnTo, { gmail_connected: "1" });
    clearOAuthCookies(response);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gmail connection failed";
    const response = redirectWith(origin, returnTo, {
      gmail_error: message.slice(0, 120),
    });
    clearOAuthCookies(response);
    return response;
  }
}
