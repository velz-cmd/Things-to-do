import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { loadCapitalState } from "@/lib/capital/state";
import type { ResolvedUserWallets } from "@/lib/wallet/canonical-wallet-registry";

export type CapitalAuthorizationSummary = {
  id: string;
  missionId: string;
  label: string;
  totalMicroUsdc: string;
  obligationCount: number;
  readyPayeeCount: number;
  evidenceCount: number;
  status: string;
  createdAt: string;
};

export type CapitalBootstrap = {
  ok: true;
  wallets: ResolvedUserWallets;
  balances: {
    app: WalletBalanceSlice | null;
    connected: WalletBalanceSlice | null;
    selected: WalletBalanceSlice | null;
    portfolioTotalMicroUsdc: string;
  };
  moneyState: {
    availableMicroUsdc: string;
    reservedMicroUsdc: string;
    committedMicroUsdc: string;
    pendingMicroUsdc: string;
    claimableMicroUsdc: string;
    settledThirtyDayMicroUsdc: string;
  };
  authorizations: CapitalAuthorizationSummary[];
  settlementQueue: Array<{
    id: string;
    communitySlug: string | null;
    status: string;
    totalMicroUsdc: string;
    payeeCount: number;
    submittedAt: string | null;
    confirmedAt: string | null;
    updatedAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    label: string;
    amountMicroUsdc: string | null;
    status: string;
    kind: string;
    createdAt: string;
  }>;
  guardrails: null;
  sync: {
    balanceState: "live" | "recent" | "stale" | "unknown";
    networkHealth: "healthy" | "degraded" | "unavailable" | "unknown";
    lastSuccessfulSyncAt: string | null;
    liveSyncRecommended: boolean;
  };
  generatedAt: string;
};

type WalletBalanceSlice = {
  walletType: "app" | "connected";
  address: `0x${string}`;
  amountMicroUsdc: string;
  availableMicroUsdc: string;
  freshness: "live" | "recent" | "stale" | "unknown";
  readAt: string | null;
};

function usdToMicro(value: number | null | undefined): bigint {
  if (value == null || !Number.isFinite(value)) return 0n;
  return BigInt(Math.max(0, Math.round(value * 1_000_000)));
}

