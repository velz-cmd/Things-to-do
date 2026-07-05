"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { ResolveBanking } from "@/components/resolve/payments/resolve-banking";
import type { BankingAccountSnapshot } from "@/lib/banking/types";
import { normalizeBankingSnapshot } from "@/lib/banking/normalize-snapshot";
import { BANKING_UI } from "@/lib/banking/copy";
import { BANKING_POLICY } from "@/lib/banking/types";
import type {
  CapitalWalletResponse,
  WalletHealth,
  WalletSyncState,
} from "@/lib/capital/wallet-types";

const WALLET_REFRESH_MS = 30_000;
const CLIENT_TIMEOUT_MS = 20_000;
const ARC_CHAIN_ID = 5042002;

type CapitalStatePayload =
  | (Extract<CapitalWalletResponse, { ok: true }> & { claimableAmount?: number })
  | (Extract<CapitalWalletResponse, { ok: false }> & {
      claimableAmount?: number;
      syncStatus?: WalletSyncState | "live" | "cached" | "error" | "unknown" | "no_wallet";
      syncError?: string | null;
      balance?: Extract<CapitalWalletResponse, { ok: true }>["balance"];
    });

type Overview = {
  recentAuthorizations: {
    id: string;
    missionId: string;
    amountUsd: number;
    status: string;
    contextLabel: string | null;
    updatedAt: string;
  }[];
  settlements: {
    id: string;
    missionId: string;
    repo: string | null;
    status: string;
    treasuryAmount: number;
    createdAt: string;
    escrowTxHash: string | null;
  }[];
};

async function fetchCapitalWallet(refresh = true): Promise<CapitalStatePayload> {
  const res = await fetch(refresh ? "/api/capital/state" : "/api/capital/state?fast=1", {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
  });
  return (await res.json()) as CapitalStatePayload;
}

function snapshotFromCapitalWallet(
  data: Extract<CapitalWalletResponse, { ok: true }>,
  userId: string,
  claimableAmount = 0,
): BankingAccountSnapshot {
  const spendable = Number(data.balance.spendableUsd);
  const total = Number(data.balance.totalUsdc);
  const wallet = data.wallet.address;
  const statement = (data.activity ?? []).map((item) => {
    const amount = item.amountUsd ?? 0;
    return {
      id: item.id,
      at: item.createdAt,
      type: item.kind === "fund_program" ? ("program_reserve" as const) : ("adjustment" as const),
      direction: amount < 0 ? ("debit" as const) : ("credit" as const),
      amountUsd: Math.abs(amount),
      balanceAfterUsd: null,
      label: item.label,
      reference: item.status,
    };
  });

  return {
    ok: true,
    signedIn: true,
    accountId: userId,
    displayName: data.account?.displayName ?? null,
    email: data.account?.email ?? null,
    memberSince: new Date().toISOString(),
    walletAddress: wallet,
    walletLabel: data.wallet.shortAddress,
    policy: BANKING_POLICY,
    balances: {
      availableUsd: spendable,
      reservedUsd: data.balance.reservedUsd,
      earnedClaimableUsd: claimableAmount,
      earnedAuthorizedUsd: 0,
      earnedSettledUsd: 0,
      totalDepositedUsd: total,
      onChainUsdcUsd: total,
    },
    programs: [],
    statement,
    network: {
      authorizedUsd: 0,
      claimableUsd: claimableAmount,
      settledUsd: 0,
      pendingFundingUsd: 0,
    },
    arc: {
      chain: "Arc Testnet",
      chainId: data.balance.chainId,
      currency: "USDC",
      usdcGas: true,
      live: data.syncStatus !== "cached",
      canDistribute: false,
      blockers: [],
      message: data.syncStatus === "cached" ? "Showing last known balance" : "Wallet synced from Arc RPC",
      contracts: { usdc: "", memo: "" },
      agentWallet: null,
      settlementWallet: null,
      settlementBalanceUsd: null,
      explorerUrl: "https://testnet.arcscan.app",
      capabilities: {
        identityWallet: true,
        depositArcUsdc: true,
        batchMemoPayouts: true,
        agentNanoPayments: true,
        erc8183Escrow: true,
        cctpBridge: true,
      },
      stats: { nanoPaymentsSettled: 0, recentMemoCount: 0 },
      identityWallet: {
        address: wallet,
        label: data.wallet.shortAddress,
        provider: data.wallet.source === "circle_embedded" ? "circle" : "embedded",
        circleWalletId: null,
        depositAddress: wallet,
        onChainUsdcUsd: total,
      },
      recentMemos: [],
    },
    identities: {
      github: null,
      emailVerified: Boolean(data.account?.email),
      gmailConnected: false,
      gmailOperatorLive: false,
    },
    updatedAt: data.balance.syncedAt,
  };
}

