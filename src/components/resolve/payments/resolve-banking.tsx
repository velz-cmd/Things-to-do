"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Copy,
  Landmark,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
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
import { useFundingIntentQuery, useSettlementBatchQuery } from "@/lib/query/hooks";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import { FundProgressPanel } from "@/components/resolve/fund/fund-progress-panel";

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
  missionHandoff?: {
    missionReportId?: string | null;
    programId?: string | null;
    communitySlug?: string | null;
    fundingIntentId?: string | null;
    settlementBatchId?: string | null;
    returnTo?: string | null;
  };
  walletViewProps?: {
    appAddress?: string | null;
    externalAddress?: string | null;
    appUsd?: number | null;
    externalUsd?: number | null;
  };
};

type MissionHandoff = NonNullable<ResolveBankingProps["missionHandoff"]>;

function SettlementBatchCard({
  handoff,
  signedIn,
  onSignIn,
}: {
  handoff: MissionHandoff;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const query = useSettlementBatchQuery(
    handoff.settlementBatchId,
    handoff.returnTo,
    signedIn,
  );
  const [submitting, setSubmitting] = useState(false);

  if (!signedIn) {
    return (
      <div className="mb-6 rounded-xl border border-violet-400/25 bg-violet-400/[0.06] p-4">
        <p className="text-sm font-medium text-white">Settlement package prepared</p>
        <p className="mt-1 text-xs text-resolve-muted">Sign in to inspect the exact payee batch and provide final authorization.</p>
        <Button className="mt-3" size="sm" onClick={onSignIn}>Sign in to review</Button>
      </div>
    );
  }
  if (query.isLoading) {
    return <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs text-resolve-muted"><Loader2 className="h-4 w-4 animate-spin text-violet-300" />Verifying settlement packageâ€¦</div>;
  }
  if (query.isError || !query.data?.batch) {
    return (
      <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-4">
        <p className="text-sm font-medium text-rose-100">Settlement package unavailable</p>
        <p className="mt-1 text-xs text-resolve-muted">Nothing was submitted. Return to Communities or retry the package check.</p>
        <Button className="mt-3" variant="secondary" size="sm" onClick={() => void query.refetch()}>Retry</Button>
      </div>
    );
  }

  const { batch, execution } = query.data;
  const amountUsd = Number(batch.totalUsd);
  const confirmed = batch.status === "confirmed";
  const inFlight = batch.status === "submitting";
  const partial = batch.status === "partial" || batch.status === "failed";
  const returnTo = batch.returnTo ?? handoff.returnTo ?? `/communities/${encodeURIComponent(batch.communitySlug ?? "")}`;

  async function authorizeSettlement() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/settlement/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementBatchId: batch.id, confirm: true }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; failed?: number } | null;
      if (!response.ok && response.status !== 207) throw new Error(payload?.error ?? "Settlement could not be submitted");
      await query.refetch();
      if (response.status === 207) toast.error(`${payload?.failed ?? "Some"} payouts require review; confirmed transfers were preserved.`);
      else toast.success("Settlement confirmed on Arc");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settlement could not be submitted");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.1] via-[#091320] to-cyan-500/[0.05] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-violet-300" /><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Communities â†’ Capital handoff</p></div>
          <h2 className="mt-2 text-base font-semibold text-white">Review settlement authorization</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-resolve-muted">Evidence, policy, identities, and simulation are already compiled. Capital will execute this immutable package only after your confirmation.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-resolve-muted">{batch.payeeCount} payees</span>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-resolve-muted">Status Â· {batch.status}</span>
            {batch.packageHash && <span title={batch.packageHash} className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 font-mono text-resolve-muted">Proof Â· {batch.packageHash.slice(0, 10)}â€¦</span>}
          </div>
        </div>
        <div className="min-w-32 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-right">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">Exact batch total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white"><Money amount={amountUsd} size="md" className="inline" /></p>
          <p className="mt-0.5 text-[10px] text-resolve-muted">Arc testnet USDC</p>
        </div>
      </div>
      <div className="border-t border-white/[0.07] bg-black/15 px-4 py-3 sm:px-5">
        {!execution.enabled && !confirmed && <p className="mb-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-100">{execution.blocker} The package is preserved; no money has moved.</p>}
        {partial && <p className="mb-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-[11px] text-rose-100">One or more transfers failed. Confirmed payouts are preserved and retry is idempotent per obligation.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={returnTo} className="text-xs font-medium text-resolve-accent hover:underline">Return to Settlement Readiness</Link>
          {confirmed ? (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] px-3 text-xs font-medium text-emerald-200"><BadgeCheck className="h-3.5 w-3.5" />{batch.payeeCount} payouts confirmed</span>
          ) : inFlight ? (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-medium text-amber-100"><Loader2 className="h-3.5 w-3.5 animate-spin" />Submitting on Arc</span>
          ) : (
            <Button data-action-id="capital.authorize_settlement" data-testid="capital-authorize-settlement" size="sm" disabled={submitting || !execution.enabled} onClick={() => void authorizeSettlement()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {submitting ? "Authorizingâ€¦" : `Authorize ${amountUsd.toFixed(2)} USDC`}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function FundingIntentCard({
  handoff,
  signedIn,
  onSignIn,
}: {
  handoff: MissionHandoff;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const query = useFundingIntentQuery(handoff.fundingIntentId, signedIn);
  const { executeFund, fundProgress } = useFundProgramExecution(
    handoff.communitySlug ?? undefined,
  );
  const [submitting, setSubmitting] = useState(false);

  if (!signedIn) {
    return (
      <div className="mb-6 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
        <p className="text-sm font-medium text-white">Authorization package ready</p>
        <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
          Sign in to review the prepared amount and choose the wallet that will authorize it.
        </p>
        <Button className="mt-3" size="sm" onClick={onSignIn}>
          Sign in to continue
        </Button>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin text-resolve-accent" />
        Loading authorization package…
      </div>
    );
  }

  if (query.isError || !query.data?.intent) {
    return (
      <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-4">
        <p className="text-sm font-medium text-rose-100">Authorization package unavailable</p>
        <p className="mt-1 text-xs text-resolve-muted">
          It was not funded. Retry loading the package or return to Mission.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
          {handoff.missionReportId && (
            <Link
              href={`/mission/report/${encodeURIComponent(handoff.missionReportId)}`}
              className="inline-flex min-h-9 items-center px-2 text-xs font-medium text-resolve-accent hover:underline"
            >
              Return to Mission
            </Link>
          )}
        </div>
      </div>
    );
  }

  const intent = query.data.intent;
  const amountUsd = Number(intent.amountUsd);
  const confirmed = intent.status === "confirmed";
  const submitted = intent.status === "submitted";
  const returnTo = intent.returnTo ?? handoff.returnTo ??
    (handoff.missionReportId
      ? `/mission/report/${encodeURIComponent(handoff.missionReportId)}`
      : "/mission");

  async function submitFunding() {
    if (!Number.isFinite(amountUsd) || amountUsd < 5) {
      toast.error("The prepared funding amount is invalid");
      return;
    }

    setSubmitting(true);
    try {
      const result = await executeFund({
        programId: intent.programId ?? handoff.programId ?? undefined,
        communitySlug: intent.communitySlug ?? handoff.communitySlug ?? undefined,
        missionId: intent.blueprintId ?? handoff.missionReportId ?? undefined,
        amountUsd,
        label: intent.communitySlug
          ? `${intent.communitySlug} authorization`
          : "Mission authorization",
      });

      const status = result.txHash ? "confirmed" : "submitted";
      if (!result.txHash && !result.activityId) {
        throw new Error(
          "Funding was accepted but no traceable transaction or activity ID was returned. Check Capital activity before retrying.",
        );
      }

      const response = await fetch(
        `/api/capital/funding-intents/${encodeURIComponent(intent.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            programId: result.programId,
            activityId: result.activityId,
            txHash: result.txHash,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not record funding status");

      await query.refetch();
      toast.success(
        status === "confirmed"
          ? "Funding confirmed on Arc"
          : "Funding submitted — tracking confirmation in Capital",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Funding could not be submitted");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/[0.09] via-[#091320] to-violet-500/[0.06] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-sky-300" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
              Mission → Capital handoff
            </p>
          </div>
          <h2 className="mt-2 text-base font-semibold text-white">Authorization package prepared</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-resolve-muted">
            Mission compiled the decision. Capital will now verify the wallet, request your
            confirmation, submit the funding, and track the Arc receipt.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-resolve-muted">
              {intent.communitySlug ?? "Mission scope"}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-resolve-muted">
              Status · {intent.status}
            </span>
          </div>
        </div>
        <div className="min-w-32 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-right">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
            Prepared amount
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white">
            <Money amount={amountUsd} size="md" className="inline" />
          </p>
          <p className="mt-0.5 text-[10px] text-resolve-muted">Arc testnet USDC</p>
        </div>
      </div>

      <div className="border-t border-white/[0.07] bg-black/15 px-4 py-3 sm:px-5">
        {fundProgress.stage !== "idle" && (
          <FundProgressPanel
            stage={fundProgress.stage}
            fundingSource={fundProgress.fundingSource ?? "app"}
            amountUsd={amountUsd}
            txHash={fundProgress.txHash ?? intent.transaction?.txHash ?? undefined}
          />
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Link href={returnTo} className="text-xs font-medium text-resolve-accent hover:underline">
            Return to Mission receipt
          </Link>
          {confirmed ? (
            intent.transaction?.txHash ? (
              <a
                href={`https://testnet.arcscan.app/tx/${intent.transaction.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-400/[0.12]"
              >
                Confirmed · view Arc receipt <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-xs font-medium text-emerald-200">Funding confirmed</span>
            )
          ) : submitted ? (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-medium text-amber-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Awaiting Arc confirmation
            </span>
          ) : (
            <Button
              data-action-id="capital.submit_funding"
              size="sm"
              disabled={submitting}
              onClick={() => void submitFunding()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {submitting ? "Authorizing…" : `Authorize ${amountUsd.toFixed(2)} USDC`}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

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
  missionHandoff,
  walletViewProps,
}: ResolveBankingProps) {
  const { openAddFunds } = useAddFunds();
  const { openSendFunds } = useSendFunds();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(initialTab);
  const onActivityOpenRef = useRef(onActivityOpen);
  onActivityOpenRef.current = onActivityOpen;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialTab === "activity") {
      onActivityOpenRef.current?.();
    }
  }, [initialTab]);

  const selectTab = useCallback(
    (next: Tab) => {
      setTab(next);
      const href = next === "activity" ? `${pathname}?tab=activity` : pathname;
      router.replace(href, { scroll: false });
      if (next === "activity") {
        onActivityOpenRef.current?.();
      }
    },
    [pathname, router],
  );

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
    badge:
      line.reference === "connected_wallet"
        ? "Connected wallet"
        : line.reference === "pending"
          ? "Pending"
          : line.reference === "resolve_wallet"
            ? "RESOLVE wallet"
            : "Wallet",
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

      {missionHandoff?.settlementBatchId ? (
        <SettlementBatchCard
          handoff={missionHandoff}
          signedIn={signedIn}
          onSignIn={onSignIn}
        />
      ) : missionHandoff?.fundingIntentId ? (
        <FundingIntentCard
          handoff={missionHandoff}
          signedIn={signedIn}
          onSignIn={onSignIn}
        />
      ) : missionHandoff?.missionReportId ? (
        <div className="mb-6 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-3 text-sm text-sky-100">
          <p className="font-medium text-white">Mission authorization package</p>
          <p className="mt-1 text-xs text-resolve-muted">
            {missionHandoff.communitySlug
              ? `${missionHandoff.communitySlug} · `
              : ""}
            Review activity and settlements in Capital. No funds move without confirmation.
          </p>
          <Link
            href={`/mission/report/${missionHandoff.missionReportId}`}
            className="mt-2 inline-block text-xs font-medium text-resolve-accent hover:underline"
          >
            Return to Mission receipt →
          </Link>
        </div>
      ) : null}

      <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
        <TabButton active={tab === "overview"} onClick={() => selectTab("overview")}>
          {BANKING_UI.overview}
        </TabButton>
        <TabButton active={tab === "activity"} onClick={() => selectTab("activity")}>
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
                  href="/profile?view=sources"
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
