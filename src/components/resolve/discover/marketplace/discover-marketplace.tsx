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
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type {
  DiscoverExploreKind,
  DiscoverPageData,
  DiscoverSourceDiagnostic,
  DiscoverView,
  EconomicActionItem,
} from "@/lib/discover/marketplace/contracts";
import type { OpportunityFilters } from "@/lib/discover/marketplace/filters";

const views: Array<{ id: DiscoverView; label: string; icon: typeof Activity }> = [
  { id: "for_you", label: "For You", icon: Sparkles },
  { id: "explore", label: "Explore", icon: Search },
  { id: "activity", label: "My Activity", icon: Activity },
  { id: "outcomes", label: "Outcomes", icon: History },
];

const exploreKinds: Array<{ id: DiscoverExploreKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "people", label: "People" },
  { id: "work", label: "Verified work" },
  { id: "communities", label: "Communities" },
  { id: "programs", label: "Programs" },
  { id: "pools", label: "Pools" },
  { id: "funding_gaps", label: "Funding gaps" },
];

const subjectIcons: Partial<Record<EconomicActionItem["subjectType"], typeof Activity>> = {
  accepted_work: FileCheck2,
  contributor: UserRound,
  creator: UserRound,
  community: Building2,
  community_pool: CircleDollarSign,
  funding_gap: WalletCards,
  active_program: GitBranch,
  policy_blocker: GitBranch,
  payout_blocker: UserRound,
  receipt: BadgeCheck,
  settlement: BadgeCheck,
};

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)}${token === "USDC" ? " USDC" : ` ${token}`}`;
}

function discoverHref(
  view: DiscoverView,
  filters: OpportunityFilters,
  kind = filters.kind,
) {
  const params = new URLSearchParams({ view });
  if (filters.q) params.set("q", filters.q);
  if (filters.community) params.set("community", filters.community);
  if (filters.repository) params.set("repository", filters.repository);
  if (kind) params.set("kind", kind);
  return `/discover?${params.toString()}`;
}

function track(actionId: string, properties?: Record<string, string | number | boolean>) {
  const safeProperties = properties
    ? Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]))
    : undefined;
  const payload = JSON.stringify({ event: actionId, properties: safeProperties, path: window.location.pathname });
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

function Header({ data }: { data: DiscoverPageData }) {
  const all = data.economicActions;
  const facts = [
    { label: "Verified events", value: all.filter((item) => item.subjectType === "accepted_work").length },
    { label: "Needs attention", value: all.filter((item) => Boolean(item.blocker)).length },
    { label: "Payout-ready", value: all.filter((item) => item.recipientReadiness === "ready").length },
    { label: "Funding-ready", value: all.filter((item) => item.fundingReadiness === "ready").length },
    { label: "Confirmed outcomes", value: all.filter((item) => item.subjectType === "receipt").length },
  ].filter((item) => item.value > 0);
  return (
    <header className="rounded-2xl border border-white/[0.08] bg-[#081321] px-5 py-5 sm:px-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold text-violet-300">Economic Action Network</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
            Discover economic activity
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-300">
            See what happened, why it matters, and what can happen next.
          </p>
        </div>
        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:flex sm:flex-wrap sm:justify-end">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-24">
                <dt className="text-xs text-slate-500">{fact.label}</dt>
                <dd className="mt-0.5 font-semibold text-white">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}

function SearchBox({ filters, view }: { filters: OpportunityFilters; view: DiscoverView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentQueryString = params.toString();
  const [query, setQuery] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => setQuery(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (query === (filters.q ?? "")) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(currentQueryString);
      next.set("view", view);
      next.delete("cursor");
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [currentQueryString, filters.q, pathname, query, router, view]);

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(currentQueryString);
        next.set("view", view);
        if (query.trim()) next.set("q", query.trim());
        else next.delete("q");
        startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people, providers, repositories, communities, work, receipts, or transactions"
        aria-label="Search Discover"
        className="min-h-12 w-full rounded-xl border border-white/10 bg-[#07111f] pl-11 pr-12 text-[15px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
      />
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
        return (
          <Link
            key={view.id}
            href={discoverHref(view.id, filters)}
            prefetch
            aria-current={selected === view.id ? "page" : undefined}
            onClick={(event) => {
              if (selected === view.id) event.preventDefault();
              else setSelected(view.id);
            }}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${selected === view.id ? "bg-[#1a2940] font-semibold text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
          >
            <Icon className="h-4 w-4" />
            {view.label}
            {selected === view.id && selected !== active ? <LoaderCircle aria-label={`Loading ${view.label}`} className="h-3.5 w-3.5 animate-spin text-violet-300" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ContextControls({ data, filters }: { data: DiscoverPageData; filters: OpportunityFilters }) {
  const router = useRouter();
  const { openSignIn } = useSignInModal();
  return (
    <section aria-label="Discover context" className="flex flex-wrap items-center gap-2 text-xs">
      <span className="mr-1 font-medium text-slate-500">Context</span>
      <Link href="/discover?view=explore" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/[0.05]">Public network</Link>
      {data.signedIn ? (
        <Link href={discoverHref("activity", filters)} className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/[0.05]">Personal workspace</Link>
      ) : (
        <button type="button" onClick={openSignIn} className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300">Sign in for personal activity</button>
      )}
      {data.myCommunities.length > 0 ? (
        <select
          aria-label="Select operated community"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) {
              router.push(discoverHref("activity", { ...filters, q: undefined, community: event.target.value }));
            }
          }}
          className="rounded-full border border-white/10 bg-[#07111f] px-3 py-1.5 text-slate-300"
        >
          <option value="">Operated community</option>
          {data.myCommunities.map((community) => <option key={community.id} value={community.name}>{community.name}</option>)}
        </select>
      ) : null}
      {data.readiness?.repositories.length ? (
        <select
          aria-label="Select connected repository"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) {
              router.push(discoverHref("explore", { ...filters, q: undefined, repository: event.target.value }));
            }
          }}
          className="max-w-64 rounded-full border border-white/10 bg-[#07111f] px-3 py-1.5 text-slate-300"
        >
          <option value="">Connected repository</option>
          {data.readiness.repositories.map((repository) => <option key={repository} value={repository}>{repository}</option>)}
        </select>
      ) : null}
    </section>
  );
}

function SourceFailure({ data }: { data: DiscoverPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const failure = data.opportunities.failures[0];
  if (!failure) return null;
  return (
    <aside role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-amber-100">{failure.source.replaceAll("_", " ")} could not refresh. Persisted records remain visible.</p>
        <p className="mt-1 text-xs text-amber-200/60">{failure.message} Request {failure.requestId.slice(0, 8)}.</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-200/20 px-3 text-xs font-medium text-amber-100 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Retry exact source
      </button>
    </aside>
  );
}

function Recommendation({ data }: { data: DiscoverPageData }) {
  const recommendation = data.recommendation;
  return (
    <section className="rounded-xl border border-violet-300/15 bg-[linear-gradient(125deg,rgba(102,85,220,.13),rgba(7,17,31,.96)_48%)] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <p className="text-xs font-semibold text-violet-200">Recommended next action</p>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">{recommendation.state.replaceAll("_", " ")}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">{recommendation.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{recommendation.reason}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {recommendation.secondaryActions.slice(0, 2).map((action) => (
            <Link key={action.href} href={action.href} data-action-id={action.id} onClick={() => track("discover_action_opened", { actionId: action.id, recommendation: recommendation.id })} className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/[0.05]">{action.label}</Link>
          ))}
          <Link href={recommendation.primaryAction.href} data-action-id={recommendation.primaryAction.id} onClick={() => track("discover_action_opened", { actionId: recommendation.primaryAction.id, recommendation: recommendation.id })} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400">
            {recommendation.primaryAction.label}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ActionCard({ item }: { item: EconomicActionItem }) {
  const Icon = subjectIcons[item.subjectType] ?? Activity;
  const amount = money(item.amount?.valueUsd, item.amount?.token);
  return (
    <article id={item.id} className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-violet-300/20 px-2 py-1 capitalize text-violet-200">{item.subjectType.replaceAll("_", " ")}</span>
            <span className="capitalize text-slate-500">{item.lifecycle.replaceAll("_", " ")}</span>
            {item.source.stale ? <span className="text-amber-200">Stale snapshot</span> : null}
          </div>
          <h3 className="mt-3 text-base font-semibold leading-6 text-white">{item.headline}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.happened}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{item.whyItMatters}</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 border-y border-white/[0.07] py-3 text-xs sm:grid-cols-3">
        <div><dt className="text-slate-500">Source</dt><dd className="mt-1 text-slate-200">{item.source.label}</dd></div>
        <div><dt className="text-slate-500">Created by</dt><dd className="mt-1 text-slate-200">{item.person?.name ?? item.community?.name ?? "Canonical system record"}</dd></div>
        <div><dt className="text-slate-500">Economic state</dt><dd className="mt-1 capitalize text-slate-200">{amount ? `${amount} - ${item.amount?.state.replaceAll("_", " ")}` : item.fundingReadiness.replaceAll("_", " ")}</dd></div>
      </dl>
      {item.blocker ? <p className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-xs leading-5 text-amber-100">Exact blocker: {item.blocker}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.primaryAction.enabled ? (
          <Link
            href={item.primaryAction.href}
            data-action-id={item.primaryAction.id}
            onClick={() => track("discover_action_opened", { actionId: item.primaryAction.id, subject: item.subjectId })}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white hover:bg-violet-400"
          >
            {item.primaryAction.label}<ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" disabled title={item.primaryAction.disabledReason} className="min-h-10 rounded-lg bg-slate-700 px-3 text-sm text-slate-300 opacity-60">{item.primaryAction.label}</button>
        )}
        {item.secondaryActions.slice(0, 2).map((action) => (
          <Link key={`${item.id}:${action.id}:${action.href}`} href={action.href} data-action-id={action.id} onClick={() => track("discover_action_opened", { actionId: action.id, subject: item.subjectId })} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/[0.05]">
            {action.label}{action.href.startsWith("http") ? <ExternalLink className="h-3.5 w-3.5" /> : null}
          </Link>
        ))}
      </div>
    </article>
  );
}

function ActionFeed({ items, title }: { items: EconomicActionItem[]; title: string }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="economic-action-feed-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-cyan-300">Live economic state</p>
          <h2 id="economic-action-feed-title" className="mt-1 text-lg font-semibold text-white">{title}</h2>
        </div>
        <span className="text-xs text-slate-500">{items.length} real item{items.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">{items.map((item) => <ActionCard key={item.id} item={item} />)}</div>
    </section>
  );
}

function ExploreFilters({ active, filters }: { active: DiscoverExploreKind; filters: OpportunityFilters }) {
  return (
    <nav aria-label="Explore filters" className="flex gap-2 overflow-x-auto pb-1">
      {exploreKinds.map((kind) => (
        <Link
          key={kind.id}
          href={discoverHref("explore", filters, kind.id)}
          aria-current={active === kind.id ? "page" : undefined}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${active === kind.id ? "border-violet-300/30 bg-violet-400/10 font-semibold text-violet-100" : "border-white/10 text-slate-400 hover:text-white"}`}
        >
          {kind.label}
        </Link>
      ))}
    </nav>
  );
}

