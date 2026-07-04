import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { ensureProfileForUser } from "@/lib/auth/session";
import { ArcRpcUnavailableError, getArcUsdcBalance } from "@/lib/wallet/arc-usdc-balance";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import { resolveUserWallet, shortWalletAddress } from "@/lib/wallet/resolve-user-wallet";
import { syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import type { CapitalWalletResponse } from "@/lib/capital/wallet-types";

const ARC_CHAIN_ID = 5042002;
const ARC_EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app";

type ProfileLight = {
  id: string;
  email: string | null;
  displayName: string | null;
  walletAddress: string | null;
  scanWalletAddress: string | null;
  embeddedWallet: boolean;
  taskMemoryJson: string | null;
};

export type CapitalStateResponse = {
  ok: boolean;
  walletConnected: boolean;
  walletAddress: string | null;
  shortWalletAddress: string | null;
  walletSource: string | null;
  walletProvider?: "circle" | "embedded";
  arcNetwork: {
    name: "Arc Testnet";
    chainId: number;
    currency: "USDC";
    explorerUrl: string;
  };
  usdcBalance: number | null;
  spendableBalance: number | null;
  treasuryBalance: number;
  programBalances: Array<{
    id: string;
    name: string;
    status: string;
    balanceUsd: number;
  }>;
  pendingTransactions: Array<{
    id: string;
    label: string;
    amountUsd: number;
    status: string;
    createdAt: string;
  }>;
  claimableAmount: number;
  lastSyncedAt: string | null;
  syncStatus: "synced" | "error" | "no_wallet";
  syncError: string | null;
  account: {
    email: string | null;
    displayName: string | null;
  } | null;
  warnings: string[];
  wallet?: CapitalWalletResponse["wallet"];
  balance?: Extract<CapitalWalletResponse, { ok: true }>["balance"];
  code?: string;
  message?: string;
};

async function loadProfileLight(userId: string): Promise<ProfileLight | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      walletAddress: true,
      scanWalletAddress: true,
      embeddedWallet: true,
      taskMemoryJson: true,
    },
  });
}

async function getReservedUsd(userId: string): Promise<number> {
  const programs = await prisma.resolveProgram.findMany({
    where: { userId, status: { in: ["active", "deployed"] }, missionId: { not: null } },
    select: { missionId: true },
  });
  const missionIds = programs.map((p) => p.missionId!).filter(Boolean);
  if (!missionIds.length) return 0;

  const agg = await prisma.paymentAuthorization.aggregate({
    where: { founderUserId: userId, missionId: { in: missionIds }, status: "claimable" },
    _sum: { amountUsd: true },
  });
  return Math.round((agg._sum.amountUsd ?? 0) * 100) / 100;
}

async function getProgramBalances(userId: string) {
  const programs = await prisma.resolveProgram.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      status: true,
      budgetUsd: true,
    },
  });
  return programs.map((program) => ({
    id: program.id,
    name: program.name,
    status: program.status,
    balanceUsd: Math.round(program.budgetUsd * 100) / 100,
  }));
}

