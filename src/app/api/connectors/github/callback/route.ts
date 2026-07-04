import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  exchangeGithubCode,
  fetchGithubUser,
} from "@/lib/integrations/github-oauth";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import { ensureContributorFromGithub } from "@/lib/identity/contributors";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { syncUserSensors } from "@/lib/connectors/user-sensor-sync";
import { cacheDelete } from "@/lib/cache/kv";

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
  response.cookies.set("gh_oauth_state", "", clear);
  response.cookies.set("gh_oauth_user", "", clear);
  response.cookies.set("gh_oauth_return", "", clear);
}

async function clearConnectorState(userId: string) {
  await Promise.all([
    cacheDelete(`profile:state:${userId}`),
    cacheDelete(`communities:list:${userId}`),
  ]);
}

/** GitHub OAuth callback → store verified GitHub login on user profile. */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieStore = await cookies();

  const returnTo = cookieStore.get("gh_oauth_return")?.value;

  if (error) {
    const response = redirectWith(origin, returnTo, { github_error: error });
    clearOAuthCookies(response);
    return response;
  }

  const expectedState = cookieStore.get("gh_oauth_state")?.value;
  const userId = cookieStore.get("gh_oauth_user")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    const response = redirectWith(origin, returnTo, { github_error: "invalid_state" });
    clearOAuthCookies(response);
    return response;
  }

  try {
    const tokens = await exchangeGithubCode(code, origin);
    const ghUser = await fetchGithubUser(tokens.access_token!);
    const login = normalizeGithubLogin(ghUser.login);

    if (!login) {
      const response = redirectWith(origin, returnTo, { github_error: "invalid_login" });
      clearOAuthCookies(response);
      return response;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubUsername: login,
        githubId: String(ghUser.id),
      },
    });

    await ensureContributorFromGithub({ login, githubId: String(ghUser.id) });
    await clearConnectorState(userId);
    void autoInstallCommunitiesForUser(userId, { githubUsername: login }).catch(() => undefined);
    void syncUserSensors(userId).catch(() => undefined);

    const response = redirectWith(origin, returnTo, { github_connected: "1" });
    clearOAuthCookies(response);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "GitHub connection failed";
    const response = redirectWith(origin, returnTo, {
      github_error: message.slice(0, 120),
    });
    clearOAuthCookies(response);
    return response;
  }
}
