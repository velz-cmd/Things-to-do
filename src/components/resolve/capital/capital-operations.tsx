"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CircleDollarSign, Copy, ExternalLink, RefreshCw, Search, Send, WalletCards } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { useSendFunds } from "@/components/wallet/send-funds-context";
import { WalletViewSelector } from "@/components/resolve/fund/wallet-view-selector";
import { CapitalCommandSkeleton } from "@/components/resolve/capital/capital-command-center";
import type { CapitalBootstrap } from "@/lib/capital/bootstrap";
import { useCapitalBootstrapQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

type CapitalView = "treasury" | "pending" | "claims" | "history";
type PendingType = "authorization" | "funding" | "settlement";
type PendingRow = {
  id: string;
  type: PendingType;
  origin: string;
  community: string;
  amount: string;
  status: string;
  createdAt: string;
  detail: string;
  href: string | null;
};

const VIEWS: Array<{ id: CapitalView; label: string }> = [
  { id: "treasury", label: "Treasury" },
  { id: "pending", label: "Pending" },
  { id: "claims", label: "Claims" },
  { id: "history", label: "History" },
];

const VIEW_ALIASES: Record<string, CapitalView> = {
  overview: "treasury",
  authorizations: "pending",
  settlements: "pending",
  activity: "history",
};

const panel = "rounded-2xl border border-white/[0.08] bg-[#07111d]";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.11] bg-white/[0.035] px-4 text-xs font-semibold text-slate-200 transition hover:border-blue-300/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-50";