async function getPendingTransactions(userId: string) {
  const rows = await prisma.paymentAuthorization.findMany({
    where: {
      founderUserId: userId,
      status: { in: ["authorized", "pending_funding", "claimable"] },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      contextLabel: true,
      amountUsd: true,
      status: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.contextLabel ?? "Authorized payout",
    amountUsd: row.amountUsd,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function loadCapitalState(authUser: SupabaseUser): Promise<CapitalStateResponse> {
  const warnings: string[] = [];
  let profile = await loadProfileLight(authUser.id);

  if (!profile) {
    try {
      const ensured = await ensureProfileForUser(authUser);
      profile = {
        id: ensured.id,
        email: ensured.email,
        displayName: ensured.displayName,
        walletAddress: ensured.walletAddress,
        scanWalletAddress: ensured.scanWalletAddress,
        embeddedWallet: Boolean(ensured.embeddedWallet),
        taskMemoryJson: ensured.taskMemoryJson,
      };
    } catch {
      warnings.push("Could not provision RESOLVE wallet.");
    }
  }

  if (profile) {
    await syncIdentityBalance(profile.id).catch(() => null);
  }

  const walletResolved = resolveUserWallet(authUser.id, profile, authUser);
  const walletProvider =
    profile ? appWalletProvider(profile as Parameters<typeof appWalletProvider>[0]) : "embedded";
  const base = {
    walletConnected: Boolean(walletResolved.address),
    walletAddress: walletResolved.address,
    shortWalletAddress: shortWalletAddress(walletResolved.address),
    walletSource: walletResolved.source,
    walletProvider: walletProvider === "circle" ? ("circle" as const) : ("embedded" as const),
    arcNetwork: {
      name: "Arc Testnet" as const,
      chainId: ARC_CHAIN_ID,
      currency: "USDC" as const,
      explorerUrl: ARC_EXPLORER_URL,
    },
    treasuryBalance: 0,
    account: {
      email: profile?.email ?? authUser.email ?? null,
      displayName:
        profile?.displayName ??
        (authUser.user_metadata?.full_name as string | undefined) ??
        authUser.email?.split("@")[0] ??
        null,
    },
    warnings,
  };

  try {
    const [chainBalance, reservedUsd, programBalances, pendingTransactions] = await Promise.all([
      getArcUsdcBalance(walletResolved.address),
      profile ? getReservedUsd(profile.id).catch(() => 0) : Promise.resolve(0),
      profile ? getProgramBalances(profile.id).catch(() => []) : Promise.resolve([]),
      profile ? getPendingTransactions(profile.id).catch(() => []) : Promise.resolve([]),
    ]);
    const total = Number(chainBalance.totalUsdc);
    const spendable = Math.max(0, total - reservedUsd);

    return {
      ok: true,
      ...base,
      usdcBalance: Number.isFinite(total) ? total : 0,
      spendableBalance: spendable,
      treasuryBalance: total,
      programBalances,
      pendingTransactions,
      claimableAmount: 0,
      lastSyncedAt: chainBalance.syncedAt,
      syncStatus: "synced",
      syncError: null,
      wallet: {
        address: walletResolved.address,
        shortAddress: shortWalletAddress(walletResolved.address),
        source: walletResolved.source,
        provider: walletProvider === "circle" ? "circle" : "embedded",
        ...(walletResolved.externalAddress ? { externalAddress: walletResolved.externalAddress } : {}),
      },
      balance: {
        totalUsdc: chainBalance.totalUsdc,
        onChainUsd: chainBalance.totalUsdc,
        nativeUsdc: chainBalance.nativeUsdc,
        erc20Usdc: chainBalance.erc20Usdc,
        chainId: chainBalance.chainId,
        blockNumber: chainBalance.blockNumber,
        syncedAt: chainBalance.syncedAt,
        reservedUsd,
        spendableUsd: spendable.toFixed(2),
      },
    };
  } catch (e) {
    const message =
      e instanceof ArcRpcUnavailableError
        ? e.message
        : "Could not sync Arc balance. Retry sync or check wallet connection.";
    return {
      ok: false,
      ...base,
      usdcBalance: null,
      spendableBalance: null,
      programBalances: profile ? await getProgramBalances(profile.id).catch(() => []) : [],
      pendingTransactions: profile ? await getPendingTransactions(profile.id).catch(() => []) : [],
      claimableAmount: 0,
      lastSyncedAt: null,
      syncStatus: "error",
      syncError: message,
      code: e instanceof ArcRpcUnavailableError ? e.code : "ARC_RPC_UNAVAILABLE",
      message,
      wallet: {
        address: walletResolved.address,
        shortAddress: shortWalletAddress(walletResolved.address),
        source: walletResolved.source,
      },
    };
  }
}
