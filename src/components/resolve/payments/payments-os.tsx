"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { ResolveBanking } from "@/components/resolve/payments/resolve-banking";
import type { BankingAccountSnapshot, StatementLine } from "@/lib/banking/types";
import { normalizeBankingSnapshot } from "@/lib/banking/normalize-snapshot";
import { BANKING_UI } from "@/lib/banking/copy";
import { BANKING_POLICY } from "@/lib/banking/types";
import type { WalletBalanceSlice } from "@/lib/capital/state";
import type {
  CapitalWalletResponse,
  WalletHealth,
  WalletSyncState,
} from "@/lib/capital/wallet-types";
import { useActiveWalletView } from "@/hooks/use-active-wallet-view";
import type { WalletView } from "@/lib/wallet/active-wallet-view";
import { writeWalletView } from "@/lib/wallet/active-wallet-view";
import {
  fundActionsToStatementLines,
  mergeStatementLines,
} from "@/lib/banking/merge-statements";
import { CAPITAL_REFRESH_EVENT } from "@/lib/capital/refresh-events";
import {
  FUND_ACTION_RECORDED_EVENT,
  listFundActions,
  type StoredFundAction,
} from "@/lib/capital/fund-action-store";

const WALLET_REFRESH_MS = 60_000;
const CLIENT_TIMEOUT_MS = 20_000;
const ARC_CHAIN_ID = 5042002;

type CapitalStatePayload =
  | (Extract<CapitalWalletResponse, { ok: true }> & {
      claimableAmount?: number;
      walletSlices?: WalletBalanceSlice[];
      selectedWallet?: "app" | "connected";
      pendingTransactions?: Array<{
        id: string;
        label: string;
        amountUsd: number;
        status: string;
        createdAt: string;
      }>;
    })
  | (Extract<CapitalWalletResponse, { ok: false }> & {
      claimableAmount?: number;
      syncStatus?: WalletSyncState | "live" | "cached" | "error" | "unknown" | "no_wallet";
      syncError?: string | null;
      balance?: Extract<CapitalWalletResponse, { ok: true }>["balance"];
      walletSlices?: WalletBalanceSlice[];
      pendingTransactions?: Array<{
        id: string;
        label: string;
        amountUsd: number;
        status: string;
        createdAt: string;
      }>;
    });

function walletTagForActivity(item: {
  kind: string;
  status: string;
  label: string | null;
  method?: string | null;
}): string {
  if (item.status === "pending" || item.status === "pending_sync" || item.status === "syncing") {
    return "pending";
  }
  if (item.method === "crypto") {
    return "connected_wallet";
  }
  const lower = (item.label ?? "").toLowerCase();
  if (lower.includes("connected wallet") || lower.includes("fund_tx:")) {
    return "connected_wallet";
  }
  if (item.kind === "fund_program") {
    return "resolve_wallet";
  }
  return "wallet";
}

function buildStatementFromCapital(
  data: Extract<CapitalWalletResponse, { ok: true }>,
  pendingTransactions?: Array<{
    id: string;
    label: string;
    amountUsd: number;
    status: string;
    createdAt: string;
  }>,
): StatementLine[] {
  const activityLines = (data.activity ?? []).map((item) => {
    const amount = item.amountUsd ?? 0;
    return {
      id: item.id,
      at: item.createdAt,
      type: item.kind === "fund_program" ? ("program_reserve" as const) : ("adjustment" as const),
      direction: amount < 0 ? ("debit" as const) : ("credit" as const),
      amountUsd: Math.abs(amount),
      balanceAfterUsd: null,
      label: item.label ?? item.kind,
      reference: walletTagForActivity({
        kind: item.kind,
        status: item.status,
        label: item.label,
        method: item.method ?? null,
      }),
    };
  });

  const pendingLines = (pendingTransactions ?? [])
    .filter((row) => !activityLines.some((line) => line.id === row.id))
    .map((row) => ({
      id: row.id,
      at: row.createdAt,
      type: "program_reserve" as const,
      direction: "debit" as const,
      amountUsd: Math.abs(row.amountUsd),
      balanceAfterUsd: null,
      label: row.label ?? "Funding in progress",
      reference: "pending",
    }));

  return [...activityLines, ...pendingLines];
}

