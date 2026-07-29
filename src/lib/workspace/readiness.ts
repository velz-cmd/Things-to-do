import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  mapPersistedReadinessState,
  maskAccount,
  withStaleReadiness,
  workspaceReadinessSchema,
  type WorkspaceReadiness,
  type WorkspaceReadinessResource,
} from "@/lib/workspace/readiness-contract";

const FRESH_FOR_MS = 60_000;
const CLAIMABLE_STATES = ["claimable", "recognized", "awaiting_settlement"];
const PENDING_AUTHORIZATION_STATES = [
  "authorized",
  "pending_funding",
  "claimable",
  "ready_to_settle",
];

function resource(input: {
  state: WorkspaceReadinessResource["state"];
  label: string;
  account?: string | null;
  lastSuccessfulAt?: Date | string | null;
  errorCode?: string | null;
}): WorkspaceReadinessResource {
  return {
    state: input.state,
    label: input.label,
    account: input.account ?? null,
    lastSuccessfulAt: input.lastSuccessfulAt
      ? new Date(input.lastSuccessfulAt).toISOString()
      : null,
    errorCode: input.errorCode ?? null,
  };
}

function safeSnapshotPayload(value: unknown): WorkspaceReadiness | null {
  const parsed = workspaceReadinessSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function readWorkspaceReadinessSnapshot(
  userId: string,
): Promise<WorkspaceReadiness | null> {
  const row = await prisma.workspaceReadinessSnapshot.findUnique({
    where: { userId },
    select: { payload: true, lastFailureCode: true, lastFailureAt: true },
  });
  const payload = safeSnapshotPayload(row?.payload);
  if (!payload) return null;
  if (!row?.lastFailureCode || !row.lastFailureAt) return payload;
  return withStaleReadiness(payload, {
    code: row.lastFailureCode,
    correlationId: `snapshot-${userId.slice(0, 8)}`,
    occurredAt: row.lastFailureAt.toISOString(),
  });
}

export async function refreshWorkspaceReadiness(userId: string): Promise<WorkspaceReadiness> {
  const correlationId = randomUUID();
  try {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        githubUsername: true,
        githubId: true,
        walletAddress: true,
        scanWalletAddress: true,
        selectedCapitalWallet: true,
        availableUsd: true,
        updatedAt: true,
      },
    });
    if (!profile) throw new Error("workspace_profile_missing");

    const [
      sourceRows,
      installs,
      programs,
      walletRows,
      payout,
      verifiedIdentityCount,
      pendingAuthorizations,
      claimableLedger,
      pendingRewards,
    ] = await Promise.all([
      prisma.sourceConnection.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          provider: true,
          displayLabel: true,
          externalAccountId: true,
          status: true,
          authExpiresAt: true,
          lastSyncedAt: true,
          updatedAt: true,
        },
      }),
      prisma.resolveCommunityInstall.findMany({
        where: { userId },
        orderBy: { installedAt: "desc" },
        select: { id: true, communitySlug: true, status: true },
      }),
      prisma.resolveProgram.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          status: true,
          install: { select: { communitySlug: true } },
        },
      }),
      prisma.wallet.findMany({
        where: { userId, status: { in: ["active", "connected"] } },
        orderBy: { updatedAt: "desc" },
        select: { address: true, ownerType: true, custodyType: true, status: true },
      }),
      prisma.payoutDestination.findFirst({
        where: { userId },
        orderBy: [{ verifiedAt: "desc" }, { updatedAt: "desc" }],
        select: {
          address: true,
          network: true,
          status: true,
          verifiedAt: true,
          updatedAt: true,
        },
      }),
      prisma.identity.count({ where: { userId, status: "verified" } }),
      prisma.paymentAuthorization.count({
        where: { founderUserId: userId, status: { in: PENDING_AUTHORIZATION_STATES } },
      }),
      prisma.earningsLedgerEntry.count({
        where: { userId, state: { in: CLAIMABLE_STATES } },
      }),
      profile.githubUsername
        ? prisma.pendingReward.count({
            where: {
              githubUsername: {
                equals: profile.githubUsername,
                mode: "insensitive",
              },
              status: "claimable",
            },
          })
        : Promise.resolve(0),
    ]);

    const sourceByProvider = new Map<string, (typeof sourceRows)[number]>();
    for (const row of sourceRows) {
      const provider = row.provider.toLowerCase();
      if (!sourceByProvider.has(provider)) sourceByProvider.set(provider, row);
    }
    const githubSource = sourceByProvider.get("github");
    const githubAppSource = sourceByProvider.get("github_app");
    const githubConfigured = Boolean(profile.githubUsername || profile.githubId || githubSource);
    const githubState = mapPersistedReadinessState({
      configured: githubConfigured,
      status: githubSource?.status ?? (githubConfigured ? "connected" : null),
      expiresAt: githubSource?.authExpiresAt,
      lastSuccessfulAt: githubSource?.lastSyncedAt ?? profile.updatedAt,
    });
    const githubAccount =
      maskAccount(
        githubSource?.displayLabel ??
          githubSource?.externalAccountId ??
          profile.githubUsername,
      ) ?? null;
    const githubPersonal = resource({
      state: githubState,
      label: "GitHub identity",
      account: githubAccount,
      lastSuccessfulAt: githubSource?.lastSyncedAt ?? profile.updatedAt,
      errorCode: githubState === "sync_failed" ? "github_identity_sync_failed" : null,
    });
    const appState = mapPersistedReadinessState({
      configured: Boolean(githubAppSource),
      status: githubAppSource?.status,
      expiresAt: githubAppSource?.authExpiresAt,
      lastSuccessfulAt: githubAppSource?.lastSyncedAt,
    });
    const repositoryAccess = resource({
      state: appState,
      label: "GitHub repository access",
      account: githubAppSource?.displayLabel ?? githubAppSource?.externalAccountId ?? null,
      lastSuccessfulAt: githubAppSource?.lastSyncedAt,
      errorCode:
        appState === "permission_missing"
          ? "github_repository_permission_missing"
          : appState === "sync_failed"
            ? "github_repository_access_failed"
            : null,
    });
    const repositorySync = resource({
      state:
        appState === "connected" && githubAppSource?.lastSyncedAt
          ? "connected"
          : appState === "connected"
            ? "stale"
            : appState,
      label: "Repository synchronization",
      account: githubAppSource?.displayLabel ?? null,
      lastSuccessfulAt: githubAppSource?.lastSyncedAt,
      errorCode:
        appState === "connected" && !githubAppSource?.lastSyncedAt
          ? "github_repository_sync_pending"
          : repositoryAccess.errorCode,
    });

    const normalizedSources = sourceRows.map((row) => {
      const state = mapPersistedReadinessState({
        configured: true,
        status: row.status,
        expiresAt: row.authExpiresAt,
        lastSuccessfulAt: row.lastSyncedAt,
      });
      return {
        id: row.id,
        provider: row.provider,
        ...resource({
          state,
          label: row.provider.replaceAll("_", " "),
          account: row.displayLabel ?? row.externalAccountId,
          lastSuccessfulAt: row.lastSyncedAt,
          errorCode: state === "sync_failed" ? `${row.provider}_sync_failed` : null,
        }),
      };
    });

    const legacyAppAddress = profile.walletAddress?.trim().toLowerCase() ?? null;
    const legacyConnectedAddress = profile.scanWalletAddress?.trim().toLowerCase() ?? null;
    const normalizedApp =
      walletRows.find((row) => row.ownerType === "user" && row.custodyType !== "external")
        ?.address ?? legacyAppAddress;
    const normalizedConnected =
      walletRows.find((row) => row.custodyType === "external")?.address ??
      legacyConnectedAddress;
    const requestedKind =
      profile.selectedCapitalWallet === "connected" ? "connected" : "app";
    const selectedKind =
      requestedKind === "connected" && normalizedConnected ? "connected" : "app";
    const selectedAddress =
      selectedKind === "connected" ? normalizedConnected : normalizedApp;
    const appWalletState = normalizedApp ? "connected" : "not_configured";
    const connectedWalletState = normalizedConnected ? "connected" : "not_configured";
    const payoutState = mapPersistedReadinessState({
      configured: Boolean(payout),
      status: payout?.status,
      lastSuccessfulAt: payout?.verifiedAt ?? payout?.updatedAt,
    });
    const balanceMicroUsdc =
      selectedAddress && Number.isFinite(profile.availableUsd)
        ? String(Math.max(0, Math.round(profile.availableUsd * 1_000_000)))
        : null;

    const capabilities = [
      githubConfigured ? "personal_github" : null,
      appState === "connected" ? "repository_access" : null,
      installs.length ? "community_operator" : null,
      programs.length ? "program_operator" : null,
      selectedAddress ? "capital_wallet" : null,
      payoutState === "connected" ? "receive_payout" : null,
      selectedAddress && profile.availableUsd > 0 ? "fund" : null,
      claimableLedger + pendingRewards > 0 ? "claim" : null,
    ].filter((value): value is string => Boolean(value));
    const now = new Date().toISOString();
    const payload: WorkspaceReadiness = {
      schemaVersion: 1,
      userId,
      computedAt: now,
      lastSuccessfulAt: now,
      stale: false,
      failure: null,
      user: { email: profile.email, displayName: profile.displayName },
      identities: {
        github: githubPersonal,
        verifiedCount: verifiedIdentityCount,
      },
      github: {
        personal: githubPersonal,
        repositoryAccess,
        repositorySync,
      },
      sources: normalizedSources,
      communities: installs.map((row) => ({
        id: row.id,
        slug: row.communitySlug,
        role: "operator",
        status: row.status,
      })),
      programs: programs.map((row) => ({
        id: row.id,
        name: row.name,
        communitySlug: row.install.communitySlug,
        role: "operator",
        status: row.status,
      })),
      wallets: {
        app: { state: appWalletState, address: normalizedApp, selected: selectedKind === "app" },
        connected: {
          state: connectedWalletState,
          address: normalizedConnected,
          selected: selectedKind === "connected",
        },
        selectedKind,
        selectedAddress,
        payout: {
          ...resource({
            state: payoutState,
            label: "Payout destination",
            account: maskAccount(payout?.address),
            lastSuccessfulAt: payout?.verifiedAt ?? payout?.updatedAt,
            errorCode: payoutState === "sync_failed" ? "payout_destination_failed" : null,
          }),
          address: payout?.address ?? null,
          network: payout?.network ?? null,
        },
        lastConfirmedBalanceMicroUsdc: balanceMicroUsdc,
        lastConfirmedBalanceAt: balanceMicroUsdc ? profile.updatedAt.toISOString() : null,
      },
      capital: {
        state: selectedAddress ? "connected" : "not_configured",
        pendingAuthorizations,
        claimableRecords: claimableLedger + pendingRewards,
      },
      capabilities,
    };
    const validated = workspaceReadinessSchema.parse(payload);
    await prisma.workspaceReadinessSnapshot.upsert({
      where: { userId },
      create: {
        userId,
        payload: validated as unknown as Prisma.InputJsonValue,
        computedAt: new Date(validated.computedAt),
        lastSuccessfulAt: new Date(validated.lastSuccessfulAt),
      },
      update: {
        payload: validated as unknown as Prisma.InputJsonValue,
        computedAt: new Date(validated.computedAt),
        lastSuccessfulAt: new Date(validated.lastSuccessfulAt),
        lastFailureCode: null,
        lastFailureAt: null,
      },
    });
    return validated;
  } catch (error) {
    const code =
      error instanceof Error && /^[a-z0-9_]{3,80}$/i.test(error.message)
        ? error.message.toLowerCase()
        : "workspace_readiness_refresh_failed";
    console.error("[workspace-readiness]", { correlationId, userId, code });
    const previous = await readWorkspaceReadinessSnapshot(userId).catch(() => null);
    if (previous) {
      await prisma.workspaceReadinessSnapshot
        .update({
          where: { userId },
          data: { lastFailureCode: code, lastFailureAt: new Date() },
        })
        .catch(() => null);
      return withStaleReadiness(previous, {
        code,
        correlationId,
        occurredAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}

export async function loadWorkspaceReadiness(userId: string): Promise<WorkspaceReadiness> {
  const snapshot = await readWorkspaceReadinessSnapshot(userId).catch(() => null);
  if (snapshot) {
    const age = Date.now() - new Date(snapshot.computedAt).getTime();
    if (age <= FRESH_FOR_MS || snapshot.stale) return snapshot;
    return { ...snapshot, stale: true };
  }
  return refreshWorkspaceReadiness(userId);
}
