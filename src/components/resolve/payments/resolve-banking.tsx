"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Copy,
  Landmark,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { MoneyFlowExplainer } from "@/components/resolve/capital/money-flow-explainer";
import { CapitalSettlementRow } from "@/components/resolve/capital/settlement-truth";
import { WalletHealthRow } from "@/components/resolve/capital/wallet-health-row";
import { WalletViewSelector } from "@/components/resolve/fund/wallet-view-selector";
import type { WalletHealth, WalletSyncState } from "@/lib/capital/wallet-types";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { useSendFunds } from "@/components/wallet/send-funds-context";
import { PendingAuthorizationsPanel } from "@/components/resolve/payments/pending-authorizations-panel";
import { BANKING_UI, friendlyStatementLabel, friendlyStatus } from "@/lib/banking/copy";
import type { BankingAccountSnapshot, StatementLine } from "@/lib/banking/types";

type SettlementRow = {
  id: string;
  label: string;
  amountUsd: number;
  txHash: string | null;
  status: string;
  at: string;
  kind?: "settlement" | "authorization" | "statement";
};

type Tab = "overview" | "activity";

type ResolveBankingProps = {
  account: BankingAccountSnapshot | null;
  settlements: SettlementRow[];
  initialLoading: boolean;
  refreshing: boolean;
  signedIn: boolean;
  payoutWallet: string | null;
  claiming: boolean;
  lastRefreshedAt?: Date | null;
  walletSync?: WalletSyncState;
  balanceKnown?: boolean;
  syncError?: string | null;
  walletHealth?: WalletHealth | null;
  walletWarnings?: string[];
  onClaim: () => void;
  onRefresh?: () => void;
  onSignIn: () => void;
  onActivityOpen?: () => void;
  initialTab?: Tab;
  walletViewProps?: {
    appAddress?: string | null;
    externalAddress?: string | null;
    appUsd?: number | null;
    externalUsd?: number | null;
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({
  label,
  amount,
  unknown,
}: {
  label: string;
  amount: number;
  unknown?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">
        {unknown ?
          <span className="text-resolve-muted">—</span>
        : <Money amount={amount} size="sm" className="inline" />}
      </p>
    </div>
  );
}

function ActivityRow({
  title,
  subtitle,
  amountUsd,
  direction,
  badge,
  receiptHref,
}: {
  title: string;
  subtitle: string;
  amountUsd: number;
  direction?: "credit" | "debit";
  badge?: string;
  receiptHref?: string;
}) {
  const credit = direction !== "debit";
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm text-white">{title}</p>
          {badge && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-resolve-muted ring-1 ring-white/10">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-resolve-muted">
          {subtitle}
          {receiptHref && (
            <>
              {" · "}
              <Link href={receiptHref} className="text-resolve-accent hover:underline">
                View receipt
              </Link>
            </>
          )}
        </p>
      </div>
      <p
        className={`shrink-0 text-sm font-medium tabular-nums ${
          credit ? "text-emerald-300" : "text-white"
        }`}
      >
        {credit ? "+" : "−"}
        <Money amount={amountUsd} size="sm" className="inline" />
      </p>
    </li>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
        active ?
          "bg-white/[0.08] text-white"
        : "text-resolve-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function GuestLanding({ onSignIn }: { onSignIn: () => void }) {
  return (
    <BlueGlowCard className="mb-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-resolve-accent/15">
          <Sparkles className="h-5 w-5 text-resolve-accent" />
        </div>
        <div>
          <p className="text-lg font-semibold text-white">{BANKING_UI.guestTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-resolve-muted">{BANKING_UI.guestBody}</p>
          <Button onClick={onSignIn} className="mt-5">
            {BANKING_UI.signIn}
          </Button>
        </div>
      </div>
      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {BANKING_UI.howItWorks.map((step) => (
          <li
            key={step.step}
            className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
              Step {step.step}
            </p>
            <p className="mt-1 text-sm font-medium text-white">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </BlueGlowCard>
  );
}

function TechnicalDetails({
  account,
  arc,
}: {
  account: BankingAccountSnapshot;
  arc: BankingAccountSnapshot["arc"];
}) {
  const [copied, setCopied] = useState(false);
  const address = arc.identityWallet?.depositAddress ?? account.walletAddress;

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <details className="group mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
        <span>
          {BANKING_UI.technicalDetails}
          <span className="mt-0.5 block text-xs font-normal text-resolve-muted">
            {BANKING_UI.technicalHint}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-resolve-muted transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-white/[0.06] px-4 py-4 text-xs text-resolve-muted">
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-semibold uppercase ${
              arc.canDistribute ?
                "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {arc.canDistribute ? "Payouts live" : "Payouts standby"}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5">
            {arc.chain} · USDC
          </span>
          {arc.identityWallet?.provider === "circle" && (
            <span className="rounded-full border border-white/10 px-2 py-0.5">Circle wallet</span>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            {BANKING_UI.paymentFlowTitle}
          </p>
          <ol className="mt-3 space-y-2">
            {BANKING_UI.paymentFlow.map((step, i) => (
              <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-resolve-muted">
                <span className="shrink-0 font-mono text-resolve-accent">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {address && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
              {BANKING_UI.walletAddress}
            </p>
            <p className="mt-0.5 text-[10px] text-resolve-muted-dim">Your USDC — only you can spend this</p>
            <p className="mt-2 break-all font-mono text-[11px] text-white">{address}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-white">
                <Money
                  amount={account.balances.onChainUsdcUsd ?? arc.identityWallet?.onChainUsdcUsd ?? 0}
                  size="sm"
                  className="inline"
                />
              </p>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
              >
                <Copy className="h-3 w-3" />
                {copied ? BANKING_UI.copied : BANKING_UI.copyAddress}
              </button>
            </div>
          </div>
        )}

        {arc.settlementWallet && (
          <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              {BANKING_UI.paymentRailTitle}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted">
              {BANKING_UI.paymentRailBody}
            </p>
            <p className="mt-3 text-xs font-medium text-white">
              {arc.canDistribute ? BANKING_UI.paymentRailStatusLive : BANKING_UI.paymentRailStatusStandby}
            </p>
            <p className="mt-2 break-all font-mono text-[10px] text-resolve-muted-dim">
              {arc.settlementWallet}
            </p>
            <a
              href={`${arc.explorerUrl}/address/${arc.settlementWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-resolve-accent hover:underline"
            >
              View on Arcscan
            </a>
          </div>
        )}

        {arc.recentMemos?.length ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              Your program payouts
            </p>
          <ul className="space-y-2">
            {arc.recentMemos.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-white">{m.label}</span>
                <a
                  href={`${arc.explorerUrl}/tx/${m.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-resolve-accent hover:underline"
                >
                  View receipt
                </a>
              </li>
            ))}
          </ul>
          </div>
        ) : null}

        {arc.blockers?.length ? (
          <p className="text-amber-200/90">{arc.blockers[0]}</p>
        ) : null}
      </div>
    </details>
  );
}

/** RESOLVE Banking — simple on screen, Arc/Circle on the backend. */
export function ResolveBanking({
  account,
  settlements,
  initialLoading,
  refreshing,
  signedIn,
  payoutWallet,
  claiming,
  lastRefreshedAt,
  walletSync = "loading",
  balanceKnown = false,
  syncError,
  walletHealth,
  walletWarnings = [],
  onClaim,
  onRefresh,
  onSignIn,
  onActivityOpen,
  initialTab = "overview",
  walletViewProps,
}: ResolveBankingProps) {
  const { openAddFunds } = useAddFunds();
  const { openSendFunds } = useSendFunds();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
    if (initialTab === "activity") onActivityOpen?.();
  }, [initialTab, onActivityOpen]);

  const balances = account?.balances;
  const network = account?.network;
  const arc = account?.arc;
  const yourClaimable = balances?.earnedClaimableUsd ?? 0;
  const yourDeposits = balances?.availableUsd ?? 0;
  const reserved = balances?.reservedUsd ?? 0;
  const onChainUsd = balances?.onChainUsdcUsd ?? null;

  const showBalanceAmount =
    balanceKnown &&
    (walletSync !== "error" || yourDeposits > 0 || (onChainUsd ?? 0) > 0);
  const showCachedBalance = walletSync === "cached";
  const showSyncError =
    walletSync === "error" &&
    yourDeposits <= 0 &&
    (onChainUsd ?? 0) <= 0 &&
    !balanceKnown;
  const showNoWallet = walletSync === "no_wallet" && !payoutWallet;

  const statementLines: StatementLine[] = account?.statement ?? [];
  const activityItems = statementLines.map((line) => ({
    id: line.id,
    title: friendlyStatementLabel(line.label),
    subtitle: formatDate(line.at),
    amountUsd: line.amountUsd,
    direction: line.direction,
    badge: "wallet" as const,
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          {BANKING_UI.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{BANKING_UI.title}</h1>
        <p className="mt-2 text-sm text-resolve-muted">{BANKING_UI.subtitle}</p>
        {signedIn && account?.displayName && (
          <p className="mt-3 text-xs text-resolve-muted">
            {account.displayName}
            {account.memberSince ? ` · since ${formatDate(account.memberSince)}` : ""}
          </p>
        )}
      </header>

      <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          {BANKING_UI.overview}
        </TabButton>
        <TabButton active={tab === "activity"} onClick={() => { setTab("activity"); onActivityOpen?.(); }}>
          {BANKING_UI.activity}
        </TabButton>
      </div>

      {!signedIn && tab === "overview" && <GuestLanding onSignIn={onSignIn} />}

      {tab === "overview" && (
        <>
          {signedIn && walletHealth && (
            <WalletHealthRow
              health={walletHealth}
              onRetry={onRefresh}
              retrying={refreshing}
            />
          )}

          {signedIn && walletViewProps && (
            <div className="mb-4">
              <WalletViewSelector {...walletViewProps} />
            </div>
          )}

          {signedIn && walletWarnings.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-100/90">
              {walletWarnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          {signedIn && (
            <BlueGlowCard className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                    {BANKING_UI.balanceLabel}
                  </p>
                  {initialLoading ?
                    <p className="mt-2 text-sm text-resolve-muted">{BANKING_UI.syncingBalance}</p>
                  : showNoWallet ?
                    <p className="mt-2 text-sm text-amber-200">Create or connect wallet</p>
                  : showSyncError ?
                    <div className="mt-2">
                      <p className="text-sm text-amber-200">
                        {syncError ?? "Could not sync Arc. Retry"}
                      </p>
                      {onRefresh && (
                        <button
                          type="button"
                          onClick={onRefresh}
                          disabled={refreshing}
                          className="mt-2 text-xs text-resolve-accent hover:underline"
                        >
                          Retry sync
                        </button>
                      )}
                    </div>
                  : showBalanceAmount ?
                    <>
                      <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
                        <Money amount={yourDeposits} size="lg" />
                      </p>
                      <p className="mt-1 text-xs text-resolve-muted">
                        {showCachedBalance
                          ? (syncError ?? "Using last known Arc balance while the network syncs.")
                          : BANKING_UI.balanceHint}
                      </p>
                    </>
                  : <p className="mt-2 text-sm text-resolve-muted">{BANKING_UI.syncingBalance}</p>
                  }
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <Landmark className="h-5 w-5 text-resolve-accent" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-5">
                <Stat label={BANKING_UI.reserved} amount={showBalanceAmount ? reserved : 0} unknown={!showBalanceAmount} />
                <Stat
                  label={BANKING_UI.totalIn}
                  amount={showBalanceAmount ? (onChainUsd ?? yourDeposits) : 0}
                  unknown={!showBalanceAmount}
                />
                <Stat label={BANKING_UI.readyToClaim} amount={showBalanceAmount ? yourClaimable : 0} unknown={!showBalanceAmount} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => openAddFunds()} className="gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  {BANKING_UI.addMoney}
                </Button>
                <Button variant="secondary" onClick={() => openSendFunds()} className="gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  {BANKING_UI.sendMoney}
                </Button>
                <Button
                  variant="secondary"
                  onClick={onClaim}
                  disabled={claiming || !payoutWallet || yourClaimable <= 0}
                  className="gap-2"
                >
                  {claiming ? BANKING_UI.claimWorking : BANKING_UI.collectEarnings}
                </Button>
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="h-8 gap-1.5 px-2 text-xs text-resolve-muted"
                    title={BANKING_UI.refreshHint}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                    />
                    {!refreshing && BANKING_UI.refresh}
                  </Button>
                )}
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center gap-2 rounded-resolve px-5 py-2.5 text-sm font-semibold text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
                >
                  {BANKING_UI.connections}
                </Link>
              </div>
              <p className="mt-3 text-[10px] text-resolve-muted-dim">
                {refreshing ?
                  BANKING_UI.syncingBalance
                : lastRefreshedAt ?
                  `${BANKING_UI.lastUpdated} ${lastRefreshedAt.toLocaleTimeString()} · ${BANKING_UI.autoRefresh}`
                : BANKING_UI.autoRefresh}
              </p>
            </BlueGlowCard>
          )}

          {signedIn && <PendingAuthorizationsPanel signedIn={signedIn} />}

          {signedIn && yourClaimable > 0 && (
            <BlueGlowCard className="mb-6">
              <p className="text-sm font-semibold text-white">Earnings ready to collect</p>
              <p className="mt-1 text-sm text-resolve-muted">
                Verified value from your connected ecosystems — collect to your Arc wallet.
              </p>
              <p className="mt-3 text-2xl font-semibold text-emerald-300">
                <Money amount={yourClaimable} size="lg" className="inline" />
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={onClaim}
                disabled={claiming || !payoutWallet}
              >
                {claiming ? BANKING_UI.claimWorking : BANKING_UI.collectEarnings}
              </Button>
            </BlueGlowCard>
          )}

          {signedIn && <MoneyFlowExplainer />}

          {!initialLoading && network && network.pendingFundingUsd > 0 && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
              {BANKING_UI.pendingFunding}
            </div>
          )}

          {signedIn && account && arc && <TechnicalDetails account={account} arc={arc} />}

          {!signedIn && network && (
            <div className="mb-6 rounded-lg border border-white/[0.06] px-4 py-3 text-xs text-resolve-muted">
              <p className="font-medium text-white">Network activity (all users)</p>
              <p className="mt-2">
                <Money amount={network.claimableUsd} size="sm" className="inline text-white" /> ready
                to collect across RESOLVE ·{" "}
                <Money amount={network.settledUsd} size="sm" className="inline text-white" /> paid out
              </p>
            </div>
          )}

        </>
      )}

      {tab === "activity" && (
        <section className="py-2">
          {initialLoading ?
            <p className="text-sm text-resolve-muted">Loading…</p>
          : !activityItems.length ?
            <p className="text-sm text-resolve-muted">{BANKING_UI.activityEmpty}</p>
          : <ul>
              {activityItems.slice(0, 24).map((item) => (
                <ActivityRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  amountUsd={item.amountUsd}
                  direction={item.direction}
                  badge={item.badge}
                  receiptHref={
                    item.direction === "debit" ? `/receipt/${encodeURIComponent(item.id)}` : undefined
                  }
                />
              ))}
            </ul>
          }
          {settlements.some((s) => s.txHash) && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-white">Payment receipts</p>
              <p className="mt-1 text-xs text-resolve-muted">
                Verified on-chain — only shown after confirmation.
              </p>
              <ul className="mt-4">
                {settlements
                  .filter((s) => s.txHash)
                  .slice(0, 12)
                  .map((s) => (
                    <CapitalSettlementRow
                      key={s.id}
                      label={s.label}
                      amountUsd={s.amountUsd}
                      txHash={s.txHash}
                      status={s.status}
                      at={s.at}
                      receiptId={s.id}
                    />
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {signedIn && account?.identities && tab === "overview" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {account.identities.github ?
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100">
              <BadgeCheck className="h-3 w-3" /> GitHub {account.identities.github}
            </span>
          : null}
          {account.identities.emailVerified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] text-resolve-muted">
              <BadgeCheck className="h-3 w-3" /> Email verified
            </span>
          )}
          {payoutWallet && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] text-resolve-muted">
              <Wallet className="h-3 w-3" />
              {payoutWallet.slice(0, 6)}…{payoutWallet.slice(-4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
