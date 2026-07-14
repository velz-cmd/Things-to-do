"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { useSendFunds } from "@/components/wallet/send-funds-context";
import { WalletViewSelector } from "@/components/resolve/fund/wallet-view-selector";
import { useCapitalBootstrapQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import type { CapitalBootstrap, CapitalAuthorizationSummary } from "@/lib/capital/bootstrap";

type CapitalView = "overview" | "authorizations" | "settlements" | "activity";
const views: Array<{ id: CapitalView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "authorizations", label: "Authorizations" },
  { id: "settlements", label: "Settlements" },
  { id: "activity", label: "Activity" },
];

function micro(value: string | null | undefined): string {
  const amount = BigInt(value ?? "0");
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toLocaleString("en-US")}.${fraction}`;
}

function short(address: string | null | undefined): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not available";
}

function statusTone(status: string): string {
  if (["confirmed", "settled", "ready"].includes(status)) return "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.08]";
  if (["rejected", "reversed", "failed"].includes(status)) return "text-rose-300 border-rose-400/25 bg-rose-400/[0.08]";
  return "text-amber-200 border-amber-400/25 bg-amber-400/[0.08]";
}

function Status({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${statusTone(value)}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.018] px-5 py-8 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#8394ad]">{body}</p>
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

function AuthorizationCard({ row }: { row: CapitalAuthorizationSummary }) {
  const [open, setOpen] = useState(false);
  const allReady = row.readyPayeeCount === row.obligationCount;
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#081421]/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Decision package</p>
          <h3 className="mt-1 truncate text-sm font-semibold text-white">{row.label}</h3>
          <p className="mt-1 font-mono text-[10px] text-[#70829a]">Mission {row.missionId.slice(0, 12)}</p>
        </div>
        <Status value={allReady ? "ready" : "needs_identity"} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-[10px] text-[#70829a]">Requested</dt><dd className="mt-1 text-sm font-semibold text-white">{micro(row.totalMicroUsdc)}</dd></div>
        <div><dt className="text-[10px] text-[#70829a]">Obligations</dt><dd className="mt-1 text-sm text-white">{row.obligationCount}</dd></div>
        <div><dt className="text-[10px] text-[#70829a]">Payout ready</dt><dd className="mt-1 text-sm text-white">{row.readyPayeeCount}/{row.obligationCount}</dd></div>
        <div><dt className="text-[10px] text-[#70829a]">Evidence</dt><dd className="mt-1 text-sm text-white">{row.evidenceCount} records</dd></div>
      </dl>
      {open && (
        <div className="mt-4 rounded-xl border border-violet-400/15 bg-violet-400/[0.04] p-3 text-xs leading-5 text-[#a8b7c9]">
          This package groups persisted obligations by Mission and context. Settlement remains blocked until every payout identity is ready and deterministic preflight is recorded.
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((value) => !value)} data-action-id="capital.review_authorization" data-testid={`capital-review-${row.id}`} className="min-h-11 rounded-lg bg-violet-500 px-3 text-xs font-semibold text-white hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          {open ? "Close review" : "Review package"}
        </button>
        <Link href={`/mission?mission=${encodeURIComponent(row.missionId)}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-medium text-[#b5c2d3] hover:border-white/20 hover:text-white">
          Open origin <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

export function CapitalCommandCenter({ initialData = null }: { initialData?: CapitalBootstrap | null }) {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { openAddFunds } = useAddFunds();
  const { openSendFunds } = useSendFunds();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requested = searchParams.get("view") as CapitalView | null;
  const view = views.some((item) => item.id === requested) ? requested! : "overview";
  const query = useCapitalBootstrapQuery(Boolean(user), initialData);
  const data = query.data;
  const [refreshRun, setRefreshRun] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectView = useCallback((next: CapitalView) => {
    const params = new URLSearchParams(searchParams.toString());
    next === "overview" ? params.delete("view") : params.set("view", next);
    router.replace(`/capital${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!refreshRun || !["validating", "pending_external"].includes(refreshState ?? "")) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      const response = await fetch(`/api/actions/${encodeURIComponent(refreshRun)}`, { credentials: "include" }).catch(() => null);
      const body = response?.ok ? await response.json() : null;
      if (cancelled || !body?.actionRun) return;
      setRefreshState(body.actionRun.state);
      if (body.actionRun.state === "confirmed") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.capitalBootstrap, exact: true });
      }
      if (body.actionRun.state === "sync_failed") {
        setActionError("Live Arc synchronization is delayed. The last confirmed values remain visible.");
      }
      if (["validating", "pending_external"].includes(body.actionRun.state)) {
        timer = window.setTimeout(poll, 1_250);
      }
    };
    timer = window.setTimeout(poll, 1_250);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [queryClient, refreshRun, refreshState]);

  const refresh = useCallback(async () => {
    setActionError(null);
    setRefreshState("validating");
    const response = await fetch("/api/capital/sync", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "manual_refresh",
        idempotencyKey: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-capital-sync`,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.actionRunId) {
      setRefreshState("sync_failed");
      setActionError(body.error ?? "Capital synchronization could not start.");
      return;
    }
    setRefreshRun(body.actionRunId);
    setRefreshState(body.state ?? "pending_external");
  }, []);

  const collect = useCallback(async () => {
    setClaiming(true);
    setActionError(null);
    try {
      const response = await fetch("/api/rewards/claim", { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Earnings could not be collected.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.capitalBootstrap, exact: true }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profileState, exact: true }),
      ]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Earnings could not be collected.");
    } finally {
      setClaiming(false);
    }
  }, [queryClient]);

  const counts = useMemo(() => ({
    obligations: data?.authorizations.reduce((sum, item) => sum + item.obligationCount, 0) ?? 0,
    pendingSettlements: data?.settlementQueue.filter((item) => !["confirmed", "rejected", "reversed"].includes(item.status)).length ?? 0,
    receipts: data?.settlementQueue.filter((item) => item.status === "confirmed").length ?? 0,
  }), [data]);

  if (!user && !initialData) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
        <Empty title="Sign in to open Capital" body="Capital uses your persisted RESOLVE identity, wallet registry, authorizations, and settlement records.">
          <button type="button" onClick={openSignIn} className="min-h-11 rounded-lg bg-blue-500 px-4 text-sm font-semibold text-white">Sign in</button>
        </Empty>
      </main>
    );
  }

  if (!data && query.isLoading) return <CapitalCommandSkeleton />;
  if (!data) {
    return <main className="mx-auto max-w-[1440px] px-4 py-8"><Empty title="Capital is temporarily unavailable" body="Your persisted financial records were not replaced. Retry the bootstrap request."><button type="button" onClick={() => void query.refetch()} className="min-h-11 rounded-lg bg-blue-500 px-4 text-sm text-white">Retry</button></Empty></main>;
  }

  const selected = data.balances.selected;
  const claimable = BigInt(data.moneyState.claimableMicroUsdc);
  const syncing = ["validating", "pending_external"].includes(refreshState ?? "");
  const networkCopy =
    data.sync.networkHealth === "healthy" ? "Arc synchronization healthy"
    : data.sync.networkHealth === "degraded" ? "Arc synchronization delayed"
    : data.sync.networkHealth === "unavailable" ? "Arc live synchronization unavailable"
    : "Arc live state not checked";

  return (
    <main className="min-h-screen bg-[#030711] text-[#f5f8fc] [background-image:linear-gradient(rgba(72,115,169,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(72,115,169,.045)_1px,transparent_1px)] [background-size:40px_40px]">
      <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-[#071220]/95 px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:px-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-300">Capital</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Control what can move, why it can move, and where it settles.</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#91a2b9]">
                <span>Arc Testnet</span><span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
                <span>Selected: {data.wallets.selectedCapitalWallet === "connected" ? "Connected wallet" : "RESOLVE wallet"}</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
                <span>{counts.pendingSettlements} settlements pending</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openAddFunds()} data-action-id="capital.add_usdc" data-testid="capital-add-usdc" className="min-h-11 rounded-xl bg-blue-500 px-4 text-xs font-semibold text-white hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"><span className="inline-flex items-center gap-2"><CircleDollarSign className="h-4 w-4" />Add USDC</span></button>
              <button type="button" onClick={() => openSendFunds()} data-action-id="capital.send_usdc" data-testid="capital-send-usdc" className="min-h-11 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-xs font-semibold text-white hover:bg-white/[0.08]"><span className="inline-flex items-center gap-2"><Send className="h-4 w-4" />Send</span></button>
              <button type="button" onClick={() => void refresh()} disabled={syncing} aria-label="Refresh Capital snapshot" data-action-id="capital.refresh_snapshot" data-testid="capital-refresh-snapshot" className="min-h-11 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 text-white disabled:opacity-60">{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>
            </div>
          </div>
        </header>

        <section aria-labelledby="capital-pulse-title" className="grid overflow-hidden rounded-3xl border border-white/[0.09] bg-[#07111e]/95 shadow-[0_24px_80px_rgba(0,0,0,.25)] lg:grid-cols-[.86fr_1.14fr]">
          <div className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r lg:p-6">
            <p id="capital-pulse-title" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Selected wallet</p>
            <div className="mt-3 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10"><WalletCards className="h-5 w-5 text-cyan-300" /></div><div><p className="text-sm font-semibold text-white">{data.wallets.selectedCapitalWallet === "connected" ? "Connected wallet" : "RESOLVE wallet"}</p><p className="font-mono text-[11px] text-[#8192aa]">{short(selected?.address)}</p></div></div>
            <div aria-live="polite" className="mt-6"><p className="text-4xl font-semibold tracking-[-.04em] text-white">{micro(data.moneyState.availableMicroUsdc)}</p><p className="mt-1 text-xs text-[#8fa0b6]">Available from this wallet</p></div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-[#71839b]">Reserved</dt><dd className="mt-1 font-medium text-white">{micro(data.moneyState.reservedMicroUsdc)}</dd></div>
              <div><dt className="text-[#71839b]">Committed</dt><dd className="mt-1 font-medium text-white">{micro(data.moneyState.committedMicroUsdc)}</dd></div>
              <div><dt className="text-[#71839b]">Pending</dt><dd className="mt-1 font-medium text-white">{micro(data.moneyState.pendingMicroUsdc)}</dd></div>
              <div><dt className="text-[#71839b]">Claimable</dt><dd className="mt-1 font-medium text-white">{micro(data.moneyState.claimableMicroUsdc)}</dd></div>
            </dl>
            <div className="mt-5 border-t border-white/[0.07] pt-4"><WalletViewSelector appAddress={data.wallets.appWallet?.address} externalAddress={data.wallets.connectedWallet?.address} appUsd={Number(BigInt(data.balances.app?.amountMicroUsdc ?? "0")) / 1_000_000} externalUsd={Number(BigInt(data.balances.connected?.amountMicroUsdc ?? "0")) / 1_000_000} selectedView={data.wallets.selectedCapitalWallet === "connected" ? "external" : "app"} compact /></div>
          </div>
          <div className="p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">Capital pulse</p><p className="mt-1 text-xs text-[#8192aa]">Persisted operational state</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] ${data.sync.networkHealth === "healthy" ? "border-emerald-400/20 text-emerald-300" : "border-amber-400/20 text-amber-200"}`}>{networkCopy}</span></div>
            <div className="mt-6 grid gap-2 sm:grid-cols-5">
              {[
                ["Wallet", micro(data.moneyState.availableMicroUsdc), WalletCards],
                ["Decision inbox", `${data.authorizations.length} packages`, ShieldCheck],
                ["Obligations", `${counts.obligations} tracked`, LockKeyhole],
                ["Settlement", `${counts.pendingSettlements} pending`, Clock3],
                ["Receipts", `${counts.receipts} confirmed`, FileCheck2],
              ].map(([label, value, Icon], index) => {
                const NodeIcon = Icon as typeof WalletCards;
                return <button key={label as string} type="button" onClick={() => selectView(index === 1 || index === 2 ? "authorizations" : index === 3 ? "settlements" : index === 4 ? "activity" : "overview")} className="group relative min-h-[108px] rounded-xl border border-white/[0.08] bg-[#0b1928] p-3 text-left hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"><NodeIcon className="h-4 w-4 text-blue-300" /><p className="mt-4 text-[10px] uppercase tracking-[.12em] text-[#71839b]">{label as string}</p><p className="mt-1 text-xs font-semibold text-white">{value as string}</p>{index < 4 && <span className="absolute -right-2 top-1/2 hidden h-px w-2 bg-blue-400/50 sm:block" />}</button>;
              })}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-[11px] text-[#8192aa]"><span>Portfolio total: {micro(data.balances.portfolioTotalMicroUsdc)}</span><span>{data.sync.lastSuccessfulSyncAt ? `Last confirmed ${new Date(data.sync.lastSuccessfulSyncAt).toLocaleString()}` : "Awaiting first confirmed synchronization"}</span></div>
          </div>
        </section>

        {actionError && <div role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100">{actionError}</div>}

        <nav aria-label="Capital sections" role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#07111d] p-1.5">
          {views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => selectView(item.id)} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${view === item.id ? "bg-blue-500/[0.18] text-white shadow-[inset_0_0_0_1px_rgba(79,166,255,.3)]" : "text-[#8ea0b7] hover:text-white"}`}>{item.label}</button>)}
        </nav>

        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#07111d] p-3" aria-label="Capital actions">
          <button type="button" onClick={() => openAddFunds()} className="min-h-11 rounded-xl bg-blue-500 px-4 text-xs font-semibold text-white">Add USDC</button>
          <button type="button" onClick={() => openSendFunds()} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white">Send USDC</button>
          <button type="button" onClick={() => selectView("authorizations")} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white">Review authorizations</button>
          <button type="button" onClick={() => void collect()} disabled={claimable <= 0n || claiming} data-action-id="capital.collect_earnings" data-testid="capital-collect-earnings" className={`min-h-11 rounded-xl px-4 text-xs font-semibold ${claimable > 0n ? "bg-emerald-400 text-[#032016]" : "border border-white/[0.08] text-[#65758b]"}`}>{claiming ? "Collecting…" : `Collect ${micro(data.moneyState.claimableMicroUsdc)}`}</button>
        </section>

        {(view === "overview" || view === "authorizations") && (
          <section aria-labelledby="decision-inbox-heading">
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Authorization control</p><h2 id="decision-inbox-heading" className="mt-1 text-lg font-semibold text-white">Decision Inbox</h2></div>{view === "overview" && data.authorizations.length > 3 && <button type="button" onClick={() => selectView("authorizations")} className="text-xs font-medium text-blue-300">View all</button>}</div>
            {data.authorizations.length ? <div className="grid gap-3 xl:grid-cols-2">{data.authorizations.slice(0, view === "overview" ? 4 : undefined).map((row) => <AuthorizationCard key={`${row.id}:${row.label}`} row={row} />)}</div> : <Empty title="No authorization packages need review" body="Approved Mission and Communities packages will appear here."><Link href="/communities" className="min-h-11 rounded-lg border border-white/10 px-4 py-3 text-xs text-white">Open Communities</Link><Link href="/mission" className="min-h-11 rounded-lg border border-white/10 px-4 py-3 text-xs text-white">Open Mission</Link></Empty>}
          </section>
        )}

        {(view === "overview" || view === "settlements") && (
          <section aria-labelledby="settlement-heading">
            <div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Arc execution</p><h2 id="settlement-heading" className="mt-1 text-lg font-semibold text-white">Settlement Queue</h2></div>
            {data.settlementQueue.length ? <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07111d]"><div className="divide-y divide-white/[0.07]">{data.settlementQueue.slice(0, view === "overview" ? 6 : undefined).map((row) => <article key={row.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div><p className="text-sm font-medium text-white">{row.communitySlug ?? "Settlement package"}</p><p className="mt-1 font-mono text-[10px] text-[#71839b]">{row.id}</p></div><div><p className="text-[10px] text-[#71839b]">Total</p><p className="mt-1 text-sm font-semibold text-white">{micro(row.totalMicroUsdc)}</p></div><div><p className="text-[10px] text-[#71839b]">Payees</p><p className="mt-1 text-sm text-white">{row.payeeCount}</p></div><div className="flex items-center gap-2"><Status value={row.status} />{row.status === "confirmed" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Clock3 className="h-4 w-4 text-amber-200" />}</div></article>)}</div></div> : <Empty title="No settlements are queued" body="Prepared and approved settlement packages will appear here with their authoritative Arc lifecycle." />}
          </section>
        )}

        {view === "activity" && (
          <section aria-labelledby="activity-heading"><div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-300">Ledger</p><h2 id="activity-heading" className="mt-1 text-lg font-semibold text-white">Capital activity</h2></div>{data.recentActivity.length ? <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07111d]"><table className="w-full text-left text-xs"><thead className="border-b border-white/[0.08] text-[#71839b]"><tr><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Time</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.recentActivity.map((row) => <tr key={row.id}><td className="px-4 py-3"><p className="font-medium text-white">{row.label}</p><p className="mt-1 text-[10px] text-[#71839b]">{row.kind}</p></td><td className="px-4 py-3 font-mono text-white">{row.amountMicroUsdc ? micro(row.amountMicroUsdc) : "—"}</td><td className="px-4 py-3"><Status value={row.status} /></td><td className="hidden px-4 py-3 text-[#8192aa] sm:table-cell">{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty title="No Capital activity yet" body="Confirmed deposits, sends, authorizations, settlements, claims, and reconciliation events will appear here." />}</section>
        )}

        <details className="rounded-2xl border border-white/[0.07] bg-[#050c15] p-4 text-xs text-[#8192aa]"><summary className="cursor-pointer font-medium text-[#aab8c9]">Infrastructure diagnostics</summary><dl className="mt-4 grid gap-3 sm:grid-cols-3"><div><dt>Network</dt><dd className="mt-1 text-white">Arc Testnet · 5042002</dd></div><div><dt>Snapshot state</dt><dd className="mt-1 text-white">{data.sync.balanceState}</dd></div><div><dt>Generated</dt><dd className="mt-1 text-white">{new Date(data.generatedAt).toLocaleString()}</dd></div></dl><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-blue-300">Open ArcScan <ExternalLink className="h-3.5 w-3.5" /></a></details>
      </div>
    </main>
  );
}

export function CapitalCommandSkeleton() {
  return <main className="min-h-screen bg-[#030711] px-4 py-5"><div className="mx-auto max-w-[1440px] animate-pulse space-y-5"><div className="h-40 rounded-3xl border border-white/5 bg-[#071220]" /><div className="grid h-[310px] rounded-3xl border border-white/5 bg-[#07111d] lg:grid-cols-2" /><div className="h-14 rounded-2xl bg-[#07111d]" /><div className="grid gap-3 lg:grid-cols-2"><div className="h-56 rounded-2xl bg-[#07111d]" /><div className="h-56 rounded-2xl bg-[#07111d]" /></div></div></main>;
}
