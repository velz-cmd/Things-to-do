import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  buildGithubAuthorizeUrl,
  exchangeGithubCode,
  fetchGithubUser,
  githubOAuthConfigured,
} from "@/lib/integrations/github-oauth";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import { ensureContributorFromGithub } from "@/lib/identity/contributors";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { syncUserSensors } from "@/lib/connectors/user-sensor-sync";
import { appOrigin } from "@/lib/integrations/musicbrainz-oauth";
import { invalidateConnectorCaches } from "@/lib/profile/invalidate-connector-cache";
import { persistProfileConnection } from "@/lib/profile/persisted-connection";
import { loadGithubInstallationForUser } from "@/lib/integrations/github-app";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function redirectWith(
  origin: string,
  returnTo: string | undefined,
  params: Record<string, string>,
) {
  const dest =
    returnTo?.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")
      ? returnTo
      : "/profile";
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
  response.cookies.set("gh_installation_id", "", clear);
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

/** GitHub OAuth callback → store verified GitHub login on user profile. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const origin = appOrigin(new URL(req.url).origin);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieStore = await cookies();
  const installationIdRaw =
    searchParams.get("installation_id") ??
    cookieStore.get("gh_installation_id")?.value ??
    null;
  const installationId = installationIdRaw ? Number(installationIdRaw) : null;

  const returnTo = cookieStore.get("gh_oauth_return")?.value;

  if (error) {
    const response = redirectWith(origin, returnTo, { github_error: error });
    clearOAuthCookies(response);
    return response;
  }

  const expectedState = cookieStore.get("gh_oauth_state")?.value;
  const userId = cookieStore.get("gh_oauth_user")?.value;

  if (!state || !expectedState || state !== expectedState || !userId) {
    const response = redirectWith(origin, returnTo, { github_error: "invalid_state" });
    clearOAuthCookies(response);
    return response;
  }

  if (!code) {
    if (
      installationIdRaw &&
      Number.isSafeInteger(installationId) &&
      installationId! > 0 &&
      githubOAuthConfigured()
    ) {
      const response = NextResponse.redirect(buildGithubAuthorizeUrl(state, origin));
      response.cookies.set("gh_installation_id", String(installationId), {
        httpOnly: true,
        secure: origin.startsWith("https://"),
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
      });
      return response;
    }
    const response = redirectWith(origin, returnTo, {
      github_error: installationIdRaw ? "github_oauth_not_configured" : "missing_code",
    });
    clearOAuthCookies(response);
    return response;
  }

  try {
    const sessionUser = await withTimeout(getSessionUser(), 4_000);
    if (!sessionUser || sessionUser.id !== userId) {
      const response = redirectWith(origin, returnTo, { github_error: "session_expired" });
      clearOAuthCookies(response);
      return response;
    }

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

    await Promise.all([
      ensureContributorFromGithub({ login, githubId: String(ghUser.id) }),
      persistProfileConnection({
        userId,
        provider: "github",
        displayLabel: `@${login}`,
        capabilities: {
          identity: true,
          readEvidence: true,
          synchronize: true,
          scopes: tokens.scope?.split(",").map((scope) => scope.trim()).filter(Boolean) ?? [],
        },
      }),
    ]);

    let installationRepositoryCount: number | null = null;
    if (installationIdRaw) {
      if (!Number.isSafeInteger(installationId) || installationId! <= 0) {
        throw new Error("invalid_github_installation");
      }
      const installation = await loadGithubInstallationForUser(
        tokens.access_token!,
        installationId!,
      );
      installationRepositoryCount = installation.repositories.length;
      await persistProfileConnection({
        userId,
        provider: "github_app",
        externalAccountId: String(installationId),
        displayLabel: `${installation.installation.account.login} · ${installation.repositories.length} repositories`,
        capabilities: {
          installationId: installationId!,
          accountId: installation.installation.account.id,
          accountLogin: installation.installation.account.login,
          accountType: installation.installation.account.type,
          repositorySelection: installation.installation.repository_selection ?? "selected",
          permissions: installation.installation.permissions ?? {},
          repositories: installation.repositories,
          verifiedWithUserAuthorization: true,
          callbackVerifiedAt: new Date().toISOString(),
        },
      });
    }

    after(async () => {
      await invalidateConnectorCaches(userId);
      await autoInstallCommunitiesForUser(userId, { githubUsername: login }).catch(
        () => undefined,
      );
      await syncUserSensors(userId).catch(() => undefined);
    });

    const response = redirectWith(origin, returnTo, {
      github_connected: "1",
      github_account: login,
      ...(installationRepositoryCount !== null
        ? {
            github_installation: "1",
            github_repository_count: String(installationRepositoryCount),
          }
        : {}),
    });
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
