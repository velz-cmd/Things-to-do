import { z } from "zod";

export const WORKSPACE_READINESS_STATES = [
  "not_configured",
  "connected",
  "syncing",
  "stale",
  "permission_missing",
  "sync_failed",
  "disconnected",
  "revoked",
  "unavailable",
] as const;

export type WorkspaceReadinessState = (typeof WORKSPACE_READINESS_STATES)[number];

const stateSchema = z.enum(WORKSPACE_READINESS_STATES);

const resourceSchema = z.object({
  state: stateSchema,
  label: z.string(),
  account: z.string().nullable(),
  lastSuccessfulAt: z.string().datetime().nullable(),
  errorCode: z.string().nullable(),
});

const walletSchema = z.object({
  state: stateSchema,
  address: z.string().nullable(),
  selected: z.boolean(),
});

export const workspaceReadinessSchema = z.object({
  schemaVersion: z.literal(1),
  userId: z.string(),
  computedAt: z.string().datetime(),
  lastSuccessfulAt: z.string().datetime(),
  stale: z.boolean(),
  failure: z
    .object({
      code: z.string(),
      correlationId: z.string(),
      occurredAt: z.string().datetime(),
    })
    .nullable(),
  user: z.object({
    email: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  identities: z.object({
    github: resourceSchema,
    verifiedCount: z.number().int().nonnegative(),
  }),
  github: z.object({
    personal: resourceSchema,
    repositoryAccess: resourceSchema,
    repositorySync: resourceSchema,
  }),
  sources: z.array(
    resourceSchema.extend({
      id: z.string(),
      provider: z.string(),
    }),
  ),
  communities: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      role: z.string(),
      status: z.string(),
    }),
  ),
  programs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      communitySlug: z.string(),
      role: z.string(),
      status: z.string(),
    }),
  ),
  wallets: z.object({
    app: walletSchema,
    connected: walletSchema,
    selectedKind: z.enum(["app", "connected"]),
    selectedAddress: z.string().nullable(),
    payout: resourceSchema.extend({
      address: z.string().nullable(),
      network: z.string().nullable(),
    }),
    lastConfirmedBalanceMicroUsdc: z.string().nullable(),
    lastConfirmedBalanceAt: z.string().datetime().nullable(),
  }),
  capital: z.object({
    state: stateSchema,
    pendingAuthorizations: z.number().int().nonnegative(),
    claimableRecords: z.number().int().nonnegative(),
  }),
  capabilities: z.array(z.string()),
});

export type WorkspaceReadiness = z.infer<typeof workspaceReadinessSchema>;
export type WorkspaceReadinessResource = z.infer<typeof resourceSchema>;

export function mapPersistedReadinessState(input: {
  configured: boolean;
  status?: string | null;
  expiresAt?: Date | string | null;
  lastSuccessfulAt?: Date | string | null;
  now?: Date;
}): WorkspaceReadinessState {
  if (!input.configured) return "not_configured";
  const now = input.now ?? new Date();
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= now.getTime()) {
    return "revoked";
  }
  const status = input.status?.trim().toLowerCase() ?? "connected";
  if (["queued", "pending", "fetching", "syncing", "running"].includes(status)) return "syncing";
  if (["permission_missing", "forbidden", "insufficient_scope"].includes(status)) {
    return "permission_missing";
  }
  if (["failed", "sync_failed", "error"].includes(status)) return "sync_failed";
  if (["disconnected", "disabled"].includes(status)) return "disconnected";
  if (["revoked", "expired", "reconnect_required"].includes(status)) return "revoked";
  if (status === "unavailable") return "unavailable";
  if (status === "stale") return "stale";
  if (["connected", "healthy", "completed", "active", "verified"].includes(status)) {
    return "connected";
  }
  return input.lastSuccessfulAt ? "stale" : "unavailable";
}

export function withStaleReadiness(
  previous: WorkspaceReadiness,
  failure: NonNullable<WorkspaceReadiness["failure"]>,
): WorkspaceReadiness {
  const staleResource = <T extends { state: WorkspaceReadinessState }>(resource: T): T => ({
    ...resource,
    state: resource.state === "connected" ? "stale" : resource.state,
  });
  return {
    ...previous,
    stale: true,
    failure,
    identities: {
      ...previous.identities,
      github: staleResource(previous.identities.github),
    },
    github: {
      personal: staleResource(previous.github.personal),
      repositoryAccess: staleResource(previous.github.repositoryAccess),
      repositorySync: staleResource(previous.github.repositorySync),
    },
    sources: previous.sources.map(staleResource),
    wallets: {
      ...previous.wallets,
      app: staleResource(previous.wallets.app),
      connected: staleResource(previous.wallets.connected),
      payout: staleResource(previous.wallets.payout),
    },
    capital: {
      ...previous.capital,
      state: previous.capital.state === "connected" ? "stale" : previous.capital.state,
    },
  };
}

export function maskAccount(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (/^0x[a-f0-9]{40}$/i.test(normalized)) {
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
}