function groupAuthorizations(
  rows: Array<{
    id: string;
    missionId: string;
    contextLabel: string | null;
    amountUsd: number;
    walletAddress: string | null;
    proofHash: string;
    status: string;
    createdAt: Date;
  }>,
): CapitalAuthorizationSummary[] {
  const grouped = new Map<string, CapitalAuthorizationSummary>();
  for (const row of rows) {
    const key = `${row.missionId}:${row.contextLabel ?? "Authorization package"}`;
    const current = grouped.get(key);
    if (current) {
      current.totalMicroUsdc = (
        BigInt(current.totalMicroUsdc) + usdToMicro(row.amountUsd)
      ).toString();
      current.obligationCount += 1;
      current.readyPayeeCount += row.walletAddress ? 1 : 0;
      current.evidenceCount += row.proofHash ? 1 : 0;
      if (row.createdAt < new Date(current.createdAt)) current.createdAt = row.createdAt.toISOString();
    } else {
      grouped.set(key, {
        id: row.missionId,
        missionId: row.missionId,
        label: row.contextLabel ?? "Authorization package",
        totalMicroUsdc: usdToMicro(row.amountUsd).toString(),
        obligationCount: 1,
        readyPayeeCount: row.walletAddress ? 1 : 0,
        evidenceCount: row.proofHash ? 1 : 0,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      });
    }
  }
  return [...grouped.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadCapitalBootstrap(authUser: SupabaseUser): Promise<CapitalBootstrap> {
  const statePromise = loadCapitalState(authUser, { liveSync: false });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
  const [state, authorizationRows, settlementRows, settled] = await Promise.all([
    statePromise,
    prisma.paymentAuthorization.findMany({
      where: {
        founderUserId: authUser.id,
        status: { in: ["authorized", "pending_funding", "claimable", "ready_to_settle"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        missionId: true,
        contextLabel: true,
        amountUsd: true,
        walletAddress: true,
        proofHash: true,
        status: true,
        createdAt: true,
      },
    }).catch(() => []),
    prisma.settlementBatch.findMany({
      where: { userId: authUser.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        communitySlug: true,
        status: true,
        totalUsdcMicro: true,
        payeeCount: true,
        submittedAt: true,
        confirmedAt: true,
        updatedAt: true,
      },
    }).catch(() => []),
    prisma.settlementBatch.aggregate({
      where: { userId: authUser.id, status: "confirmed", confirmedAt: { gte: since } },
      _sum: { totalUsdcMicro: true },
    }).catch(() => ({ _sum: { totalUsdcMicro: null } })),
  ]);

  if (!state.walletRegistry) throw new Error("capital_wallet_registry_missing");
  const freshness =
    state.syncStatus === "live" ? "live"
    : state.syncStatus === "cached" ? "recent"
    : state.lastSyncedAt ? "stale"
    : "unknown";
  const slices = state.walletSlices ?? [];
  const mapSlice = (kind: "app" | "external"): WalletBalanceSlice | null => {
    const slice = slices.find((row) => row.kind === kind);
    if (!slice) return null;
    return {
      walletType: kind === "app" ? "app" : "connected",
      address: slice.address as `0x${string}`,
      amountMicroUsdc: usdToMicro(slice.onChainUsd).toString(),
      availableMicroUsdc: usdToMicro(slice.spendableUsd).toString(),
      freshness,
      readAt: state.lastSyncedAt,
    };
  };
  const app = mapSlice("app");
  const connected = mapSlice("external");
  const selected = state.selectedWallet === "connected" ? connected : app;
  const authorizations = groupAuthorizations(authorizationRows);
  const committed = authorizationRows.reduce((sum, row) => sum + usdToMicro(row.amountUsd), 0n);
  const pending = settlementRows
    .filter((row) => ["prepared", "approved", "submitting", "pending"].includes(row.status))
    .reduce((sum, row) => sum + row.totalUsdcMicro, 0n);

  return {
    ok: true,
    wallets: state.walletRegistry,
    balances: {
      app,
      connected,
      selected,
      portfolioTotalMicroUsdc: usdToMicro(state.portfolioTotalBalance ?? state.treasuryBalance).toString(),
    },
    moneyState: {
      availableMicroUsdc: usdToMicro(state.spendableBalance).toString(),
      reservedMicroUsdc: usdToMicro(state.balance?.reservedUsd).toString(),
      committedMicroUsdc: committed.toString(),
      pendingMicroUsdc: pending.toString(),
      claimableMicroUsdc: usdToMicro(state.claimableAmount).toString(),
      settledThirtyDayMicroUsdc: (settled._sum.totalUsdcMicro ?? 0n).toString(),
    },
    authorizations,
    settlementQueue: settlementRows.map((row) => ({
      id: row.id,
      communitySlug: row.communitySlug,
      status: row.status,
      totalMicroUsdc: row.totalUsdcMicro.toString(),
      payeeCount: row.payeeCount,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
    recentActivity: state.activity.map((row) => ({
      id: row.id,
      label: row.label,
      amountMicroUsdc: row.amountUsd == null ? null : usdToMicro(Math.abs(row.amountUsd)).toString(),
      status: row.status,
      kind: row.kind,
      createdAt: row.createdAt,
    })),
    guardrails: null,
    sync: {
      balanceState: freshness,
      networkHealth: state.networkHealth,
      lastSuccessfulSyncAt: state.lastSyncedAt,
      liveSyncRecommended: freshness === "stale" || freshness === "unknown" || state.pendingTransactions.length > 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