function SourceDiagnosticCard({ diagnostic }: { diagnostic: DiscoverSourceDiagnostic }) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-semibold text-cyan-300">{diagnostic.repository ?? "GitHub repository access"}</p><p className="mt-1 text-xs capitalize text-slate-500">{diagnostic.state.replaceAll("_", " ")}</p></div>
        {diagnostic.stale ? <span className="rounded-full border border-amber-300/20 px-2 py-1 text-[11px] text-amber-200">Last-known snapshot</span> : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-slate-500">Evaluation period</dt><dd className="mt-1 text-slate-200">{diagnostic.evaluationPeriod}</dd></div>
        <div><dt className="text-slate-500">Events inspected</dt><dd className="mt-1 text-slate-200">{diagnostic.eventsInspected ?? "Snapshot required"}</dd></div>
        <div><dt className="text-slate-500">Accepted events</dt><dd className="mt-1 text-slate-200">{diagnostic.acceptedEvents}</dd></div>
        <div><dt className="text-slate-500">Last successful sync</dt><dd className="mt-1 text-slate-200">{diagnostic.lastSuccessfulAt ? new Date(diagnostic.lastSuccessfulAt).toLocaleString() : "None recorded"}</dd></div>
      </dl>
      <p className="mt-3 text-sm leading-6 text-slate-400">{diagnostic.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={diagnostic.primaryAction.href} data-action-id={diagnostic.primaryAction.id} onClick={() => track("discover_action_opened", { actionId: diagnostic.primaryAction.id, source: diagnostic.id })} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-violet-500 px-3 text-xs font-semibold text-white">{diagnostic.primaryAction.label}<ArrowRight className="h-3.5 w-3.5" /></Link>
        {diagnostic.secondaryActions.map((action) => <Link key={action.id} href={action.href} data-action-id={action.id} onClick={() => track("discover_action_opened", { actionId: action.id, source: diagnostic.id })} className="inline-flex min-h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-slate-300">{action.label}</Link>)}
      </div>
    </article>
  );
}

