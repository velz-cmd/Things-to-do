"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  GitBranch,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { DiscoverActionWorkbench } from "@/components/resolve/discover/marketplace/discover-action-workbench";
import type {
  DiscoverAction,
  DiscoverActivityItem,
  DiscoverCommunity,
  DiscoverExploreKind,
  DiscoverInboxItem,
  DiscoverPageData,
  DiscoverPerson,
  DiscoverPool,
  DiscoverSourceDiagnostic,
  DiscoverView,
  EconomicActionItem,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import type { OpportunityFilters } from "@/lib/discover/marketplace/filters";

type OpenAction = (action: DiscoverAction, item?: EconomicActionItem) => void;

const views: Array<{ id: DiscoverView; label: string; icon: typeof Activity }> = [
  { id: "for_you", label: "For You", icon: Activity },
  { id: "explore", label: "Explore", icon: Search },
  { id: "activity", label: "My Activity", icon: Activity },
  { id: "outcomes", label: "Outcomes", icon: History },
];

const exploreKinds: Array<{ id: DiscoverExploreKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "people", label: "People" },
  { id: "work", label: "Verified Work" },
  { id: "pools", label: "Pools" },
  { id: "programs", label: "Programs" },
  { id: "communities", label: "Communities" },
  { id: "outcomes", label: "Outcomes" },
];

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${token}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function discoverHref(view: DiscoverView, filters: OpportunityFilters, kind = filters.kind) {
  const params = new URLSearchParams({ view });
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.category) params.set("category", filters.category);
  if (filters.skill) params.set("skill", filters.skill);
  if (filters.fundingStatus) params.set("funding", filters.fundingStatus);
  if (filters.community) params.set("community", filters.community);
  if (filters.repository) params.set("repository", filters.repository);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.remote) params.set("remote", "true");
  if (filters.deadline) params.set("deadline", filters.deadline);
  if (view === "explore" && kind) params.set("kind", kind);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return `/discover?${params.toString()}`;
}