function healthFromResponse(
  data: CapitalWalletResponse,
  syncing: boolean,
): WalletHealth | null {
  const wallet = data.ok ? data.wallet : data.wallet;
  if (!wallet) return null;

  const syncStatus =
    "syncStatus" in data ? data.syncStatus : data.ok ? data.syncStatus : undefined;
  type BalanceShape = Extract<CapitalWalletResponse, { ok: true }>["balance"];
  const balance: BalanceShape | undefined = data.ok
    ? data.balance
    : "balance" in data && data.balance
      ? (data.balance as BalanceShape)
      : undefined;

  const rpcStatus: WalletHealth["rpcStatus"] = syncing
    ? "syncing"
    : syncStatus === "live"
      ? "live"
      : syncStatus === "cached"
        ? "cached"
        : syncStatus === "error"
          ? "error"
          : balance
            ? "cached"
            : "live";

  if (data.ok && data.balance) {
    return {
      address: wallet.address,
      shortAddress: wallet.shortAddress,
      source: wallet.source,
      chainId: data.balance.chainId,
      blockNumber: data.balance.blockNumber,
      syncedAt: data.balance.syncedAt,
      rpcStatus,
      nativeUsdc: data.balance.nativeUsdc,
      erc20Usdc: data.balance.erc20Usdc,
      externalAddress: data.wallet.externalAddress,
    };
  }

  return {
    address: wallet.address,
    shortAddress: wallet.shortAddress,
    source: wallet.source,
    chainId: ARC_CHAIN_ID,
    blockNumber: balance?.blockNumber ?? null,
    syncedAt: balance?.syncedAt ?? null,
    rpcStatus,
    nativeUsdc: balance?.nativeUsdc ?? null,
    erc20Usdc: balance?.erc20Usdc ?? null,
    externalAddress:
      data.ok && data.wallet.externalAddress
        ? data.wallet.externalAddress
        : undefined,
  };
}

function mergeBankingSnapshots(
  live: BankingAccountSnapshot | null,
  meta: BankingAccountSnapshot,
): BankingAccountSnapshot {
  if (!live) return meta;
  return {
    ...meta,
    balances: {
      ...meta.balances,
      availableUsd: live.balances.availableUsd,
      onChainUsdcUsd: live.balances.onChainUsdcUsd ?? meta.balances.onChainUsdcUsd,
      reservedUsd: Math.max(meta.balances.reservedUsd, live.balances.reservedUsd),
      earnedClaimableUsd: Math.max(
        meta.balances.earnedClaimableUsd,
        live.balances.earnedClaimableUsd,
      ),
    },
    walletAddress: live.walletAddress ?? meta.walletAddress,
    arc: {
      ...meta.arc,
      live: live.arc.live,
      identityWallet: live.arc.identityWallet ?? meta.arc.identityWallet,
    },
    statement: meta.statement.length > 0 ? meta.statement : live.statement,
  };
}