type RepositoryAnalysis = {
  ingest: { fullName: string; prCount: number; contributorCount: number; ingestedAt: string };
  pullRequests: Array<{ number: number; title: string; author: string; mergedAt: string | null }>;
};

function RepositoryAnalyzer({ signedIn }: { signedIn: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const [repository, setRepository] = useState(params.get("repository") ?? "");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"analyze" | "persist" | null>(null);
  const visible = params.get("analyze") === "1" || Boolean(repository);

  async function analyze() {
    const match = repository.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!match) {
      setError("Enter a public GitHub repository as owner/repository.");
      return;
    }
    setPending("analyze");
    setError(null);
    track("discover_action_opened", { actionId: "discover.open_public_repository_analysis", repository: repository.trim() });
    try {
      const response = await fetch("/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: match[1], repo: match[2] }),
      });
      const body = await response.json() as RepositoryAnalysis & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "GitHub analysis failed");
      setAnalysis(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GitHub analysis failed");
    } finally {
      setPending(null);
    }
  }

  async function persist() {
    setPending("persist");
    setError(null);
    track("discover_action_opened", { actionId: "discover.capture_repository_snapshot", repository: analysis?.ingest.fullName ?? repository.trim() });
    try {
      const response = await fetch("/api/discover/oss-snapshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository: analysis?.ingest.fullName ?? repository.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Evidence snapshot could not be saved");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence snapshot could not be saved");
    } finally {
      setPending(null);
    }
  }

  return (
    <section id="repository-analysis" className="rounded-xl border border-white/[0.08] bg-[#081321] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-cyan-300">Optional GitHub analysis</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Analyze an open-source project</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Inspect real merged activity without creating a community. Sign in only when you want to persist evidence or start an operating workflow.</p>
        </div>
        {!visible ? <Link href="/discover?view=explore&analyze=1#repository-analysis" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200">Open analyzer<GitBranch className="h-4 w-4" /></Link> : null}
      </div>
      {visible ? (
        <div className="mt-4">
          <form onSubmit={(event) => { event.preventDefault(); void analyze(); }} className="flex flex-col gap-2 sm:flex-row">
            <input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" aria-label="Public GitHub repository" className="min-h-11 flex-1 rounded-lg border border-white/10 bg-[#050d17] px-3 text-sm text-white outline-none focus:border-violet-300/50" />
            <button type="submit" disabled={Boolean(pending)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white disabled:opacity-60">{pending === "analyze" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Analyze real activity</button>
          </form>
          {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
          {analysis ? (
            <div className="mt-4 rounded-xl border border-white/[0.08] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold text-white">{analysis.ingest.fullName}</h3><p className="mt-1 text-xs text-slate-500">Fetched from GitHub {new Date(analysis.ingest.ingestedAt).toLocaleString()}</p></div>
                <div className="flex gap-4 text-xs"><span className="text-slate-400"><strong className="text-white">{analysis.ingest.prCount}</strong> pull requests</span><span className="text-slate-400"><strong className="text-white">{analysis.ingest.contributorCount}</strong> contributors</span></div>
              </div>
              <div className="mt-4 space-y-2">
                {analysis.pullRequests.filter((item) => item.mergedAt).slice(0, 5).map((item) => (
                  <div key={item.number} className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm"><p className="text-slate-200">#{item.number} {item.title}</p><p className="mt-1 text-xs text-slate-500">Merged by @{item.author}</p></div>
                ))}
                {analysis.pullRequests.every((item) => !item.mergedAt) ? <p className="text-sm text-slate-400">GitHub returned no merged pull request in the inspected result window. Try another repository or save a later snapshot.</p> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {signedIn ? <button type="button" disabled={Boolean(pending)} onClick={() => void persist()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white disabled:opacity-60">{pending === "persist" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Persist evidence snapshot</button> : <span className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm text-slate-400">Sign in to persist evidence</span>}
                <a href={`https://github.com/${analysis.ingest.fullName}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300">Open repository<ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ view, signedIn }: { view: DiscoverView; signedIn: boolean }) {
  const { openSignIn } = useSignInModal();
  if (view === "outcomes") {
    return <section className="rounded-xl border border-white/[0.08] bg-[#091522] p-5"><h2 className="font-semibold text-white">No confirmed outcome receipt yet</h2><p className="mt-2 text-sm leading-6 text-slate-400">Outcomes appear only after a chain transaction confirms and RESOLVE issues a persisted receipt. Submitted funding, configured targets, and legacy ledgers do not count.</p></section>;
  }
  if (view === "activity" && !signedIn) {
    return <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#091522] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Sign in to open your economic activity</h2><p className="mt-1 text-sm text-slate-400">Public Explore remains available. Personal work, claims, funding, and operator responsibilities require the shared account session.</p></div><button type="button" onClick={openSignIn} className="min-h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white">Sign in</button></section>;
  }
  return <section className="rounded-xl border border-white/[0.08] bg-[#091522] p-5"><h2 className="font-semibold text-white">No matching economic action</h2><p className="mt-2 text-sm leading-6 text-slate-400">The selected scope has no canonical item matching this search. Analyze a public repository, choose another context, or review the exact source diagnostics below.</p></section>;
}

export function DiscoverMarketplace({ data, filters }: { data: DiscoverPageData; filters: OpportunityFilters }) {
  useEffect(() => track("discover_viewed", { view: data.view }), [data.view]);
  const feed = data.view === "for_you" && data.economicActions[0]?.id === data.recommendation.id
    ? data.economicActions.slice(1)
    : data.economicActions;
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <Header data={data} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBox filters={filters} view={data.view} />
        <ViewTabs active={data.view} filters={filters} />
      </div>
      <div className="mt-3"><ContextControls data={data} filters={filters} /></div>
      <div className="mt-5 space-y-5">
        <SourceFailure data={data} />
        {data.view === "for_you" ? <Recommendation data={data} /> : null}
        {data.view === "explore" ? <ExploreFilters active={filters.kind ?? "all"} filters={filters} /> : null}
        {feed.length ? <ActionFeed items={feed} title={data.view === "for_you" ? "What can happen next" : data.view === "activity" ? "Your work, setup, funding, and decisions" : data.view === "outcomes" ? "Confirmed settlements and receipts" : "Explore the value network"} /> : <EmptyState view={data.view} signedIn={data.signedIn} />}
        {data.view === "explore" ? <RepositoryAnalyzer signedIn={data.signedIn} /> : null}
        {(data.view === "explore" || data.view === "activity") && data.sourceDiagnostics.length ? (
          <section aria-labelledby="source-diagnostics-title">
            <div className="mb-3"><p className="text-xs font-semibold text-cyan-300">Evidence freshness</p><h2 id="source-diagnostics-title" className="mt-1 text-lg font-semibold text-white">Source evaluation details</h2></div>
            <div className="grid gap-3 lg:grid-cols-2">{data.sourceDiagnostics.map((diagnostic) => <SourceDiagnosticCard key={diagnostic.id} diagnostic={diagnostic} />)}</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
