"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const REFRESH_INTERVAL_MS = 15_000;
const ARC_CHAIN_ID = 5042002;

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

async function fetchCapitalWallet(): Promise<CapitalWalletResponse> {
  const res = await fetch("/api/capital/wallet", {
    credentials: "include",
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await res.json()) as CapitalWalletResponse;
  return data;
}

function snapshotFromCapitalWallet(
  data: Extract<CapitalWalletResponse, { ok: true }>,
  userId: string,
): BankingAccountSnapshot {
  const spendable = Number(data.balance.spendableUsd);
  const total = Number(data.balance.totalUsdc);
  const wallet = data.wallet.address;

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
      earnedClaimableUsd: 0,
      earnedAuthorizedUsd: 0,
      earnedSettledUsd: 0,
      totalDepositedUsd: total,
      onChainUsdcUsd: total,
    },
    programs: [],
    statement: [],
    network: {
      authorizedUsd: 0,
      claimableUsd: 0,
      settledUsd: 0,
      pendingFundingUsd: 0,
    },
    arc: {
      chain: "Arc Testnet",
      chainId: data.balance.chainId,
      currency: "USDC",
      usdcGas: true,
      live: true,
      canDistribute: false,
      blockers: [],
      message: "Wallet synced from Arc RPC",
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
  if (!data.ok && !data.wallet) return null;
  const wallet = data.ok ? data.wallet : data.wallet!;
  if (data.ok) {
    return {
      address: wallet.address,
      shortAddress: wallet.shortAddress,
      source: wallet.source,
      chainId: data.balance.chainId,
      blockNumber: data.balance.blockNumber,
      syncedAt: data.balance.syncedAt,
      rpcStatus: syncing ? "syncing" : "live",
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
    blockNumber: null,
    syncedAt: null,
    rpcStatus: syncing ? "syncing" : "error",
    nativeUsdc: null,
    erc20Usdc: null,
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

  const payoutWallet =
    walletHealth?.address ??
    account.appWalletAddress ??
    account.walletAddress ??
    account.externalWalletAddress ??
    null;

  const loadWallet = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) {
        setBanking(null);
        setWalletSync("no_wallet");
        setWalletHealth(null);
        setSyncError(null);
        return;
      }

      if (!opts?.silent) setRefreshing(true);
      if (!opts?.silent) setWalletSync("loading");

      try {
        const capital = await fetchCapitalWallet();

        if (capital.ok) {
          const snap = snapshotFromCapitalWallet(capital, user.id);
          setBanking(snap);
          setWalletHealth(healthFromResponse(capital, false));
          setWalletSync("synced");
          setSyncError(null);
          setWalletWarnings(capital.warnings);
          setLastRefreshedAt(new Date(capital.balance.syncedAt));
          void refreshBalance();
        } else if (capital.code === "WALLET_NOT_FOUND") {
          setWalletSync("no_wallet");
          setSyncError(capital.message);
          setWalletHealth(null);
        } else {
          setWalletSync("error");
          setSyncError(capital.message);
          setWalletHealth(healthFromResponse(capital, false));
          if (capital.wallet) {
            setBanking((prev) =>
              prev ?
                {
                  ...prev,
                  walletAddress: capital.wallet!.address,
                  arc: {
                    ...prev.arc,
                    identityWallet: {
                      address: capital.wallet!.address,
                      label: capital.wallet!.shortAddress,
                      provider: "embedded",
                      circleWalletId: null,
                      depositAddress: capital.wallet!.address,
                      onChainUsdcUsd: null,
                    },
                  },
                  balances: {
                    ...prev.balances,
                    onChainUsdcUsd: null,
                  },
                }
              : null,
            );
          }
        }
      } catch {
        setWalletSync("error");
        setSyncError("Could not sync Arc balance. Try again.");
        if (payoutWallet) {
          setWalletHealth({
            address: payoutWallet,
            shortAddress: `${payoutWallet.slice(0, 6)}…${payoutWallet.slice(-4)}`,
            source: "server_wallet",
            chainId: ARC_CHAIN_ID,
            blockNumber: null,
            syncedAt: null,
            rpcStatus: "error",
            nativeUsdc: null,
            erc20Usdc: null,
          });
        }
      } finally {
        setRefreshing(false);
      }
    },
    [payoutWallet, refreshBalance, user],
  );

  const loadBankingMeta = useCallback(async () => {
    if (!user) return;

    try {
      const bankRes = await fetch("/api/banking/account", {
        credentials: "include",
        signal: AbortSignal.timeout(18_000),
      });
      if (!bankRes.ok) {
        setWalletWarnings((w) =>
          w.includes("Account metadata unavailable") ? w : [...w, "Account metadata unavailable"],
        );
        return;
      }
      const raw = await bankRes.json();
      const snapshot = normalizeBankingSnapshot(raw);
      if (!snapshot) return;

      setBanking((prev) => {
        if (!prev || walletSync !== "synced") return snapshot;
        return {
          ...snapshot,
          balances: {
            ...snapshot.balances,
            availableUsd: prev.balances.availableUsd,
            onChainUsdcUsd: prev.balances.onChainUsdcUsd,
            reservedUsd: Math.max(snapshot.balances.reservedUsd, prev.balances.reservedUsd),
          },
          walletAddress: prev.walletAddress ?? snapshot.walletAddress,
          arc: {
            ...snapshot.arc,
            identityWallet: prev.arc.identityWallet ?? snapshot.arc.identityWallet,
          },
        };
      });
    } catch {
      setWalletWarnings((w) =>
        w.includes("Account metadata unavailable") ? w : [...w, "Account metadata unavailable"],
      );
    }
  }, [user, walletSync]);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    try {
      const ovRes = await fetch("/api/payments/overview", {
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
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

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      await loadWallet(opts);
      void loadBankingMeta();
      void loadOverview();
    },
    [loadWallet, loadBankingMeta, loadOverview],
  );

  useEffect(() => {
    if (!user) return;
    void load({ silent: false });
    const t = setInterval(() => void load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load, user]);

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
      void load({ silent: true });
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

  const balanceKnown = walletSync === "synced";

  return (
    <ResolveBanking
      account={banking}
      settlements={settlements}
      initialLoading={walletSync === "loading"}
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
      onRefresh={() => void load({ silent: false })}
      onSignIn={openSignIn}
    />
  );
}