export function PaymentsOS() {
  const { user, refreshBalance } = useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();

  const [banking, setBanking] = useState<BankingAccountSnapshot | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [walletSync, setWalletSync] = useState<WalletSyncState>("loading");
  const [walletHealth, setWalletHealth] = useState<WalletHealth | null>(null);
  const [walletWarnings, setWalletWarnings] = useState<string[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const lastLiveBalanceRef = useRef<number | null>(null);

  const fallbackWallet =
    account.appWalletAddress ??
    account.externalWalletAddress ??
    account.walletAddress ??
    null;

  const payoutWallet = walletHealth?.address ?? fallbackWallet;

  useEffect(() => {
    if (!user || !fallbackWallet || walletHealth) return;
    setWalletHealth({
      address: fallbackWallet,
      shortAddress: `${fallbackWallet.slice(0, 6)}...${fallbackWallet.slice(-4)}`,
      source: "server_wallet",
      chainId: ARC_CHAIN_ID,
      blockNumber: null,
      syncedAt: null,
      rpcStatus: "syncing",
      nativeUsdc: null,
      erc20Usdc: null,
    });
  }, [fallbackWallet, user, walletHealth]);

  const applyCapitalResponse = useCallback(
    (capital: CapitalStatePayload, userId: string) => {
      if (!capital.ok) return false;

      const claimable = Number(capital.claimableAmount ?? 0);
      const snap = snapshotFromCapitalWallet(capital, userId, claimable);
      const spendable = Number(capital.balance.spendableUsd);

      if (capital.syncStatus === "live" && Number.isFinite(spendable)) {
        lastLiveBalanceRef.current = spendable;
      } else if (
        lastLiveBalanceRef.current !== null &&
        spendable < lastLiveBalanceRef.current &&
        capital.syncStatus === "cached"
      ) {
        snap.balances.availableUsd = lastLiveBalanceRef.current;
        snap.balances.onChainUsdcUsd = Math.max(
          snap.balances.onChainUsdcUsd ?? 0,
          lastLiveBalanceRef.current,
        );
      }

      setBanking((prev) => (prev ? mergeBankingSnapshots(snap, prev) : snap));
      setWalletHealth(healthFromResponse(capital, false));
      const sync = capital.syncStatus;
      setWalletSync(
        sync === "live"
          ? "synced"
          : sync === "cached"
            ? "cached"
            : sync === "error"
              ? "error"
              : "synced",
      );
      setSyncError(
        sync === "cached" || sync === "error"
          ? (capital.syncError ?? null)
          : null,
      );
      setWalletWarnings(capital.warnings);
      setLastRefreshedAt(new Date(capital.balance.syncedAt));
      void refreshBalance().catch(() => null);
      return true;
    },
    [refreshBalance],
  );

  const loadWallet = useCallback(
    async (opts?: { silent?: boolean; refresh?: boolean }) => {
      if (!user) {
        setBanking(null);
        setWalletSync("no_wallet");
        setWalletHealth(null);
        setSyncError(null);
        return;
      }

      if (!opts?.silent) {
        setRefreshing(true);
        setWalletSync("loading");
      }

      try {
        const capital = await fetchCapitalWallet(opts?.refresh !== false);

        if (applyCapitalResponse(capital, user.id)) {
          return;
        }

        if (!capital.ok && capital.code === "WALLET_NOT_FOUND") {
          await fetch("/api/wallet/provision", { method: "POST", credentials: "include" }).catch(
            () => null,
          );
          const retry = await fetchCapitalWallet(true);
          if (applyCapitalResponse(retry, user.id)) {
            return;
          }
          setWalletSync("no_wallet");
          setSyncError(capital.message);
          setWalletHealth(null);
        } else if (!capital.ok) {
          setWalletSync("error");
          setSyncError(capital.message);
          setWalletHealth(healthFromResponse(capital, false));
        } else {
          setWalletSync("error");
          setSyncError("Could not load wallet state.");
        }
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        setWalletSync(lastLiveBalanceRef.current !== null ? "cached" : "error");
        setSyncError(
          aborted
            ? "Balance sync timed out — showing last known balance."
            : "Could not sync Arc balance. Retry sync or check wallet connection.",
        );
        if (fallbackWallet) {
          setWalletHealth({
            address: fallbackWallet,
            shortAddress: `${fallbackWallet.slice(0, 6)}…${fallbackWallet.slice(-4)}`,
            source: "server_wallet",
            chainId: ARC_CHAIN_ID,
            blockNumber: null,
            syncedAt: null,
            rpcStatus: lastLiveBalanceRef.current !== null ? "cached" : "error",
            nativeUsdc: null,
            erc20Usdc: null,
          });
        }
        if (lastLiveBalanceRef.current !== null) {
          setBanking((prev) =>
            prev
              ? {
                  ...prev,
                  balances: {
                    ...prev.balances,
                    availableUsd: lastLiveBalanceRef.current!,
                  },
                }
              : prev,
          );
        }
      } finally {
        setRefreshing(false);
      }
    },
    [applyCapitalResponse, fallbackWallet, user],
  );

  const loadBankingMeta = useCallback(async () => {
    if (!user) return;

    try {
      const bankRes = await fetch("/api/banking/account?light=1", {
        credentials: "include",
        signal: AbortSignal.timeout(20_000),
      });
      if (!bankRes.ok) return;

      const raw = await bankRes.json();
      const snapshot = normalizeBankingSnapshot(raw);
      if (!snapshot) return;

      setBanking((prev) => mergeBankingSnapshots(prev, snapshot));
    } catch {
      /* earnings/activity metadata is optional */
    }
  }, [user]);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    try {
      const ovRes = await fetch("/api/payments/overview", {
        credentials: "include",
        signal: AbortSignal.timeout(12_000),
      });
      if (ovRes.ok) {
        const ov = await ovRes.json();
        setOverview({
          settlements: ov.settlements ?? [],
          recentAuthorizations: ov.recentAuthorizations ?? [],
        });
      }
    } catch {
      /* optional */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void loadWallet({ silent: false, refresh: true });
    void loadBankingMeta();
    void loadOverview();
    const t = setInterval(
      () => void loadWallet({ silent: true, refresh: true }),
      WALLET_REFRESH_MS,
    );
    return () => clearInterval(t);
  }, [loadBankingMeta, loadOverview, loadWallet, user]);

  async function handleClaim() {
    if (!payoutWallet) {
      toast.error("No wallet on your account — sign in again or contact support");
      return;
    }
    const claimable = banking?.balances?.earnedClaimableUsd ?? 0;
    if (claimable <= 0) {
      toast.message(BANKING_UI.claimNothing);
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: payoutWallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      const total = data.totalUsd ?? 0;
      const claimed = Array.isArray(data.claimed) ? data.claimed : [];
      const settled = claimed.filter((c: { status?: string }) => c.status === "settled");
      if (total <= 0 || settled.length === 0) {
        toast.message(data.error ?? BANKING_UI.claimNothing);
        return;
      }
      toast.success(`${BANKING_UI.claimSuccess} — $${total.toFixed(2)}`);
      void loadWallet({ silent: true, refresh: true });
      void loadBankingMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  const settlements = useMemo(() => {
    const rows = [
      ...(overview?.settlements.map((s) => ({
        id: s.id,
        label: s.repo ?? s.missionId,
        amountUsd: s.treasuryAmount,
        txHash: s.escrowTxHash,
        status: s.status,
        at: s.createdAt,
        kind: "settlement" as const,
      })) ?? []),
      ...(overview?.recentAuthorizations.slice(0, 12).map((a) => ({
        id: a.id,
        label: a.contextLabel ?? a.missionId,
        amountUsd: a.amountUsd,
        txHash: null,
        status: a.status,
        at: a.updatedAt,
        kind: "authorization" as const,
      })) ?? []),
    ];
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [overview]);

  const balanceKnown =
    walletSync === "synced" ||
    walletSync === "cached" ||
    lastLiveBalanceRef.current !== null ||
    Boolean(fallbackWallet);

  return (
    <ResolveBanking
      account={banking}
      settlements={settlements}
      initialLoading={walletSync === "loading" && !fallbackWallet && !banking}
      refreshing={refreshing}
      signedIn={Boolean(user)}
      payoutWallet={payoutWallet}
      claiming={claiming}
      lastRefreshedAt={lastRefreshedAt}
      walletSync={walletSync}
      balanceKnown={balanceKnown}
      syncError={syncError}
      walletHealth={walletHealth}
      walletWarnings={walletWarnings}
      onClaim={() => void handleClaim()}
      onRefresh={() => void loadWallet({ silent: false, refresh: true })}
      onSignIn={openSignIn}
      onActivityOpen={() => void loadOverview()}
    />
  );
}