function track(actionId: string, properties?: Record<string, string | number | boolean>) {
  const payload = JSON.stringify({ event: actionId, properties, path: window.location.pathname });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/discover/events", new Blob([payload], { type: "application/json" }));
    return;
  }
  void fetch("/api/discover/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

function detailAction(
  entityType: "person" | "work" | "pool" | "program" | "community",
  subjectId: string,
  label: string,
): DiscoverAction {
  const ids = {
    person: "discover.open_people",
    work: "discover.open_evidence",
    pool: "discover.open_pools",
    program: "discover.open_program",
    community: "community.open",
  } as const;
  return {
    id: ids[entityType],
    label,
    href: `/discover?view=explore&kind=${entityType === "person" ? "people" : entityType === "work" ? "work" : `${entityType}s`}&action=${ids[entityType]}&subject=${encodeURIComponent(subjectId)}`,
    enabled: true,
    presentation: {
      kind: "workbench",
      target: { panel: "entity_details", subjectId, entityType },
    },
  };
}

function findContext(data: DiscoverPageData, subjectId: string) {
  return data.economicActions.find((item) =>
    item.subjectId === subjectId ||
    item.poolId === subjectId ||
    item.programId === subjectId ||
    item.receiptId === subjectId,
  );
}

function Header({ filters, view }: { filters: OpportunityFilters; view: DiscoverView }) {
  return (
    <header className="grid min-h-[96px] gap-4 rounded-2xl border border-white/[0.08] bg-[#081321] px-5 py-4 lg:grid-cols-[minmax(260px,.7fr)_minmax(420px,1fr)] lg:items-center lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Discover</h1>
        <p className="mt-1 text-sm text-slate-400">Find people, verified work, Pools and outcomes.</p>
      </div>
      <SearchBox filters={filters} view={view} />
    </header>
  );
}

function SearchBox({ filters, view }: { filters: OpportunityFilters; view: DiscoverView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.toString();
  const [query, setQuery] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();
  useEffect(() => setQuery(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (query === (filters.q ?? "")) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(current);
      next.set("view", view);
      next.delete("cursor");
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [current, filters.q, pathname, query, router, view]);
  return (
    <form role="search" className="relative" onSubmit={(event) => event.preventDefault()}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" aria-label="Search Discover" placeholder="Search people, work, Pools, Programs or communities" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#050e19] pl-11 pr-11 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
      {pending ? <LoaderCircle aria-label="Updating results" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-300" /> : null}
    </form>
  );
}

function ViewTabs({ active, filters }: { active: DiscoverView; filters: OpportunityFilters }) {
  const [selected, setSelected] = useState(active);
  useEffect(() => setSelected(active), [active]);
  useEffect(() => {
    if (selected === active) return;
    const recovery = window.setTimeout(() => setSelected(active), 10_000);
    return () => window.clearTimeout(recovery);
  }, [active, selected]);
  return (
    <nav aria-label="Discover sections" className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#07111f] p-1">
      {views.map((view) => {
        const Icon = view.icon;
        const loading = selected === view.id && selected !== active;
        return (
          <Link key={view.id} href={discoverHref(view.id, filters)} prefetch aria-current={selected === view.id ? "page" : undefined} onClick={(event) => { if (selected === view.id) event.preventDefault(); else setSelected(view.id); }} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm transition ${selected === view.id ? "bg-[#1a2940] font-semibold text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}>
            <Icon className="h-4 w-4" />{view.label}{loading ? <LoaderCircle aria-label={`Loading ${view.label}`} className="h-3.5 w-3.5 animate-spin text-violet-300" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ContextualAction({ action, item, primary = false, onOpen }: { action: DiscoverAction; item?: EconomicActionItem; primary?: boolean; onOpen: OpenAction }) {
  const classes = primary
    ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400"
    : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/[0.05]";
  if (!action.enabled) return <button type="button" disabled title={action.disabledReason} className={`${classes} cursor-not-allowed opacity-50`}>{action.label}</button>;
  if (action.presentation.kind === "workbench") {
    const subjectId = action.presentation.target.subjectId;
    return <button type="button" data-action-id={action.id} onClick={() => { track("discover_action_opened", { actionId: action.id, subject: item?.subjectId ?? subjectId }); onOpen(action, item); }} className={classes}>{action.label}{primary ? <ArrowRight className="h-4 w-4" /> : null}</button>;
  }
  return <Link href={action.href} target={action.presentation.target === "external" ? "_blank" : undefined} rel={action.presentation.target === "external" ? "noreferrer" : undefined} data-action-id={action.id} className={classes}>{action.label}{action.presentation.target === "external" ? <ExternalLink className="h-3.5 w-3.5" /> : null}</Link>;
}

function PersonCard({ person, data, onOpen }: { person: DiscoverPerson; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, person.id);
  const details = detailAction("person", person.id, "View profile");
  const primaryIsUseful = person.primaryAction.presentation.kind === "workbench";
  return (
    <article className="min-w-[240px] rounded-xl border border-white/[0.08] bg-[#091522] p-4">
      <div className="flex items-center gap-3">{person.avatar ? <Image unoptimized src={person.avatar} alt="" width={44} height={44} className="h-11 w-11 rounded-full border border-white/10 object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-violet-400/12 text-sm font-semibold text-violet-100">{person.name.slice(0, 2).toUpperCase()}</span>}<div className="min-w-0"><h3 className="truncate font-semibold text-white">{person.name}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{person.verifiedIdentities[0] ?? "Attributed identity"}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-1.5">{person.skills.slice(0, 3).map((skill) => <span key={skill} className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-slate-300">{skill}</span>)}</div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3 text-xs"><div><dt className="text-slate-500">Accepted work</dt><dd className="mt-1 font-medium text-white">{person.completedWork ?? 0}</dd></div><div><dt className="text-slate-500">Payout</dt><dd className={`mt-1 font-medium ${person.payoutReadiness === "ready" ? "text-emerald-300" : "text-amber-200"}`}>{person.payoutReadiness === "ready" ? "Ready" : person.payoutReadiness === "invite_to_claim" ? "Claim needed" : "Choose wallet"}</dd></div></dl>
      <div className="mt-4 flex flex-wrap gap-2"><ContextualAction action={primaryIsUseful ? person.primaryAction : details} item={context} primary onOpen={onOpen} />{primaryIsUseful ? <ContextualAction action={details} item={context} onOpen={onOpen} /> : null}</div>
    </article>
  );
}

function WorkRow({ work, data, onOpen }: { work: MarketplaceOpportunity; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, work.source.id);
  return (
    <article className="grid gap-4 rounded-xl border border-white/[0.08] bg-[#091522] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1.5 text-cyan-300"><GitBranch className="h-3.5 w-3.5" />{work.repository ?? "GitHub"}</span><span className="text-slate-600">{dateLabel(work.updatedAt)}</span></div><h3 className="mt-2 font-semibold text-white">{work.title}</h3><p className="mt-1 text-sm text-slate-400">{work.creator.name} / {work.category?.replaceAll("_", " ") ?? "accepted contribution"}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span>{work.evidenceRequirements.length || 1} evidence record{work.evidenceRequirements.length === 1 ? "" : "s"}</span><span>{work.entityState?.financialReadiness === "ready" ? "Funding available" : "No active funding rule"}</span></div></div>
      <ContextualAction action={work.primaryAction ?? detailAction("work", work.source.id, "Inspect evidence")} item={context} primary onOpen={onOpen} />
    </article>
  );
}

function PoolCard({ pool, data, onOpen }: { pool: DiscoverPool; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, pool.id);
  const target = pool.targetUsd;
  const confirmed = pool.balanceUsd;
  const progress = target && target > 0 && confirmed != null ? Math.min(100, Math.max(0, (confirmed / target) * 100)) : null;
  const ready = pool.lifecycleState === "accepting_funding";
  const operatorAction = pool.primaryAction.presentation.kind === "workbench" && pool.primaryAction.presentation.target.panel === "program_setup";
  const details = detailAction("pool", pool.id, "View Pool");
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-emerald-300">{pool.communitySlug}</p><h3 className="mt-2 text-lg font-semibold text-white">{pool.name}</h3><p className="mt-1 text-sm text-slate-500">{pool.type}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] ${ready ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-100"}`}>{ready ? "Accepting funds" : "Setup incomplete"}</span></div>
      {pool.purpose ? <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{pool.purpose}</p> : null}
      <div className="mt-5"><div className="flex items-end justify-between text-xs"><span className="text-slate-500">Confirmed funding</span><span className="text-slate-200">{money(confirmed) ?? "Not confirmed"}{target ? ` / ${money(target)}` : ""}</span></div>{progress != null ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} /></div> : null}{pool.pendingDepositsUsd ? <p className="mt-2 text-xs text-amber-100">{money(pool.pendingDepositsUsd)} pending confirmation</p> : null}</div>
      {!ready ? <p className="mt-4 rounded-lg bg-amber-300/[0.04] px-3 py-2 text-xs leading-5 text-amber-100">{operatorAction ? pool.blocker : "Funding is not available until setup is complete."}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2"><ContextualAction action={ready || operatorAction ? pool.primaryAction : details} item={context} primary onOpen={onOpen} />{ready || operatorAction ? <ContextualAction action={details} item={context} onOpen={onOpen} /> : null}</div>
    </article>
  );
}

function ProgramCard({ program, data, onOpen }: { program: MarketplaceOpportunity; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, program.source.id);
  const policyReady = program.entityState?.financialReadiness === "ready";
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-cyan-300">{program.community?.name ?? "Community Program"}</p><h3 className="mt-2 text-lg font-semibold text-white">{program.title}</h3></div><span className={`rounded-full border px-2 py-1 text-[11px] ${policyReady ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-100"}`}>{policyReady ? "Active policy" : "Review needed"}</span></div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{program.summary}</p>
      <dl className="mt-4 grid gap-3 border-y border-white/[0.07] py-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Recognises</dt><dd className="mt-1 text-slate-200">{program.deliverables.slice(0, 2).join(", ") || program.category?.replaceAll("_", " ") || "Configured activity"}</dd></div><div><dt className="text-slate-500">Source</dt><dd className="mt-1 text-slate-200">{program.repository ?? program.source.type.replaceAll("_", " ")}</dd></div></dl>
      <div className="mt-4"><ContextualAction action={program.primaryAction ?? detailAction("program", program.source.id, "View Program")} item={context} primary onOpen={onOpen} /></div>
    </article>
  );
}

function CommunityCard({ community, data, onOpen }: { community: DiscoverCommunity; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, community.id);
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><Building2 className="h-5 w-5" /></span><div><h3 className="font-semibold text-white">{community.name}</h3><p className="mt-1 text-xs text-slate-500">{community.type}</p></div></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{community.purpose}</p><dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-3 text-xs"><div><dt className="text-slate-500">Activity</dt><dd className="mt-1 text-white">{community.activeOpportunities ?? 0}</dd></div><div><dt className="text-slate-500">Pools</dt><dd className="mt-1 text-white">{community.activePools ?? 0}</dd></div><div><dt className="text-slate-500">Source</dt><dd className="mt-1 text-white">Verified</dd></div></dl><div className="mt-4"><ContextualAction action={detailAction("community", community.id, "Explore community")} item={context} primary onOpen={onOpen} /></div></article>
  );
}

function OutcomeRow({ outcome, data, onOpen }: { outcome: MarketplaceOpportunity; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, outcome.source.id);
  return (
    <article className="grid gap-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-xs font-medium text-emerald-300">Confirmed outcome</p><h3 className="mt-1 font-semibold text-white">{outcome.title}</h3><p className="mt-1 text-xs text-slate-500">{outcome.community?.name ?? "RESOLVE"} / {dateLabel(outcome.updatedAt)} / {outcome.reward?.network ?? "Arc"}</p></div><div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-white">{money(outcome.funding?.fundedAmountUsd, outcome.reward?.token)}</span>{outcome.primaryAction ? <ContextualAction action={outcome.primaryAction} item={context} primary onOpen={onOpen} /> : null}</div></article>
  );
}

function AttentionRow({ item, data, onOpen }: { item: DiscoverInboxItem; data: DiscoverPageData; onOpen: OpenAction }) {
  const context = findContext(data, item.id);
  return <article className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-medium text-white">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{item.why}</p>{item.blocker ? <p className="mt-1 text-xs text-amber-200">{item.blocker}</p> : null}</div><ContextualAction action={item.primaryAction} item={context} onOpen={onOpen} /></article>;
}

function ActivityRow({ item, data, onOpen }: { item: DiscoverActivityItem; data: DiscoverPageData; onOpen: OpenAction }) {
  const Icon = item.kind === "receipt" ? BadgeCheck : item.kind === "work" ? FileCheck2 : item.kind === "program" ? GitBranch : item.kind === "account" ? UserRound : WalletCards;
  const context = findContext(data, item.id.replace(/^[^:]+:/, ""));
  return <article className="grid gap-3 border-b border-white/[0.07] px-1 py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-slate-300"><Icon className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium text-white">{item.title}</h3><span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-400">{item.state.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-slate-500">{item.description}{item.amountUsd != null ? ` / ${money(item.amountUsd, item.token)}` : ""}</p></div>{item.primaryAction ? <ContextualAction action={item.primaryAction} item={context} onOpen={onOpen} /> : null}</article>;
}

function SectionTitle({ title, count, href }: { title: string; count?: number; href?: string }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">{title}{count != null ? <span className="ml-2 text-xs font-normal text-slate-500">{count}</span> : null}</h2>{href ? <Link href={href} className="text-xs font-medium text-violet-300 hover:text-violet-200">View all</Link> : null}</div>;
}

function SourceFailure({ data }: { data: DiscoverPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const failure = data.opportunities.failures[0];
  if (!failure) return null;
  return <aside role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-amber-100">One source could not refresh. Last-known records remain visible.</p><p className="mt-1 text-xs text-amber-200/60">{failure.message} Request {failure.requestId.slice(0, 8)}.</p></div><button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-200/20 px-3 text-xs font-medium text-amber-100 disabled:opacity-50">{pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Retry</button></aside>;
}

function ForYouView({ data, filters, onOpen }: { data: DiscoverPageData; filters: OpportunityFilters; onOpen: OpenAction }) {
  if (data.projection.kind !== "for_you") return null;
  const projection = data.projection;
  const recommendation = projection.recommendation;
  return <div className="space-y-7"><section><p className="text-xs font-semibold text-violet-300">Personal</p><h2 className="mt-1 text-2xl font-semibold text-white">Your next moves</h2>{recommendation ? <div className="mt-4 flex flex-col gap-4 rounded-xl border border-violet-300/15 bg-[linear-gradient(120deg,rgba(105,79,220,.14),rgba(7,17,31,.95)_55%)] p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs text-violet-200">Recommended now</p><h3 className="mt-2 text-lg font-semibold text-white">{recommendation.title}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{recommendation.why}</p></div><ContextualAction action={recommendation.primaryAction} primary onOpen={onOpen} /></div> : <p className="mt-3 text-sm text-slate-400">No personal action needs attention right now. Explore current people, work and Pools below.</p>}</section>{projection.attention.length ? <section><SectionTitle title="Needs your attention" count={projection.attention.length} /><div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08] bg-[#091522]">{projection.attention.map((item) => <AttentionRow key={item.id} item={item} data={data} onOpen={onOpen} />)}</div></section> : null}{projection.pools.length ? <section><SectionTitle title="Pools for you" href={discoverHref("explore", { ...filters, kind: "pools" }, "pools")} /><div className="grid gap-3 lg:grid-cols-2">{projection.pools.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}</div></section> : null}{projection.people.length ? <section><SectionTitle title="People you may want to support" href={discoverHref("explore", { ...filters, kind: "people" }, "people")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{projection.people.map((person) => <PersonCard key={person.id} person={person} data={data} onOpen={onOpen} />)}</div></section> : null}{projection.inProgress.length ? <section><SectionTitle title="In progress" /><div className="rounded-xl border border-white/[0.08] bg-[#091522] px-4">{projection.inProgress.map((item) => <ActivityRow key={item.id} item={item} data={data} onOpen={onOpen} />)}</div></section> : null}{projection.recent.length ? <section><SectionTitle title="Recently changed" /><div className="rounded-xl border border-white/[0.08] bg-[#091522] px-4">{projection.recent.map((item) => <ActivityRow key={item.id} item={item} data={data} onOpen={onOpen} />)}</div></section> : null}</div>;
}

function ExploreNav({ active, filters }: { active: DiscoverExploreKind; filters: OpportunityFilters }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.toString();
  const [selected, setSelected] = useState(active);

  useEffect(() => setSelected(active), [active]);
  useEffect(() => {
    if (selected === active) return;
    const recovery = window.setTimeout(() => setSelected(active), 10_000);
    return () => window.clearTimeout(recovery);
  }, [active, selected]);

  function navigate(kind: DiscoverExploreKind) {
    if (kind === selected) return;
    const next = new URLSearchParams(current);
    next.set("view", "explore");
    next.set("kind", kind);
    next.delete("cursor");
    next.delete("action");
    next.delete("subject");
    setSelected(kind);
    router.push(`/discover?${next.toString()}`, { scroll: false });
  }

  return (
    <nav aria-label="Marketplace categories" className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#07111f] p-1">
      {exploreKinds.map((kind) => {
        const loading = selected === kind.id && selected !== active;
        return (
          <Link
            key={kind.id}
            href={discoverHref("explore", filters, kind.id)}
            prefetch
            aria-current={selected === kind.id ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate(kind.id);
            }}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${selected === kind.id ? "bg-[#1a2940] font-semibold text-white" : "text-slate-400 hover:text-white"}`}
          >
            {kind.label}
            {loading ? <LoaderCircle aria-label={`Loading ${kind.label}`} className="h-3 w-3 animate-spin text-violet-300" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ExploreControls({ filters }: { filters: OpportunityFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const current = params.toString();
  useEffect(() => setPending(false), [current]);
  const activeCount = [filters.fundingStatus, filters.remote, filters.community, filters.repository, filters.type]
    .filter(Boolean).length;

  function update(key: string, value?: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("cursor");
    if (value) next.set(key, value);
    else next.delete(key);
    setFiltersOpen(false);
    setPending(true);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="relative flex flex-wrap gap-2">
      <button
        type="button"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((value) => !value)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/[0.04]"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters{activeCount ? ` (${activeCount})` : ""}
      </button>
      <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-500">
        Sort
        <select
          aria-label="Sort marketplace"
          value={filters.sort}
          disabled={pending}
          onChange={(event) => update("sort", event.target.value === "newest" ? undefined : event.target.value)}
          className="bg-transparent font-medium text-slate-200 outline-none"
        >
          <option value="newest" className="bg-[#081321]">Newest</option>
          <option value="most_funded" className="bg-[#081321]">Most funded</option>
          <option value="most_active" className="bg-[#081321]">Most active</option>
          <option value="closing_soon" className="bg-[#081321]">Closing soon</option>
        </select>
        {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-violet-300" /> : null}
      </label>
      {filtersOpen ? (
        <div className="absolute right-0 top-12 z-20 w-[min(340px,calc(100vw-32px))] rounded-xl border border-white/10 bg-[#081321] p-4 shadow-2xl">
          <p className="text-xs font-semibold text-white">Funding state</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              [undefined, "Any"],
              ["unfunded", "Unfunded"],
              ["partially_funded", "Partially funded"],
              ["funded", "Funded"],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => update("funding", value)}
                className={`rounded-full border px-3 py-1.5 text-xs ${filters.fundingStatus === value || (!filters.fundingStatus && !value) ? "border-violet-300/30 bg-violet-400/10 text-white" : "border-white/10 text-slate-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => update("remote", filters.remote ? undefined : "true")}
            className={`mt-4 rounded-full border px-3 py-1.5 text-xs ${filters.remote ? "border-violet-300/30 bg-violet-400/10 text-white" : "border-white/10 text-slate-400"}`}
          >
            Remote only
          </button>
        </div>
      ) : null}
    </div>
  );
}

type RepositoryAnalysis = { ingest: { fullName: string; prCount: number; contributorCount: number; ingestedAt: string }; pullRequests: Array<{ number: number; title: string; author: string; mergedAt: string | null }> };

function RepositoryAnalyzer({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [repository, setRepository] = useState("");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"analyze" | "persist" | null>(null);
  async function analyze() { const match = repository.trim().match(/^([\w.-]+)\/([\w.-]+)$/); if (!match) { setError("Enter a public repository as owner/repository."); return; } setPending("analyze"); setError(null); try { const response = await fetch("/api/github/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner: match[1], repo: match[2] }) }); const body = await response.json() as RepositoryAnalysis & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Repository analysis failed"); setAnalysis(body); } catch (cause) { setError(cause instanceof Error ? cause.message : "Repository analysis failed"); } finally { setPending(null); } }
  async function persist() { setPending("persist"); setError(null); try { const response = await fetch("/api/discover/oss-snapshots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repository: analysis?.ingest.fullName ?? repository.trim() }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Evidence snapshot could not be saved"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Evidence snapshot could not be saved"); } finally { setPending(null); } }
  return <section className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4"><div className="grid gap-4 lg:grid-cols-[minmax(260px,.75fr)_minmax(360px,1fr)] lg:items-center"><div><p className="text-xs font-semibold text-cyan-300">Repository analyzer</p><h2 className="mt-1 font-semibold text-white">Analyse a public repository</h2><p className="mt-1 text-xs leading-5 text-slate-400">Inspect supported merged activity and contributor attribution without creating a Community.</p></div><form onSubmit={(event) => { event.preventDefault(); void analyze(); }} className="flex gap-2"><input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" aria-label="Public GitHub repository" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#050d17] px-3 text-sm text-white outline-none" /><button disabled={Boolean(pending)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white disabled:opacity-60">{pending === "analyze" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Analyse</button></form></div>{error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}{analysis ? <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/15 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-white">{analysis.ingest.fullName}</h3><p className="mt-1 text-xs text-slate-500">GitHub snapshot {dateLabel(analysis.ingest.ingestedAt)}</p></div><p className="text-xs text-slate-300">{analysis.ingest.prCount} pull requests · {analysis.ingest.contributorCount} contributors</p></div><div className="mt-3 space-y-2">{analysis.pullRequests.filter((item) => item.mergedAt).slice(0, 4).map((item) => <div key={item.number} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-300">#{item.number} {item.title} · @{item.author}</div>)}</div>{signedIn ? <button type="button" disabled={Boolean(pending)} onClick={() => void persist()} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white">{pending === "persist" ? "Saving..." : "Save evidence snapshot"}</button> : null}</div> : null}</section>;
}

function ExploreView({ data, filters, onOpen }: { data: DiscoverPageData; filters: OpportunityFilters; onOpen: OpenAction }) {
  if (data.projection.kind !== "explore") return null;
  const p = data.projection;
  const category = p.category;
  const showAll = category === "all";
  return <div className="space-y-7"><section><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold text-cyan-300">Marketplace</p><h2 className="mt-1 text-2xl font-semibold text-white">Browse the network</h2><p className="mt-1 text-sm text-slate-400">People, accepted work, funding mechanisms and confirmed results.</p></div><ExploreControls filters={filters} /></div><div className="mt-4"><ExploreNav active={category} filters={filters} /></div></section>{showAll || category === "pools" ? <section><SectionTitle title={showAll ? "Pools raising now" : "Pools"} count={p.pools.length} href={showAll ? discoverHref("explore", filters, "pools") : undefined} />{p.pools.length ? <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{p.pools.slice(0, showAll ? 3 : undefined).map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}</div> : <CompactEmpty title="No Pools match this search" body="Published Pools will appear when their stored visibility and lifecycle allow discovery." />}</section> : null}{showAll || category === "people" ? <section><SectionTitle title={showAll ? "People with verified work" : "People"} count={p.people.length} href={showAll ? discoverHref("explore", filters, "people") : undefined} />{p.people.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{p.people.slice(0, showAll ? 4 : undefined).map((person) => <PersonCard key={person.id} person={person} data={data} onOpen={onOpen} />)}</div> : <CompactEmpty title="No people match this search" body="Claimed profiles and genuine attributed contributors appear here when persisted evidence exists." />}</section> : null}{showAll || category === "work" ? <section><SectionTitle title={showAll ? "Verified work seeking support" : "Verified Work"} count={p.work.length} href={showAll ? discoverHref("explore", filters, "work") : undefined} />{p.work.length ? <div className="space-y-2">{p.work.slice(0, showAll ? 3 : undefined).map((work) => <WorkRow key={work.id} work={work} data={data} onOpen={onOpen} />)}</div> : <CompactEmpty title="No accepted work in the current snapshot" body="Connected repositories remain available. Refresh evidence or analyse a public repository below." />}</section> : null}{showAll || category === "programs" ? <section><SectionTitle title={showAll ? "Active Programs" : "Programs"} count={p.programs.length} href={showAll ? discoverHref("explore", filters, "programs") : undefined} />{p.programs.length ? <div className="grid gap-3 lg:grid-cols-2">{p.programs.slice(0, showAll ? 2 : undefined).map((program) => <ProgramCard key={program.id} program={program} data={data} onOpen={onOpen} />)}</div> : <CompactEmpty title="No Programs match this search" body="Public Programs appear here when their real source and visibility requirements are met." />}</section> : null}{showAll || category === "communities" ? <section><SectionTitle title={showAll ? "Communities with recent activity" : "Communities"} count={p.communities.length} href={showAll ? discoverHref("explore", filters, "communities") : undefined} />{p.communities.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{p.communities.slice(0, showAll ? 3 : undefined).map((community) => <CommunityCard key={community.id} community={community} data={data} onOpen={onOpen} />)}</div> : <CompactEmpty title="No Communities match this search" body="Communities appear only when genuine public activity is available." />}</section> : null}{showAll || category === "outcomes" ? <section><SectionTitle title={showAll ? "Recent confirmed outcomes" : "Outcomes"} count={p.outcomes.length} href={showAll ? discoverHref("explore", filters, "outcomes") : undefined} />{p.outcomes.length ? <div className="space-y-2">{p.outcomes.slice(0, showAll ? 2 : undefined).map((outcome) => <OutcomeRow key={outcome.id} outcome={outcome} data={data} onOpen={onOpen} />)}</div> : showAll ? null : <CompactEmpty title="No confirmed outcomes yet" body="Only receipt-backed confirmed settlements are shown." />}</section> : null}<RepositoryAnalyzer signedIn={data.signedIn} /></div>;
}

function ActivityView({ data, onOpen }: { data: DiscoverPageData; onOpen: OpenAction }) {
  const { openSignIn } = useSignInModal();
  const params = useSearchParams();
  if (data.projection.kind !== "activity") return null;
  if (!data.signedIn) return <CompactEmpty title="Sign in to view your activity" body="Your work, funding, claims, transactions and receipts require your account session." action={<button type="button" onClick={openSignIn} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">Sign in</button>} />;
  const activeFilter = params.get("activity") ?? "all";
  const supported = ["work", "funding", "claim", "pool", "transaction", "receipt", "program"].filter((kind) => data.projection.kind === "activity" && data.projection.items.some((item) => item.kind === kind));
  const items = activeFilter === "all" ? data.projection.items : data.projection.items.filter((item) => item.kind === activeFilter);
  const grouped = items.reduce<Record<string, DiscoverActivityItem[]>>((groups, item) => { const key = dateLabel(item.occurredAt); (groups[key] ??= []).push(item); return groups; }, {});
  const summary = Object.entries(data.projection.summary).filter(([, value]) => Boolean(value));
  return <div className="space-y-6"><section><p className="text-xs font-semibold text-violet-300">Personal ledger</p><h2 className="mt-1 text-2xl font-semibold text-white">Your activity</h2><p className="mt-1 text-sm text-slate-400">What you completed, funded, received, claimed or started.</p>{summary.length ? <dl className="mt-4 flex flex-wrap gap-2">{summary.map(([kind, value]) => <div key={kind} className="rounded-lg border border-white/[0.08] bg-[#091522] px-3 py-2"><dt className="text-[10px] capitalize text-slate-500">{kind.replaceAll("_", " ")}</dt><dd className="mt-0.5 text-sm font-semibold text-white">{value}</dd></div>)}</dl> : null}<nav aria-label="Activity filters" className="mt-4 flex gap-1 overflow-x-auto"><Link href="/discover?view=activity" className={`rounded-full border px-3 py-1.5 text-xs ${activeFilter === "all" ? "border-violet-300/30 bg-violet-400/10 text-white" : "border-white/10 text-slate-400"}`}>All</Link>{supported.map((kind) => <Link key={kind} href={`/discover?view=activity&activity=${kind}`} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${activeFilter === kind ? "border-violet-300/30 bg-violet-400/10 text-white" : "border-white/10 text-slate-400"}`}>{kind}</Link>)}</nav></section>{items.length ? <section className="space-y-5">{Object.entries(grouped).map(([date, rows]) => <div key={date}><h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{date}</h3><div className="rounded-xl border border-white/[0.08] bg-[#091522] px-4">{rows.map((item) => <ActivityRow key={item.id} item={item} data={data} onOpen={onOpen} />)}</div></div>)}</section> : <CompactEmpty title="No personal activity in this view" body="Only records connected to your identity, funding, Programs or receipts appear here." />}</div>;
}

function OutcomesView({ data, onOpen }: { data: DiscoverPageData; onOpen: OpenAction }) {
  if (data.projection.kind !== "outcomes") return null;
  return <div className="space-y-6"><section><p className="text-xs font-semibold text-emerald-300">Proof archive</p><h2 className="mt-1 text-2xl font-semibold text-white">Confirmed outcomes</h2><p className="mt-1 text-sm text-slate-400">Settlements and receipts backed by confirmed execution.</p></section>{data.projection.items.length ? <section className="space-y-2">{data.projection.items.map((outcome) => <OutcomeRow key={outcome.id} outcome={outcome} data={data} onOpen={onOpen} />)}</section> : <CompactEmpty title="No confirmed outcomes yet" body="Confirmed payments and Pool distributions will appear here after settlement and receipt issuance." action={<Link href="/discover?view=activity" className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">View in-progress activity</Link>} lifecycle />}</div>;
}

function CompactEmpty({ title, body, action, lifecycle = false }: { title: string; body: string; action?: ReactNode; lifecycle?: boolean }) {
  return <section className="mx-auto max-w-2xl rounded-xl border border-dashed border-white/[0.1] px-5 py-8 text-center"><h2 className="font-semibold text-white">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{body}</p>{action ? <div className="mt-4 flex justify-center">{action}</div> : null}{lifecycle ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500"><span>Prepared</span><ArrowRight className="h-3 w-3" /><span>Submitted</span><ArrowRight className="h-3 w-3" /><span>Confirmed</span><ArrowRight className="h-3 w-3" /><span>Receipt</span></div> : null}</section>;
}

function SourceDiagnostics({ data, onOpen }: { data: DiscoverPageData; onOpen: OpenAction }) {
  if (!data.sourceDiagnostics.length || data.view !== "activity") return null;
  return <section><SectionTitle title="Source status" /><div className="grid gap-3 lg:grid-cols-2">{data.sourceDiagnostics.map((diagnostic) => <SourceDiagnosticCard key={diagnostic.id} diagnostic={diagnostic} onOpen={onOpen} />)}</div></section>;
}

function SourceDiagnosticCard({ diagnostic, onOpen }: { diagnostic: DiscoverSourceDiagnostic; onOpen: OpenAction }) {
  return <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-4"><div className="flex justify-between gap-3"><div><h3 className="text-sm font-medium text-white">{diagnostic.repository ?? "GitHub connection"}</h3><p className="mt-1 text-xs capitalize text-slate-500">{diagnostic.state.replaceAll("_", " ")}</p></div>{diagnostic.stale ? <span className="text-xs text-amber-200">Last-known snapshot</span> : null}</div><p className="mt-3 text-xs leading-5 text-slate-400">{diagnostic.reason}</p><div className="mt-3"><ContextualAction action={diagnostic.primaryAction} onOpen={onOpen} /></div></article>;
}

function DiscoverMarketplaceContent({ data, filters }: { data: DiscoverPageData; filters: OpportunityFilters }) {
  const router = useRouter();
  const params = useSearchParams();
  const [active, setActive] = useState<{ action: DiscoverAction; item?: EconomicActionItem } | null>(null);
  const pendingWorkbenchKey = useRef<string | null>(null);
  useEffect(() => track("discover_viewed", { view: data.view }), [data.view]);
  const openWorkbench: OpenAction = (action, item) => {
    if (action.presentation.kind !== "workbench") return;
    pendingWorkbenchKey.current = `${action.id}:${action.presentation.target.subjectId}`;
    setActive({ action, item });
    const next = new URLSearchParams(params.toString());
    next.set("action", action.id);
    next.set("subject", action.presentation.target.subjectId);
    router.replace(`/discover?${next.toString()}`, { scroll: false });
  };
  const closeWorkbench = () => {
    pendingWorkbenchKey.current = null;
    setActive(null);
    const next = new URLSearchParams(params.toString());
    next.delete("action");
    next.delete("subject");
    router.replace(`/discover?${next.toString()}`, { scroll: false });
  };
  const generatedDetails = useMemo(() => [
    ...data.people.map((person) => detailAction("person", person.id, "View profile")),
    ...data.pools.map((pool) => detailAction("pool", pool.id, "View Pool")),
    ...data.communities.map((community) => detailAction("community", community.id, "Explore community")),
    ...data.opportunities.items.filter((item) => item.marketplaceKind === "program").map((item) => detailAction("program", item.source.id, "View Program")),
  ], [data]);
  const activeKey = active?.action.presentation.kind === "workbench"
    ? `${active.action.id}:${active.action.presentation.target.subjectId}`
    : null;
  useEffect(() => {
    const actionId = params.get("action");
    const subjectId = params.get("subject");
    if (!actionId || !subjectId) {
      if (activeKey && pendingWorkbenchKey.current === activeKey) return;
      if (activeKey) setActive(null);
      return;
    }
    const urlKey = `${actionId}:${subjectId}`;
    if (pendingWorkbenchKey.current === urlKey) pendingWorkbenchKey.current = null;
    if (activeKey === urlKey) return;
    const candidates = [
      ...data.economicActions.flatMap((item) => [
        { action: item.primaryAction, item },
        ...item.secondaryActions.map((action) => ({ action, item })),
      ]),
      ...data.sourceDiagnostics.flatMap((diagnostic) =>
        [diagnostic.primaryAction, ...diagnostic.secondaryActions].map((action) => ({
          action,
          item: undefined,
        })),
      ),
      ...generatedDetails.map((action) => ({
        action,
        item: findContext(data, subjectId),
      })),
    ];
    const match = candidates.find(({ action }) =>
      action.id === actionId &&
      action.presentation.kind === "workbench" &&
      action.presentation.target.subjectId === subjectId,
    );
    if (match) {
      setActive(match);
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.delete("action");
    next.delete("subject");
    router.replace(`/discover?${next.toString()}`, { scroll: false });
  }, [activeKey, data, generatedDetails, params, router]);
  return <div data-discover-marketplace className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8"><Header filters={filters} view={data.view} /><div className="mt-3"><ViewTabs active={data.view} filters={filters} /></div><div className="mt-4 space-y-4"><SourceFailure data={data} /><div className="pt-1">{data.projection.kind === "for_you" ? <ForYouView data={data} filters={filters} onOpen={openWorkbench} /> : data.projection.kind === "explore" ? <ExploreView data={data} filters={filters} onOpen={openWorkbench} /> : data.projection.kind === "activity" ? <ActivityView data={data} onOpen={openWorkbench} /> : <OutcomesView data={data} onOpen={openWorkbench} />}</div><SourceDiagnostics data={data} onOpen={openWorkbench} /></div><DiscoverActionWorkbench action={active?.action ?? null} item={active?.item} data={data} onClose={closeWorkbench} /></div>;
}

export function DiscoverMarketplace(props: { data: DiscoverPageData; filters: OpportunityFilters }) {
  return <DiscoverMarketplaceContent {...props} />;
}
