import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { ensureProfileForUser } from "@/lib/auth/session";
import { ArcRpcUnavailableError } from "@/lib/wallet/arc-usdc-balance";
import { getCachedArcUsdcBalance } from "@/lib/cache/arc-balance-cache";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import { resolveUserWallet, shortWalletAddress, listOnChainReadAddresses } from "@/lib/wallet/resolve-user-wallet";
import { ensureAppWalletForUser } from "@/lib/wallet/app-wallet-service";
import { loadProfileFast } from "@/lib/profile/load-profile-fast";
import { syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import type { CapitalWalletResponse } from "@/lib/capital/wallet-types";
import type { ArcUsdcBalance } from "@/lib/wallet/arc-usdc-balance";

const ARC_CHAIN_ID = 5042002;
const ARC_EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app";

type ProfileLight = {
  id: string;
  email: string | null;
  displayName: string | null;
  walletAddress: string | null;
  scanWalletAddress: string | null;
  githubUsername: string | null;
  listenbrainzUsername: string | null;
  embeddedWallet: boolean;
  availableUsd: number;
  taskMemoryJson: string | null;
  updatedAt: Date;
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
  lastKnownBalance: number | null;
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
  syncStatus: "live" | "cached" | "syncing" | "error" | "unknown" | "no_wallet";
  syncError: string | null;
  account: {
    email: string | null;
    displayName: string | null;
  } | null;
  warnings: string[];
  activity: Array<{
    id: string;
    label: string;
    amountUsd: number | null;
    status: string;
    createdAt: string;
    kind: string;
  }>;
  wallet?: CapitalWalletResponse["wallet"];
  balance?: Extract<CapitalWalletResponse, { ok: true }>["balance"];
  code?: string;
  message?: string;
  walletSlices?: WalletBalanceSlice[];
};

export type WalletBalanceSlice = {
  kind: "app" | "external";
  address: string;
  shortAddress: string;
  onChainUsd: number;
  spendableUsd: number;
  nativeUsdc: string;
  erc20Usdc: string;
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
      githubUsername: true,
      listenbrainzUsername: true,
      embeddedWallet: true,
      availableUsd: true,
      taskMemoryJson: true,
      updatedAt: true,
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
  const [authorizations, walletTransactions] = await Promise.all([
    prisma.paymentAuthorization.findMany({
      where: {
        founderUserId: userId,
        status: { in: ["authorized", "pending_funding", "claimable", "ready_to_settle"] },
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
    }),
    prisma.walletTransaction.findMany({
      where: { userId, status: { in: ["pending", "pending_sync", "syncing"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        label: true,
        amountUsd: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return [
    ...walletTransactions.map((row) => ({
      id: row.id,
      label: row.label ?? "Funding submitted",
      amountUsd: Math.abs(row.amountUsd),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    ...authorizations.map((row) => ({
      id: row.id,
      label: row.contextLabel ?? "Authorized payout",
      amountUsd: row.amountUsd,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);
}

async function getActivity(userId: string): Promise<CapitalStateResponse["activity"]> {
  const [walletRows, timelineRows] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, label: true, amountUsd: true, status: true, createdAt: true },
    }),
    prisma.resolveTimelineEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, eventType: true, title: true, severity: true, createdAt: true },
    }),
  ]);

  return [
    ...walletRows.map((row) => ({
      id: row.id,
      label: row.label ?? row.type,
      amountUsd: row.amountUsd,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      kind: row.type,
    })),
    ...timelineRows.map((row) => ({
      id: row.id,
      label: row.title,
      amountUsd: null,
      status: row.severity,
      createdAt: row.createdAt.toISOString(),
      kind: row.eventType,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatUsd(amount: number): string {
  return roundUsd(amount).toFixed(2);
}

async function readAddressBalanceWithFallback(
  address: string,
  cachedUsd?: number | null,
): Promise<ArcUsdcBalance> {
  try {
    return await getCachedArcUsdcBalance(address);
  } catch {
    if (cachedUsd != null && cachedUsd > 0) {
      return {
        address: address.toLowerCase(),
        chainId: ARC_CHAIN_ID as 5042002,
        nativeUsdc: cachedUsd.toFixed(2),
        erc20Usdc: "0.00",
        totalUsdc: cachedUsd.toFixed(2),
        blockNumber: 0,
        source: "arc_rpc",
        syncedAt: new Date().toISOString(),
      };
    }
    throw new ArcRpcUnavailableError(`Could not read Arc balance for ${address.slice(0, 8)}…`);
  }
}

async function readAggregatedArcBalance(
  addresses: string[],
  cachedByAddress?: Map<string, number>,
): Promise<{ combined: ArcUsdcBalance; perWallet: ArcUsdcBalance[] } | null> {
  const unique = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return null;

  const results = await Promise.allSettled(
    unique.map((addr) =>
      readAddressBalanceWithFallback(addr, cachedByAddress?.get(addr) ?? null),
    ),
  );
  const perWallet = results
    .filter((r): r is PromiseFulfilledResult<ArcUsdcBalance> => r.status === "fulfilled")
    .map((r) => r.value);

  if (!perWallet.length) return null;

  const totalNative = perWallet.reduce((s, b) => s + Number(b.nativeUsdc), 0);
  const totalErc20 = perWallet.reduce((s, b) => s + Number(b.erc20Usdc), 0);
  const totalUsd = perWallet.reduce((s, b) => s + Number(b.totalUsdc), 0);
  const bestBlock = Math.max(...perWallet.map((b) => b.blockNumber), 0);
  const primary =
    perWallet.reduce((best, cur) =>
      Number(cur.totalUsdc) > Number(best.totalUsdc) ? cur : best,
    ) ?? perWallet[0];

  return {
    perWallet,
    combined: {
      ...primary,
      address: primary.address,
      nativeUsdc: formatUsd(totalNative),
      erc20Usdc: formatUsd(totalErc20),
      totalUsdc: formatUsd(totalUsd),
      blockNumber: bestBlock,
      syncedAt: new Date().toISOString(),
    },
  };
}

function cachedBalanceFromProfile(profile: ProfileLight | null): number | null {
  if (!profile) return null;
  const value = Number(profile.availableUsd);
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : null;
}

function buildWalletSlices(input: {
  profile: ProfileLight | null;
  walletResolved: ReturnType<typeof resolveUserWallet>;
  perWallet?: ArcUsdcBalance[];
  reservedUsd: number;
  cachedAppUsd?: number | null;
}): WalletBalanceSlice[] {
  const appAddr =
    input.profile?.walletAddress?.trim().toLowerCase() ?? input.walletResolved.address;
  const extAddr = input.profile?.scanWalletAddress?.trim().toLowerCase();
  const slices: WalletBalanceSlice[] = [];

  const appChain = input.perWallet?.find((b) => b.address === appAddr);
  const appOnChain = appChain ? Number(appChain.totalUsdc) : (input.cachedAppUsd ?? 0);
  slices.push({
    kind: "app",
    address: appAddr,
    shortAddress: shortWalletAddress(appAddr),
    onChainUsd: roundUsd(appOnChain),
    spendableUsd: roundUsd(Math.max(0, appOnChain - input.reservedUsd)),
    nativeUsdc: appChain?.nativeUsdc ?? formatUsd(appOnChain),
    erc20Usdc: appChain?.erc20Usdc ?? "0.00",
  });

  if (extAddr && extAddr !== appAddr) {
    const extChain = input.perWallet?.find((b) => b.address === extAddr);
    const extOnChain = extChain ? Number(extChain.totalUsdc) : 0;
    slices.push({
      kind: "external",
      address: extAddr,
      shortAddress: shortWalletAddress(extAddr),
      onChainUsd: roundUsd(extOnChain),
      spendableUsd: roundUsd(extOnChain),
      nativeUsdc: extChain?.nativeUsdc ?? "0.00",
      erc20Usdc: extChain?.erc20Usdc ?? "0.00",
    });
  }

  return slices;
}

export async function loadCapitalState(
  authUser: SupabaseUser,
  opts: { liveSync?: boolean } = {},
): Promise<CapitalStateResponse> {
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
        githubUsername: ensured.githubUsername,
        listenbrainzUsername: ensured.listenbrainzUsername,
        embeddedWallet: Boolean(ensured.embeddedWallet),
        availableUsd: ensured.availableUsd,
        taskMemoryJson: ensured.taskMemoryJson,
        updatedAt: ensured.updatedAt,
      };
    } catch {
      warnings.push("Could not provision RESOLVE wallet.");
    }
  }

  if (profile && !profile.walletAddress?.trim()) {
    try {
      const full = await loadProfileFast(authUser);
      const ensured = await ensureAppWalletForUser(full);
      profile = {
        id: ensured.id,
        email: ensured.email,
        displayName: ensured.displayName,
        walletAddress: ensured.walletAddress,
        scanWalletAddress: ensured.scanWalletAddress,
        githubUsername: ensured.githubUsername,
        listenbrainzUsername: ensured.listenbrainzUsername,
        embeddedWallet: Boolean(ensured.embeddedWallet),
        availableUsd: ensured.availableUsd,
        taskMemoryJson: ensured.taskMemoryJson,
        updatedAt: ensured.updatedAt,
      };
    } catch {
      warnings.push("Provisioning your Arc wallet…");
    }
  }

  if (profile && opts.liveSync) {
    /* live path syncs after RPC — fast path reads ledger only */
  } else if (profile) {
    void syncIdentityBalance(profile.id).catch(() => null);
  }

  const walletResolved = resolveUserWallet(authUser.id, profile, authUser);
  const onChainAddresses = profile
    ? listOnChainReadAddresses(authUser.id, profile)
    : [walletResolved.address];
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

  const cachedBalance = cachedBalanceFromProfile(profile);
  const cachedSyncedAt = profile?.updatedAt?.toISOString() ?? null;
  const [reservedUsd, programBalances, pendingTransactions, activity, earnings] =
    await Promise.all([
    profile ? getReservedUsd(profile.id).catch(() => 0) : Promise.resolve(0),
    profile ? getProgramBalances(profile.id).catch(() => []) : Promise.resolve([]),
    profile ? getPendingTransactions(profile.id).catch(() => []) : Promise.resolve([]),
    profile ? getActivity(profile.id).catch(() => []) : Promise.resolve([]),
    profile
      ? getProfileEarningsSummary({ profile }).catch(() => ({
          claimableUsd: 0,
          authorizedUsd: 0,
          settledUsd: 0,
          youEarnedUsd: 0,
          pendingUsd: 0,
          authorizationCount: 0,
          identities: [],
          stalestClaimableAt: null,
          notifyUrgency: 0,
          githubLinked: false,
        }))
      : Promise.resolve({
          claimableUsd: 0,
          authorizedUsd: 0,
          settledUsd: 0,
          youEarnedUsd: 0,
          pendingUsd: 0,
          authorizationCount: 0,
          identities: [],
          stalestClaimableAt: null,
          notifyUrgency: 0,
          githubLinked: false,
        }),
  ]);
  const claimableAmount = Math.round((earnings.claimableUsd ?? 0) * 100) / 100;

  if (!walletResolved.address) {
    return {
      ok: false,
      ...base,
      usdcBalance: null,
      spendableBalance: null,
      lastKnownBalance: cachedBalance,
      programBalances,
      pendingTransactions,
      claimableAmount,
      lastSyncedAt: cachedSyncedAt,
      syncStatus: "no_wallet",
      syncError: "Connect an Arc wallet in Profile or Capital to fund programs.",
      activity,
      code: "WALLET_NOT_FOUND",
      message: "Connect an Arc wallet in Profile or Capital to fund programs.",
    };
  }

  if (!opts.liveSync) {
    const fastBalance = cachedBalance ?? 0;
    const walletSlices = buildWalletSlices({
      profile,
      walletResolved,
      reservedUsd,
      cachedAppUsd: fastBalance,
    });
    return {
      ok: true,
      ...base,
      usdcBalance: fastBalance,
      spendableBalance: fastBalance,
      lastKnownBalance: cachedBalance,
      treasuryBalance: fastBalance,
      programBalances,
      pendingTransactions,
      claimableAmount,
      lastSyncedAt: cachedSyncedAt,
      syncStatus: cachedBalance !== null ? "cached" : "unknown",
      syncError: cachedBalance !== null ? null : "Live Arc balance is syncing in the background.",
      activity,
      walletSlices,
      wallet: {
        address: walletResolved.address,
        shortAddress: shortWalletAddress(walletResolved.address),
        source: walletResolved.source,
        provider: walletProvider === "circle" ? "circle" : "embedded",
        ...(walletResolved.externalAddress ? { externalAddress: walletResolved.externalAddress } : {}),
      },
      balance: {
        totalUsdc: fastBalance.toFixed(2),
        onChainUsd: fastBalance.toFixed(2),
        nativeUsdc: fastBalance.toFixed(2),
        erc20Usdc: "0.00",
        chainId: ARC_CHAIN_ID,
        blockNumber: 0,
        syncedAt: cachedSyncedAt ?? new Date().toISOString(),
        reservedUsd,
        spendableUsd: fastBalance.toFixed(2),
      },
    };
  }

  try {
    const cachedByAddress = new Map<string, number>();
    const appAddr =
      profile?.walletAddress?.trim().toLowerCase() ?? walletResolved.address;
    const extAddr = profile?.scanWalletAddress?.trim().toLowerCase();
    if (appAddr && cachedBalance != null) cachedByAddress.set(appAddr, cachedBalance);
    const aggregated = await readAggregatedArcBalance(onChainAddresses, cachedByAddress);
    if (!aggregated) {
      throw new ArcRpcUnavailableError("Arc RPC did not return a balance for your wallet(s).");
    }

    const { combined: chainBalance, perWallet } = aggregated;
    const appChain = perWallet.find((b) => b.address === appAddr);
    const extChain = extAddr ? perWallet.find((b) => b.address === extAddr) : undefined;
    const appOnChain = appChain ? Number(appChain.totalUsdc) : 0;
    const extOnChain = extChain ? Number(extChain.totalUsdc) : 0;
    const totalOnChain = Number(chainBalance.totalUsdc);
    const appSpendable = Math.max(0, appOnChain - reservedUsd);
    const spendable = roundUsd(appSpendable + extOnChain);
    const walletSlices = buildWalletSlices({
      profile,
      walletResolved,
      perWallet,
      reservedUsd,
    });

    if (profile) {
      await syncIdentityBalance(profile.id).catch(() => null);
    }

    return {
      ok: true,
      ...base,
      usdcBalance: Number.isFinite(totalOnChain) ? totalOnChain : 0,
      spendableBalance: spendable,
      lastKnownBalance: cachedBalance,
      treasuryBalance: totalOnChain,
      programBalances,
      pendingTransactions,
      claimableAmount,
      lastSyncedAt: chainBalance.syncedAt,
      syncStatus: "live",
      syncError: null,
      activity,
      walletSlices,
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
    const message = cachedBalance !== null
      ? "Using last known Arc balance."
      : "Arc balance is still syncing. Refresh Capital before funding.";
    const walletSlices = buildWalletSlices({
      profile,
      walletResolved,
      reservedUsd,
      cachedAppUsd: cachedBalance ?? 0,
    });
    return {
      ok: true,
      ...base,
      usdcBalance: cachedBalance ?? 0,
      spendableBalance: cachedBalance ?? 0,
      lastKnownBalance: cachedBalance,
      programBalances,
      pendingTransactions,
      claimableAmount,
      lastSyncedAt: cachedSyncedAt,
      syncStatus: cachedBalance !== null ? "cached" : "error",
      syncError: message,
      activity,
      walletSlices,
      code: e instanceof ArcRpcUnavailableError ? e.code : "ARC_RPC_UNAVAILABLE",
      message,
      wallet: {
        address: walletResolved.address,
        shortAddress: shortWalletAddress(walletResolved.address),
        source: walletResolved.source,
        provider: walletProvider === "circle" ? "circle" : "embedded",
        ...(walletResolved.externalAddress ? { externalAddress: walletResolved.externalAddress } : {}),
      },
      balance: {
        totalUsdc: (cachedBalance ?? 0).toFixed(2),
        onChainUsd: (cachedBalance ?? 0).toFixed(2),
        nativeUsdc: "0.00",
        erc20Usdc: "0.00",
        chainId: ARC_CHAIN_ID,
        blockNumber: 0,
        syncedAt: cachedSyncedAt ?? new Date().toISOString(),
        reservedUsd,
        spendableUsd: (cachedBalance ?? 0).toFixed(2),
      },
    };
  }
}
