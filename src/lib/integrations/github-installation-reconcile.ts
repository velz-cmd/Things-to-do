import "server-only";

import { prisma } from "@/lib/db";
import {
  findGithubAppInstallationForIdentity,
  githubAppServerConfigured,
  loadGithubAppInstallationAsApp,
  loadGithubInstallationRepositoriesAsApp,
} from "@/lib/integrations/github-app";
import { invalidateConnectorCaches } from "@/lib/profile/invalidate-connector-cache";
import { persistProfileConnection } from "@/lib/profile/persisted-connection";

export type GithubInstallationReconcileResult = {
  connected: boolean;
  configured?: boolean;
  installationId?: string;
  displayLabel?: string | null;
  repositoryCount?: number;
  reconciled?: boolean;
  accountLogin?: string;
};

export async function reconcileGithubInstallation(input: {
  userId: string;
  installationId?: number;
}): Promise<GithubInstallationReconcileResult> {
  if (!input.installationId) {
    const existing = await prisma.sourceConnection.findFirst({
      where: {
        userId: input.userId,
        provider: "github_app",
        status: { in: ["connected", "syncing", "stale"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { externalAccountId: true, displayLabel: true },
    });
    if (existing) {
      return {
        connected: true,
        installationId: existing.externalAccountId ?? undefined,
        displayLabel: existing.displayLabel,
        reconciled: false,
      };
    }
  }

  if (!githubAppServerConfigured()) {
    return { connected: false, configured: false };
  }

  const profile = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { githubId: true, githubUsername: true },
  });
  if (!profile?.githubId) return { connected: false };

  const installation = input.installationId
    ? await loadGithubAppInstallationAsApp(input.installationId)
    : await findGithubAppInstallationForIdentity({
        githubId: profile.githubId,
        githubLogin: profile.githubUsername,
      });
  if (!installation || installation.suspended_at) return { connected: false };
  if (String(installation.account.id) !== profile.githubId) {
    throw new Error("github_installation_identity_mismatch");
  }

  const repositories = await loadGithubInstallationRepositoriesAsApp(installation.id);
  const displayLabel = `${installation.account.login} · ${repositories.length} repositories`;
  await persistProfileConnection({
    userId: input.userId,
    provider: "github_app",
    externalAccountId: String(installation.id),
    displayLabel,
    capabilities: {
      installationId: installation.id,
      accountId: installation.account.id,
      accountLogin: installation.account.login,
      accountType: installation.account.type,
      repositorySelection: installation.repository_selection ?? "selected",
      permissions: installation.permissions ?? {},
      repositories,
      reconciledFromVerifiedGithubIdentity: true,
      reconciledAt: new Date().toISOString(),
    },
  });
  await invalidateConnectorCaches(input.userId);

  return {
    connected: true,
    installationId: String(installation.id),
    displayLabel,
    repositoryCount: repositories.length,
    reconciled: true,
    accountLogin: installation.account.login,
  };
}