function money(value: string | null | undefined) {
  const amount = BigInt(value ?? "0");
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toLocaleString("en-US")}.${fraction}`;
}

function short(value: string | null | undefined) {
  return value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "Unavailable";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = ["confirmed", "settled", "completed", "ready"].includes(normalized)
    ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
    : ["failed", "reverted", "rejected", "cancelled", "sync_failed"].includes(normalized)
      ? "border-rose-400/20 bg-rose-400/[0.08] text-rose-300"
      : "border-amber-400/20 bg-amber-400/[0.08] text-amber-200";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

function Empty({ title, body, children, heading = "h3" }: { title: string; body: string; children?: React.ReactNode; heading?: "h1" | "h2" | "h3" }) {
  const Heading = heading;
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.018] px-5 py-8 text-center"><Heading className="text-sm font-semibold text-white">{title}</Heading><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#8394ad]">{body}</p>{children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}</div>;
}

function ContextHandoff({ params }: { params: URLSearchParams }) {
  const entries = [
    ["Mission report", params.get("missionReport")],
    ["Program", params.get("program")],
    ["Community", params.get("community")],
    ["Funding intent", params.get("fundingIntent")],
    ["Settlement batch", params.get("settlementBatch")],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (!entries.length) return null;
  const returnTo = safeReturnTo(params.get("returnTo"));
  return (
    <section className="rounded-2xl border border-violet-400/20 bg-[linear-gradient(110deg,rgba(124,92,255,.09),rgba(27,140,255,.04))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Workflow handoff</p><h2 className="mt-1 text-sm font-semibold text-white">Capital retained the originating context</h2></div>
        {returnTo && <Link href={returnTo} className={secondaryButton}>Return to origin<ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      <dl className="mt-3 flex flex-wrap gap-2">{entries.map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.08] bg-[#07111d]/80 px-3 py-2"><dt className="text-[9px] uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 max-w-64 truncate font-mono text-[11px] text-slate-300">{value}</dd></div>)}</dl>
    </section>
  );
}

export function CapitalOperations({ initialData = null }: { initialData?: CapitalBootstrap | null }) {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { openAddFunds } = useAddFunds();
  const { openSendFunds } = useSendFunds();
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useCapitalBootstrapQuery(Boolean(user || initialData), initialData);
  const data = query.data ?? initialData;
  const requested = params.get("view");
  const normalized = requested ? VIEW_ALIASES[requested] ?? requested : "treasury";
  const view: CapitalView = VIEWS.some((item) => item.id === normalized) ? normalized as CapitalView : "treasury";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PendingType>("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const selectView = (nextView: CapitalView) => {
    const next = new URLSearchParams(params.toString());
    nextView === "treasury" ? next.delete("view") : next.set("view", nextView);
    router.replace(`/capital${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const refresh = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/capital/sync", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "manual_refresh", idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Capital synchronization could not start");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      await queryClient.invalidateQueries({ queryKey: queryKeys.capitalBootstrap, exact: true });
      await query.refetch();
      setNotice("Capital synchronization started. Confirmed values refresh when the Arc read completes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Capital synchronization failed");
    } finally {
      setBusy(false);
    }
  };

  const pendingRows = useMemo<PendingRow[]>(() => {
    if (!data) return [];
    return [
      ...data.authorizations.map((row) => ({
        id: row.id,
        type: "authorization" as const,
        origin: row.label,
        community: "Mission",
        amount: row.totalMicroUsdc,
        status: row.readyPayeeCount === row.obligationCount ? row.status : "payout_destination_required",
        createdAt: row.createdAt,
        detail: `${row.obligationCount} obligations · ${row.readyPayeeCount}/${row.obligationCount} payout ready · ${row.evidenceCount} evidence records`,
        href: `/mission?mission=${encodeURIComponent(row.missionId)}`,
      })),
      ...data.fundingIntents.map((row) => ({
        id: row.id,
        type: "funding" as const,
        origin: row.programId ?? "Funding intent",
        community: row.communitySlug ?? "Unscoped",
        amount: row.amountMicroUsdc,
        status: row.status,
        createdAt: row.createdAt,
        detail: row.expiresAt ? `Expires ${formatDate(row.expiresAt)}` : "No persisted expiry",
        href: safeReturnTo(row.returnTo),
      })),
      ...data.settlementQueue.filter((row) => row.status !== "confirmed").map((row) => ({
        id: row.id,
        type: "settlement" as const,
        origin: "Settlement batch",
        community: row.communitySlug ?? "Unscoped",
        amount: row.totalMicroUsdc,
        status: row.transactionStatus ?? row.status,
        createdAt: row.updatedAt,
        detail: `${row.payeeCount} recipients${row.failureMessage ? ` · ${row.failureMessage}` : ""}`,
        href: null,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data]);

  const filteredPending = useMemo(() => pendingRows.filter((row) => {
    const text = `${row.type} ${row.origin} ${row.community} ${row.status} ${row.detail}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (typeFilter === "all" || row.type === typeFilter) && (statusFilter === "all" || row.status === statusFilter);
  }), [pendingRows, search, statusFilter, typeFilter]);

  if (!user && !initialData) {
    return <main className="mx-auto w-full max-w-[1400px] px-4 py-10"><Empty heading="h1" title="Sign in to open Capital" body="Capital reads your persisted wallet, funding, authorization, claim, settlement, and receipt records."><button type="button" onClick={openSignIn} className="min-h-11 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white">Sign in</button></Empty></main>;
  }
  if (!data && query.isLoading) return <CapitalCommandSkeleton />;
  if (!data) return <main className="mx-auto max-w-[1400px] px-4 py-10"><Empty heading="h1" title="Capital is temporarily unavailable" body="No financial record was replaced. Retry the consolidated bootstrap request."><button type="button" onClick={() => void query.refetch()} className={secondaryButton}>Retry</button></Empty></main>;

  const selected = data.balances.selected;
  const pendingSettlementCount = data.settlementQueue.filter((row) => !["confirmed", "rejected", "reversed", "cancelled"].includes(row.status)).length;
  const blockedClaims = data.claims.filter((claim) => Boolean(claim.blockerCode) || !claim.identityId || !claim.payoutDestinationId);
  const attention = [
    ...(!selected ? [{ id: "wallet", title: "Active wallet unavailable", detail: "Treasury actions require a persisted wallet selection.", action: "Open Profile", href: "/profile?view=wallets&returnTo=%2Fcapital" }] : []),
    ...(data.sync.balanceState === "stale" || data.sync.balanceState === "unknown" ? [{ id: "sync", title: "Confirmed balance is not current", detail: `The command band is showing ${data.sync.balanceState} persisted state.`, action: "Synchronize", href: null }] : []),
    ...(data.authorizations.length ? [{ id: "authorization", title: `${data.authorizations.length} authorization package${data.authorizations.length === 1 ? "" : "s"} require review`, detail: "Review evidence, recipients, and payout readiness before execution.", action: "Review pending", href: null }] : []),
    ...(blockedClaims.length ? [{ id: "claims", title: `${blockedClaims.length} claim${blockedClaims.length === 1 ? "" : "s"} blocked by identity or payout setup`, detail: "Financial state remains preserved while recipient configuration is completed in Profile.", action: "Review claims", href: null }] : []),
    ...(pendingSettlementCount ? [{ id: "settlement", title: `${pendingSettlementCount} settlement${pendingSettlementCount === 1 ? "" : "s"} not yet confirmed`, detail: "Pending and submitted states are not presented as settled.", action: "Review pending", href: null }] : []),
  ];
  const primary = data.authorizations.length
    ? { label: "Review authorizations", action: () => selectView("pending") }
    : pendingSettlementCount
      ? { label: "Review settlement", action: () => selectView("pending") }
      : blockedClaims.length
        ? { label: "Review claims", action: () => selectView("claims") }
        : BigInt(data.moneyState.availableMicroUsdc) === 0n
          ? { label: "Add funds", action: () => openAddFunds() }
          : { label: "View treasury", action: () => selectView("treasury") };
  const statusOptions = [...new Set(pendingRows.map((row) => row.status))];

  return (
    <main className="min-h-screen bg-[#030711] text-[#f5f8fc] [background-image:linear-gradient(rgba(72,115,169,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(72,115,169,.04)_1px,transparent_1px)] [background-size:40px_40px]">
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-[#071220]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-300">Capital operations</p><h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-white">Where money can move, what needs approval, and what Arc has confirmed.</h1><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#91a2b9]"><span>Arc Testnet</span><span>{data.wallets.selectedCapitalWallet === "connected" ? "Connected wallet" : "RESOLVE wallet"} · {short(selected?.address)}</span><span>{data.sync.lastSuccessfulSyncAt ? `Synchronized ${formatDate(data.sync.lastSuccessfulSyncAt)}` : "No confirmed refresh"}</span></div></div><button type="button" onClick={primary.action} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-500 px-4 text-xs font-semibold text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200">{primary.label}<ArrowRight className="h-4 w-4" /></button></div>
        </header>

        <ContextHandoff params={new URLSearchParams(params.toString())} />

        <section aria-label="Treasury command band" className="grid overflow-hidden rounded-3xl border border-white/[0.09] bg-[#07111e]/95 shadow-[0_24px_80px_rgba(0,0,0,.22)] lg:grid-cols-[.9fr_1.1fr]">
          <div className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r lg:p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10"><WalletCards className="h-5 w-5 text-cyan-300" /></div><div><p className="text-sm font-semibold text-white">Application spendable</p><p className="font-mono text-[11px] text-[#8192aa]">From selected {selected?.walletType ?? "wallet"}</p></div></div><p className="mt-6 text-4xl font-semibold tracking-[-.04em] tabular-nums text-white">{money(data.moneyState.availableMicroUsdc)}</p><p className="mt-1 text-xs text-[#8fa0b6]">On-chain selected balance: {money(selected?.amountMicroUsdc)}</p><div className="mt-5"><WalletViewSelector appAddress={data.wallets.appWallet?.address} externalAddress={data.wallets.connectedWallet?.address} appUsd={Number(BigInt(data.balances.app?.amountMicroUsdc ?? "0")) / 1_000_000} externalUsd={Number(BigInt(data.balances.connected?.amountMicroUsdc ?? "0")) / 1_000_000} selectedView={data.wallets.selectedCapitalWallet === "connected" ? "external" : "app"} compact /></div></div>
          <dl className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-3"><div className="bg-[#081421] p-4"><dt className="text-[10px] uppercase tracking-wider text-[#71839b]">Available</dt><dd className="mt-2 text-lg font-semibold tabular-nums text-white">{money(data.moneyState.availableMicroUsdc)}</dd></div><div className="bg-[#081421] p-4"><dt className="text-[10px] uppercase tracking-wider text-[#71839b]">Reserved</dt><dd className="mt-2 text-lg font-semibold tabular-nums text-white">{money(data.moneyState.reservedMicroUsdc)}</dd></div><div className="bg-[#081421] p-4"><dt className="text-[10px] uppercase tracking-wider text-[#71839b]">Pending authorization</dt><dd className="mt-2 text-lg font-semibold tabular-nums text-white">{money(data.moneyState.committedMicroUsdc)}</dd></div><div className="bg-[#081421] p-4"><dt className="text-[10px] uppercase tracking-wider text-[#71839b]">Pending settlement</dt><dd className="mt-2 text-lg font-semibold tabular-nums text-white">{money(data.moneyState.pendingMicroUsdc)}</dd></div><div className="bg-[#081421] p-4"><dt className="text-[10px] uppercase tracking-wider text-[#71839b]">Claimable</dt><dd className="mt-2 text-lg font-semibold tabular-nums text-white">{money(data.moneyState.claimableMicroUsdc)}</dd></div><div className="bg-[#081421] p-4"><dt className="text-[10px] uppercase tracking-wider text-[#71839b]">Settled · 30d</dt><dd className="mt-2 text-lg font-semibold tabular-nums text-white">{money(data.moneyState.settledThirtyDayMicroUsdc)}</dd></div></dl>
        </section>

        {notice && <div role="status" className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-xs text-cyan-100">{notice}</div>}

        {attention.length > 0 && <section className={`${panel} p-4`}><div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-200" /><h2 className="text-sm font-semibold text-white">Attention required</h2></div><div className="grid gap-2 lg:grid-cols-2">{attention.map((item) => <article key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-3"><div><p className="text-xs font-medium text-amber-50">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-[#9ba9ba]">{item.detail}</p></div>{item.href ? <Link href={item.href} className="shrink-0 text-xs font-medium text-blue-300">{item.action}</Link> : <button type="button" disabled={busy && item.id === "sync"} onClick={() => item.id === "sync" ? void refresh() : selectView(item.id === "claims" ? "claims" : "pending")} className="shrink-0 text-xs font-medium text-blue-300">{item.action}</button>}</article>)}</div></section>}

        <nav aria-label="Capital sections" role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#07111d] p-1.5">{VIEWS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => selectView(item.id)} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${view === item.id ? "bg-blue-500/[0.18] text-white shadow-[inset_0_0_0_1px_rgba(79,166,255,.3)]" : "text-[#8ea0b7] hover:text-white"}`}>{item.label}</button>)}</nav>

        {view === "treasury" && <section className={`${panel} p-5`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Treasury</p><h2 className="mt-1 text-lg font-semibold text-white">Active wallet and movement controls</h2><p className="mt-1 text-xs text-[#8192aa]">Funding and transfer dialogs preserve the existing wallet handlers.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openAddFunds()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-500 px-4 text-xs font-semibold text-white"><CircleDollarSign className="h-4 w-4" />Add funds</button><button type="button" onClick={() => openSendFunds()} className={secondaryButton}><Send className="h-4 w-4" />Send</button><button type="button" onClick={() => void refresh()} disabled={busy} className={secondaryButton}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Synchronize</button></div></div><div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-xl border border-white/[0.07] bg-[#081421] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">{data.wallets.selectedCapitalWallet === "connected" ? "Connected wallet" : "RESOLVE application wallet"}</p><p className="mt-1 break-all font-mono text-xs text-[#8192aa]">{selected?.address ?? "No persisted wallet"}</p></div><Status value={data.sync.balanceState} /></div><div className="mt-4 flex flex-wrap gap-2">{selected?.address && <button type="button" onClick={() => void navigator.clipboard.writeText(selected.address)} className={secondaryButton}><Copy className="h-3.5 w-3.5" />Copy address</button>}{selected?.address && <a href={`https://testnet.arcscan.app/address/${selected.address}`} target="_blank" rel="noreferrer" className={secondaryButton}>ArcScan<ExternalLink className="h-3.5 w-3.5" /></a>}</div></div><div className="rounded-xl border border-white/[0.07] bg-[#081421] p-4"><p className="text-[10px] uppercase tracking-wider text-[#71839b]">Portfolio provenance</p><p className="mt-2 text-2xl font-semibold tabular-nums text-white">{money(data.balances.portfolioTotalMicroUsdc)}</p><p className="mt-2 text-xs leading-5 text-[#8192aa]">Portfolio total is separate from selected-wallet spendable capital. State: {data.sync.balanceState}; network: {data.sync.networkHealth}.</p></div></div></section>}

        {view === "pending" && <section><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Operational queue</p><h2 className="mt-1 text-lg font-semibold text-white">Funding, authorization, and settlement work</h2></div><span className="text-xs text-[#8192aa]">{filteredPending.length} of {pendingRows.length}</span></div><div className={`${panel} mb-3 grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto]`}><label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#040b14] px-3"><Search className="h-4 w-4 text-[#71839b]" /><span className="sr-only">Search pending work</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search origin, community, or status" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#596a80]" /></label><select aria-label="Pending type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="min-h-11 rounded-xl border border-white/[0.09] bg-[#040b14] px-3 text-xs text-slate-300"><option value="all">All types</option><option value="funding">Funding</option><option value="authorization">Authorization</option><option value="settlement">Settlement</option></select><select aria-label="Pending status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/[0.09] bg-[#040b14] px-3 text-xs text-slate-300"><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div>{filteredPending.length ? <div className={`${panel} overflow-hidden`}><div className="divide-y divide-white/[0.07]">{filteredPending.map((row) => <details key={`${row.type}:${row.id}`} className="group"><summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[110px_1fr_130px_120px_auto] sm:items-center"><span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">{row.type}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{row.origin}</p><p className="mt-1 truncate text-[11px] text-[#71839b]">{row.community}</p></div><p className="font-mono text-sm tabular-nums text-white">{money(row.amount)}</p><Status value={row.status} /><ArrowRight className="h-4 w-4 text-[#65758b] transition group-open:rotate-90" /></summary><div className="border-t border-white/[0.06] bg-[#050d17] px-4 py-3 text-xs text-[#91a2b9]"><p>{row.detail}</p><p className="mt-1">Persisted {formatDate(row.createdAt)} · durable reference {row.id}</p><div className="mt-3 flex flex-wrap gap-2">{row.href && <Link href={row.href} className={secondaryButton}>Return to origin<ArrowRight className="h-3.5 w-3.5" /></Link>}{row.status === "payout_destination_required" && <Link href={`/profile?view=wallets&returnTo=${encodeURIComponent(`/capital?view=pending&item=${row.id}`)}`} className={secondaryButton}>Resolve payout destination</Link>}</div></div></details>)}</div></div> : <Empty title="No pending work matches these filters" body="Funding intents, authorization packages, and non-final settlement batches remain visible here until their persisted state changes." />}</section>}

        {view === "claims" && <section><div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">Financial claims</p><h2 className="mt-1 text-lg font-semibold text-white">Recognized obligations and payout readiness</h2></div>{data.claims.length ? <div className={`${panel} overflow-x-auto`}><table className="w-full min-w-[820px] text-left text-xs"><thead className="border-b border-white/[0.08] text-[#71839b]"><tr><th className="px-4 py-3 font-medium">Recipient</th><th className="px-4 py-3 font-medium">Community</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Evidence</th><th className="px-4 py-3 font-medium">State</th><th className="px-4 py-3 font-medium">Required action</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.claims.map((claim) => { const missingIdentity = !claim.identityId || claim.blockerCode?.includes("identity"); const missingPayout = !claim.payoutDestinationId || claim.blockerCode === "payout_destination_required"; const returnTo = encodeURIComponent(`/capital?view=claims&claim=${claim.id}`); return <tr key={claim.id}><td className="px-4 py-3"><p className="font-medium text-white">{claim.recipient}</p><p className="mt-1 font-mono text-[10px] text-[#65758b]">{claim.id}</p></td><td className="px-4 py-3 text-slate-300">{claim.communitySlug}</td><td className="px-4 py-3 font-mono tabular-nums text-white">{money(claim.amountMicroUsdc)}</td><td className="px-4 py-3 text-slate-300">{claim.evidenceCount}</td><td className="px-4 py-3"><Status value={claim.blockerCode ?? claim.status} /></td><td className="px-4 py-3">{missingIdentity ? <Link href={`/profile?view=identities&returnTo=${returnTo}`} className="font-medium text-blue-300">Resolve identity</Link> : missingPayout ? <Link href={`/profile?view=wallets&returnTo=${returnTo}`} className="font-medium text-blue-300">Set payout route</Link> : <span className="text-emerald-300">Payout ready</span>}</td></tr>; })}</tbody></table></div> : <Empty title="No financial claims recorded" body="Recognized obligations appear here when evidence has produced a claimable financial object." />}</section>}

        {view === "history" && <section><div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-300">Financial history</p><h2 className="mt-1 text-lg font-semibold text-white">Ledger events, confirmed settlements, and receipts</h2></div>{data.recentActivity.length || data.settlementQueue.some((row) => row.status === "confirmed") ? <div className={`${panel} overflow-x-auto`}><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/[0.08] text-[#71839b]"><tr><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Truth links</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.settlementQueue.filter((row) => row.status === "confirmed").map((row) => <tr key={`settlement:${row.id}`}><td className="px-4 py-3"><p className="font-medium text-white">Settlement · {row.communitySlug ?? "Unscoped"}</p><p className="mt-1 text-[10px] text-[#65758b]">{row.payeeCount} recipients</p></td><td className="px-4 py-3 font-mono text-white">{money(row.totalMicroUsdc)}</td><td className="px-4 py-3"><Status value={row.status} /></td><td className="px-4 py-3 text-[#8192aa]">{formatDate(row.confirmedAt ?? row.updatedAt)}</td><td className="px-4 py-3"><div className="flex gap-3">{row.receiptReference && <Link href={`/outcomes/${encodeURIComponent(row.receiptReference)}`} className="text-emerald-300">Receipt</Link>}{row.transactionHash && <a href={`https://testnet.arcscan.app/tx/${row.transactionHash}`} target="_blank" rel="noreferrer" className="text-blue-300">ArcScan</a>}</div></td></tr>)}{data.recentActivity.map((row) => <tr key={`activity:${row.id}`}><td className="px-4 py-3"><p className="font-medium text-white">{row.label}</p><p className="mt-1 text-[10px] text-[#65758b]">{row.kind}</p></td><td className="px-4 py-3 font-mono text-white">{row.amountMicroUsdc ? money(row.amountMicroUsdc) : "—"}</td><td className="px-4 py-3"><Status value={row.status} /></td><td className="px-4 py-3 text-[#8192aa]">{formatDate(row.createdAt)}</td><td className="px-4 py-3 text-[#65758b]">Persisted ledger</td></tr>)}</tbody></table></div> : <Empty title="No Capital history yet" body="Deposits, funding, reservations, authorizations, settlements, claims, refunds, adjustments, and receipts appear here from persisted records." />}</section>}

        <details className="rounded-2xl border border-white/[0.07] bg-[#050c15] p-4 text-xs text-[#8192aa]"><summary className="cursor-pointer font-medium text-[#aab8c9]">Infrastructure diagnostics</summary><dl className="mt-4 grid gap-3 sm:grid-cols-4"><div><dt>Network</dt><dd className="mt-1 text-white">Arc Testnet · 5042002</dd></div><div><dt>Snapshot</dt><dd className="mt-1 text-white">{data.sync.balanceState}</dd></div><div><dt>Network health</dt><dd className="mt-1 text-white">{data.sync.networkHealth}</dd></div><div><dt>Generated</dt><dd className="mt-1 text-white">{formatDate(data.generatedAt)}</dd></div></dl><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-blue-300">Open ArcScan<ExternalLink className="h-3.5 w-3.5" /></a></details>
      </div>
    </main>
  );
}
