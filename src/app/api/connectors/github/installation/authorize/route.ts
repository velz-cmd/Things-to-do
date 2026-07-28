import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { appOrigin } from "@/lib/integrations/musicbrainz-oauth";
import {
  buildGithubAppInstallUrl,
  githubAppInstallConfigured,
} from "@/lib/integrations/github-app";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/profile?view=sources";
}

function returnWithError(origin: string, returnTo: string, error: string) {
  const url = new URL(returnTo, origin);
  url.searchParams.set("github_install_error", error);
  return NextResponse.redirect(url);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(url.origin);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const user = await withTimeout(getSessionUser(), 4_000);

  if (!user) {
    const signIn = new URL("/auth/sign-in", origin);
    signIn.searchParams.set(
      "next",
      `/connect/github/install?returnTo=${encodeURIComponent(returnTo)}`,
    );
    return NextResponse.redirect(signIn);
  }
  if (!githubAppInstallConfigured()) {
    return returnWithError(origin, returnTo, "github_app_not_configured");
  }

  const state = randomBytes(24).toString("hex");
  const installUrl = buildGithubAppInstallUrl(state);
  if (!installUrl) return returnWithError(origin, returnTo, "github_app_not_configured");

  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  cookieStore.set("gh_oauth_state", state, options);
  cookieStore.set("gh_oauth_user", user.id, options);
  cookieStore.set("gh_oauth_return", returnTo, options);
  return NextResponse.redirect(installUrl);
}