function buildHealthFromCapital(
  data: CapitalStatePayload,
  view: WalletView,
): WalletHealth | null {
  const slices = "walletSlices" in data ? data.walletSlices : undefined;
  const slice =
    slices?.find((s) => s.kind === view) ?? slices?.find((s) => s.kind === "app");
  const wallet = data.ok ? data.wallet : data.wallet;
  if (!wallet && !slice) return null;

  const syncStatus = "syncStatus" in data ? data.syncStatus : data.ok ? data.syncStatus : undefined;
  const balance = data.ok ? data.balance : "balance" in data ? data.balance : undefined;

  const rpcStatus: WalletHealth["rpcStatus"] =
    syncStatus === "live"
      ? "live"
      : syncStatus === "cached"
        ? "cached"
        : syncStatus === "error"
          ? "error"
          : balance
            ? "cached"
            : "live";

  const address = slice?.address ?? wallet!.address;
  return {
    address,
    shortAddress: slice?.shortAddress ?? wallet!.shortAddress,
    source: slice?.kind === "external" ? "external_wallet" : wallet!.source,
    chainId: balance?.chainId ?? ARC_CHAIN_ID,
    blockNumber: balance?.blockNumber ?? null,
    syncedAt: balance?.syncedAt ?? null,
    rpcStatus,
    nativeUsdc: slice?.nativeUsdc ?? balance?.nativeUsdc ?? null,
    erc20Usdc: slice?.erc20Usdc ?? balance?.erc20Usdc ?? null,
    externalAddress:
      data.ok && data.wallet.externalAddress ? data.wallet.externalAddress : undefined,
  };
}

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
  const url = refresh
    ? "/api/capital/state?refresh=1"
    : "/api/capital/state?fast=1";
  const res = await fetch(url, {
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
  view: WalletView = "app",
  walletSlices?: WalletBalanceSlice[],
  pendingTransactions?: Array<{
    id: string;
    label: string;
    amountUsd: number;
    status: string;
    createdAt: string;
  }>,
): BankingAccountSnapshot {
  const slice =
    walletSlices?.find((s) => s.kind === view) ?? walletSlices?.find((s) => s.kind === "app");
  const spendable = slice ? Number(slice.spendableUsd) : Number(data.balance.spendableUsd);
  const total = slice ? Number(slice.onChainUsd) : Number(data.balance.totalUsdc);
  const wallet = slice?.address ?? data.wallet.address;
  const shortLabel = slice?.shortAddress ?? data.wallet.shortAddress;
  const walletSource = slice?.kind === "external" ? "external_wallet" : data.wallet.source;
  const statement = buildStatementFromCapital(data, pendingTransactions);

  return {
    ok: true,
    signedIn: true,
    accountId: userId,
    displayName: data.account?.displayName ?? null,
    email: data.account?.email ?? null,
    memberSince: new Date().toISOString(),
    walletAddress: wallet,
    walletLabel: shortLabel,
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
        label: shortLabel,
        provider:
          walletSource === "circle_embedded" || data.wallet.source === "circle_embedded"
            ? "circle"
            : "embedded",
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
    statement: mergeStatementLines(live.statement, meta.statement),
  };
}

export function PaymentsOS() {
  const { user, balance } = useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();
  const { view: walletView } = useActiveWalletView();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "activity" ? "activity" : "overview";
  const missionHandoff = {
    missionReportId: searchParams.get("missionReport"),
    programId: searchParams.get("program"),
    communitySlug: searchParams.get("community"),
    fundingIntentId: searchParams.get("fundingIntent"),
    settlementBatchId: searchParams.get("settlementBatch"),
    returnTo: searchParams.get("returnTo"),
  };

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
  const lastCapitalRef = useRef<CapitalStatePayload | null>(null);
  const capitalRefreshInFlight = useRef(false);

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

      const effectiveWalletView: WalletView =
        capital.selectedWallet === "connected" ? "external"
        : capital.selectedWallet === "app" ? "app"
        : walletView;
      if (effectiveWalletView !== walletView) writeWalletView(effectiveWalletView);

      const claimable = Number(capital.claimableAmount ?? 0);
      const snap = snapshotFromCapitalWallet(
        capital,
        userId,
        claimable,
        effectiveWalletView,
        capital.walletSlices,
        capital.pendingTransactions,
      );
      const viewSlice = capital.walletSlices?.find((s) => s.kind === effectiveWalletView);
      const spendable = viewSlice
        ? Number(viewSlice.spendableUsd)
        : Number(capital.balance.spendableUsd);

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

      const optimistic = fundActionsToStatementLines(listFundActions());
      const mergedSnap =
        optimistic.length > 0
          ? { ...snap, statement: mergeStatementLines(snap.statement, optimistic) }
          : snap;
      setBanking((prev) =>
        prev ? mergeBankingSnapshots(mergedSnap, prev) : mergedSnap,
      );
      lastCapitalRef.current = capital;
      setWalletHealth(buildHealthFromCapital(capital, effectiveWalletView));
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
      return true;
    },
    [walletView],
  );

  useEffect(() => {
    const capital = lastCapitalRef.current;
    if (!capital?.ok || !user) return;

    const claimable = Number(capital.claimableAmount ?? 0);
    const snap = snapshotFromCapitalWallet(
      capital,
      user.id,
      claimable,
      walletView,
      capital.walletSlices,
      capital.pendingTransactions,
    );
    const viewSlice = capital.walletSlices?.find((s) => s.kind === walletView);
    const spendable = viewSlice
      ? Number(viewSlice.spendableUsd)
      : Number(capital.balance.spendableUsd);

    if (
      lastLiveBalanceRef.current !== null &&
      spendable < lastLiveBalanceRef.current &&
      capital.syncStatus === "cached" &&
      walletView === "app"
    ) {
      snap.balances.availableUsd = lastLiveBalanceRef.current;
      snap.balances.onChainUsdcUsd = Math.max(
        snap.balances.onChainUsdcUsd ?? 0,
        lastLiveBalanceRef.current,
      );
    }

    const optimistic = fundActionsToStatementLines(listFundActions());
    const mergedSnap =
      optimistic.length > 0
        ? { ...snap, statement: mergeStatementLines(snap.statement, optimistic) }
        : snap;

    setBanking((prev) =>
      prev ? mergeBankingSnapshots(mergedSnap, prev) : mergedSnap,
    );
    setWalletHealth(buildHealthFromCapital(capital, walletView));
  }, [walletView, user]);

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
          setWalletHealth(buildHealthFromCapital(capital, walletView));
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

  const onActivityOpen = useCallback(() => {
    void loadWallet({ silent: true, refresh: false });
    void loadOverview();
  }, [loadOverview, loadWallet]);

  useEffect(() => {
    if (!user) return;
    void loadWallet({ silent: false, refresh: initialTab !== "activity" });
    void loadBankingMeta();
    void loadOverview();
    const t = setInterval(
      () => void loadWallet({ silent: true, refresh: false }),
      WALLET_REFRESH_MS,
    );
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + user only; loaders are stable enough
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const onCapitalRefresh = () => {
      if (capitalRefreshInFlight.current) return;
      capitalRefreshInFlight.current = true;
      void Promise.all([
        loadWallet({ silent: true, refresh: true }),
        loadBankingMeta(),
        loadOverview(),
      ]).finally(() => {
        capitalRefreshInFlight.current = false;
      });
    };

    const onFundRecorded = (event: Event) => {
      const action = (event as CustomEvent<StoredFundAction>).detail;
      if (!action) return;
      const line = fundActionsToStatementLines([action])[0];
      if (!line) return;
      setBanking((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          statement: mergeStatementLines(prev.statement, [line]),
        };
      });
      onCapitalRefresh();
    };

    window.addEventListener(CAPITAL_REFRESH_EVENT, onCapitalRefresh);
    window.addEventListener(FUND_ACTION_RECORDED_EVENT, onFundRecorded);
    return () => {
      window.removeEventListener(CAPITAL_REFRESH_EVENT, onCapitalRefresh);
      window.removeEventListener(FUND_ACTION_RECORDED_EVENT, onFundRecorded);
    };
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
      onActivityOpen={onActivityOpen}
      initialTab={initialTab}
      missionHandoff={
        missionHandoff.missionReportId ||
        missionHandoff.programId ||
        missionHandoff.communitySlug ||
        missionHandoff.fundingIntentId ||
        missionHandoff.settlementBatchId
          ? missionHandoff
          : undefined
      }
      walletViewProps={{
        appAddress: account.appWalletAddress,
        externalAddress: account.externalWalletAddress,
        appUsd: balance?.appOnChainUsd ?? balance?.appSpendableUsd ?? null,
        externalUsd: balance?.externalOnChainUsd ?? balance?.externalSpendableUsd ?? null,
      }}
    />
  );
}
