"use client";

import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Filter,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type {
  DiscoverCommunity,
  DiscoverPageData,
  DiscoverPerson,
  DiscoverPool,
  DiscoverView,
  MarketplaceOpportunity,
  OpportunityType,
} from "@/lib/discover/marketplace/contracts";
import type {
  OpportunityFilters,
  OpportunitySort,
} from "@/lib/discover/marketplace/filters";

const views: Array<{ id: DiscoverView; label: string; icon: typeof BriefcaseBusiness }> = [
  { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { id: "people", label: "People & Agents", icon: Users },
  { id: "communities", label: "Communities", icon: Building2 },
  { id: "pools", label: "Funding Pools", icon: CircleDollarSign },
  { id: "saved", label: "Saved", icon: Sparkles },
];

const typeLabels: Record<OpportunityType, string> = {
  task: "Task",
  bounty: "Bounty",
  grant: "Grant",
  campaign: "Campaign",
  role: "Role",
  project_contribution: "Project contribution",
  repository_fix: "Repository fix",
  research_request: "Research request",
  community_proposal: "Community proposal",
  creator_collaboration: "Creator collaboration",
  agent_service_request: "Agent service request",
};

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)} ${token === "USDC" ? "USDC" : token}`;
}

function relativeDate(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function deadlineLabel(value?: string) {
  if (!value) return null;
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function track(event: string, properties?: Record<string, string | number | boolean>) {
  const payload = JSON.stringify({ event, properties, path: window.location.pathname });
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
  const stats = [
    data.stats.openOpportunities
      ? { label: "Open opportunities", value: data.stats.openOpportunities.toLocaleString() }
      : null,
    data.stats.activeFundingUsd
      ? { label: "Active funding", value: money(data.stats.activeFundingUsd) }
      : null,
    data.stats.activeCommunities
      ? { label: "Active communities", value: data.stats.activeCommunities.toLocaleString() }
      : null,
    data.stats.verifiedContributors
      ? {
          label: "Verified people & agents",
          value: data.stats.verifiedContributors.toLocaleString(),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <header className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#081222]/90 px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:px-8 sm:py-9">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
            Resolve network
          </p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.035em] text-white sm:mt-3 sm:text-4xl lg:text-[46px] lg:leading-[1.08]">
            Discover work, people and communities worth backing
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-4 sm:text-base">
            Find funded opportunities, verified contributors, active communities and transparent funding pools.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-2.5">
            <Link
              href="/discover?view=opportunities"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Browse opportunities <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/mission?intent=create-opportunity"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Create opportunity
            </Link>
            <Link
              href="/communities"
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Create community
            </Link>
          </div>
        </div>
        {stats.length > 0 && (
          <dl
            className={`grid min-w-0 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] xl:w-[430px] ${
              stats.length > 1 ? "sm:grid-cols-2" : ""
            }`}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#091525] px-4 py-4">
                <dt className="text-[11px] text-slate-500">{stat.label}</dt>
                <dd className="mt-1 text-base font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

function ViewTabs({ active }: { active: DiscoverView }) {
  return (
    <nav
      aria-label="Discover sections"
      role="tablist"
      className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#07111f]/90 p-1.5"
    >
      {views.map((view) => {
        const Icon = view.icon;
        return (
          <Link
            key={view.id}
            href={`/discover?view=${view.id}`}
            role="tab"
            aria-selected={active === view.id}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              active === view.id
                ? "bg-[#17253a] font-semibold text-white shadow-sm"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SearchAndFilters({
  filters,
  total,
}: {
  filters: OpportunityFilters;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(filters.q ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const update = (changes: Record<string, string | undefined>, replace = true) => {
    const next = new URLSearchParams(params.toString());
    next.set("view", "opportunities");
    next.delete("cursor");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const href = `${pathname}?${next.toString()}`;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    startTransition(() => router.refresh());
  };

  useEffect(() => {
    if (query === (filters.q ?? "")) return;
    const timer = setTimeout(() => {
      update({ q: query || undefined }, false);
      if (query) track("discover_search_used", { queryLength: query.length });
    }, 320);
    return () => clearTimeout(timer);
    // The current filters value is the server-confirmed query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.q]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const filterCount = [
    filters.type,
    filters.fundingStatus,
    filters.provider,
    filters.remote,
    filters.deadline,
  ].filter(Boolean).length;
  const activeFilters = [
    filters.type ? { key: "type", label: typeLabels[filters.type] } : null,
    filters.fundingStatus
      ? {
          key: "funding",
          label: filters.fundingStatus.replaceAll("_", " "),
        }
      : null,
    filters.provider
      ? { key: "provider", label: filters.provider.replaceAll("_", " ") }
      : null,
    filters.remote ? { key: "remote", label: "Remote" } : null,
    filters.deadline
      ? {
          key: "deadline",
          label: filters.deadline === "week" ? "Closing this week" : "Closing this month",
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const withoutFilter = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    next.delete("cursor");
    return `${pathname}?${next.toString()}`;
  };

  const controls = (
    <>
      <label className="block text-xs font-medium text-slate-400">
        Opportunity type
        <select
          name="type"
          defaultValue={filters.type ?? ""}
          onChange={(event) => {
            update({ type: event.target.value || undefined }, false);
            if (event.target.value) track("discover_filter_applied", { filter: "type" });
          }}
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm text-white focus:border-violet-400 focus:outline-none"
        >
          <option value="">All types</option>
          {(Object.keys(typeLabels) as OpportunityType[]).map((type) => (
            <option key={type} value={type}>
              {typeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-400">
        Funding
        <select
          name="funding"
          defaultValue={filters.fundingStatus ?? ""}
          onChange={(event) => update({ funding: event.target.value || undefined }, false)}
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm text-white focus:border-violet-400 focus:outline-none"
        >
          <option value="">Any status</option>
          <option value="unfunded">Unfunded</option>
          <option value="partially_funded">Partially funded</option>
          <option value="funded">Funded</option>
          <option value="escrowed">Escrowed</option>
          <option value="milestone_funded">Milestone funded</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-400">
        Provider
        <select
          name="provider"
          defaultValue={filters.provider ?? ""}
          onChange={(event) => update({ provider: event.target.value || undefined }, false)}
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm text-white focus:border-violet-400 focus:outline-none"
        >
          <option value="">Any preference</option>
          <option value="open">Open to applications</option>
          <option value="preferred">Preferred provider</option>
          <option value="selected">Provider selected</option>
          <option value="invite_only">Invite only</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="remote"
          value="true"
          defaultChecked={filters.remote === true}
          onChange={(event) => update({ remote: event.target.checked ? "true" : undefined }, false)}
          className="h-4 w-4 accent-violet-500"
        />
        Remote
      </label>
      <label className="block text-xs font-medium text-slate-400">
        Deadline
        <select
          name="deadline"
          defaultValue={filters.deadline ?? ""}
          onChange={(event) => update({ deadline: event.target.value || undefined }, false)}
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101d] px-3 text-sm text-white focus:border-violet-400 focus:outline-none"
        >
          <option value="">Any deadline</option>
          <option value="week">Closing this week</option>
          <option value="month">Closing this month</option>
        </select>
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 text-sm font-semibold text-violet-200 hover:bg-violet-500/20"
      >
        Apply filters
      </button>
      {filterCount > 0 && (
        <Link
          href={`/discover?view=opportunities${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}
          className="min-h-11 text-sm font-medium text-violet-300 hover:text-violet-200"
        >
          Clear all filters
        </Link>
      )}
    </>
  );

  return (
    <section aria-label="Search and filter opportunities" className="mt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          action="/discover"
          method="get"
          className="relative flex-1"
          onSubmit={() => {
            if (query) track("discover_search_used", { queryLength: query.length });
          }}
        >
          <input type="hidden" name="view" value="opportunities" />
          {filters.type && <input type="hidden" name="type" value={filters.type} />}
          {filters.fundingStatus && (
            <input type="hidden" name="funding" value={filters.fundingStatus} />
          )}
          {filters.provider && <input type="hidden" name="provider" value={filters.provider} />}
          {filters.remote && <input type="hidden" name="remote" value="true" />}
          {filters.deadline && <input type="hidden" name="deadline" value={filters.deadline} />}
          {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
          <label>
            <span className="sr-only">Search opportunities</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search work, skills, communities, creators or repositories"
              className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#07111f] pl-11 pr-24 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/10"
            />
          </label>
          <button
            type="submit"
            className="absolute right-2 top-1/2 min-h-9 -translate-y-1/2 rounded-xl px-3 text-xs font-semibold text-violet-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {pending ? (
              <LoaderCircle aria-label="Updating results" className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </form>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hydrated}
            aria-busy={!hydrated}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-[#07111f] px-4 text-sm text-slate-200 disabled:cursor-wait disabled:text-slate-500 lg:hidden"
          >
            {hydrated ? <Filter className="h-4 w-4" /> : <LoaderCircle className="h-4 w-4 animate-spin" />}
            {hydrated ? `Filters${filterCount > 0 ? ` (${filterCount})` : ""}` : "Loading filters"}
          </button>
          <label className="flex min-h-12 flex-1 items-center rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm text-slate-400 lg:flex-none">
            <span className="sr-only">Sort opportunities</span>
            <select
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value }, false)}
              className="w-full bg-transparent text-sm text-slate-200 outline-none"
            >
              <option value="newest">Newest</option>
              <option value="closing_soon">Closing soon</option>
              <option value="most_funded">Most funded</option>
              <option value="most_active">Most active</option>
            </select>
            <ChevronDown className="ml-2 h-4 w-4" />
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <p aria-live="polite">{total === 1 ? "1 opportunity" : `${total} opportunities`}</p>
        <p>Public browsing, no wallet or GitHub connection required</p>
      </div>
      {activeFilters.length > 0 && (
        <div aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Link
              key={filter.key}
              href={withoutFilter(filter.key)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 text-xs capitalize text-violet-200 hover:bg-violet-400/15"
              aria-label={`Remove ${filter.label} filter`}
            >
              {filter.label}
              <X className="h-3 w-3" />
            </Link>
          ))}
          <Link
            href={`/discover?view=opportunities${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}
            className="inline-flex min-h-8 items-center px-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            Clear all
          </Link>
        </div>
      )}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-title"
          className="fixed inset-0 z-[80] flex items-end bg-black/65 lg:hidden"
        >
          <form
            action="/discover"
            method="get"
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#07111f] p-5"
          >
            <input type="hidden" name="view" value="opportunities" />
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
            <div className="flex items-center justify-between">
              <h2 id="filter-title" className="text-lg font-semibold text-white">
                Filter opportunities
              </h2>
              <button
                ref={closeButton}
                type="button"
                aria-label="Close filters"
                onClick={() => setDrawerOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-4">{controls}</div>
            <button
              type="submit"
              onClick={() => setDrawerOpen(false)}
              className="mt-6 min-h-12 w-full rounded-xl bg-violet-500 text-sm font-semibold text-white"
            >
              Show {total} results
            </button>
          </form>
        </div>
      )}
      <form
        action="/discover"
        method="get"
        className="mt-5 hidden grid-cols-5 gap-3 lg:grid"
      >
        <input type="hidden" name="view" value="opportunities" />
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
        {controls}
      </form>
    </section>
  );
}

function ProviderStatus({ opportunity }: { opportunity: MarketplaceOpportunity }) {
  if (opportunity.provider.selected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Assigned to {opportunity.provider.selected.name}
      </span>
    );
  }
  if (opportunity.provider.preferred) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-violet-300">
        <Sparkles className="h-3.5 w-3.5" />
        Preferred: {opportunity.provider.preferred.name}
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-400">
      {opportunity.provider.preference === "invite_only"
        ? "Invite only"
        : "Open to applications"}
    </span>
  );
}

function OpportunityCard({
  opportunity,
  saved,
  signedIn,
  onSave,
}: {
  opportunity: MarketplaceOpportunity;
  saved: boolean;
  signedIn: boolean;
  onSave: (opportunity: MarketplaceOpportunity) => void;
}) {
  const reward = money(opportunity.reward?.amountUsd, opportunity.reward?.token);
  const funded = money(opportunity.funding?.fundedAmountUsd);
  const deadline = deadlineLabel(opportunity.deadline);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#091321]/95 p-5 transition hover:-translate-y-0.5 hover:border-violet-300/25 hover:shadow-[0_20px_50px_rgba(0,0,0,.2)] motion-reduce:transform-none sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-violet-400/10 px-2.5 py-1 font-medium text-violet-200">
          {typeLabels[opportunity.type]}
        </span>
        <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-slate-400">
          {opportunity.status}
        </span>
        {opportunity.creator.verified && (
          <span className="inline-flex items-center gap-1 text-cyan-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        )}
        <span className="ml-auto text-slate-600">{relativeDate(opportunity.publishedAt)}</span>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-white">
          {opportunity.creator.type === "agent" ? (
            <Bot className="h-5 w-5 text-violet-300" />
          ) : (
            opportunity.creator.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">{opportunity.creator.name}</p>
          <p className="truncate text-xs text-slate-500">
            {opportunity.community?.name ?? opportunity.creator.type}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <h2 className="text-lg font-semibold leading-6 text-white transition group-hover:text-violet-100">
          <Link
            href={`/opportunities/${opportunity.slug}`}
            onClick={() => track("opportunity_viewed", { type: opportunity.type })}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {opportunity.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{opportunity.summary}</p>
        {(opportunity.repository || opportunity.projectId) && (
          <p className="mt-3 truncate font-mono text-[11px] text-slate-500">
            {opportunity.repository ?? opportunity.projectId}
          </p>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-white/[0.07] py-4 text-xs">
        {reward && (
          <div>
            <dt className="text-slate-600">Reward</dt>
            <dd className="mt-1 font-semibold text-white">{reward}</dd>
          </div>
        )}
        {funded && (
          <div>
            <dt className="text-slate-600">Funded</dt>
            <dd className="mt-1 font-semibold text-emerald-300">{funded}</dd>
          </div>
        )}
        {deadline && (
          <div>
            <dt className="text-slate-600">Deadline</dt>
            <dd className="mt-1 inline-flex items-center gap-1 text-slate-300">
              <CalendarClock className="h-3.5 w-3.5" /> {deadline}
            </dd>
          </div>
        )}
        {opportunity.applicationCount != null && (
          <div>
            <dt className="text-slate-600">Applications</dt>
            <dd className="mt-1 text-slate-300">{opportunity.applicationCount}</dd>
          </div>
        )}
      </dl>
      {opportunity.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {opportunity.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded-lg bg-white/[0.045] px-2 py-1 text-[11px] text-slate-400">
              {skill}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4">
        <ProviderStatus opportunity={opportunity} />
      </div>
      <div className="mt-auto flex items-center gap-2 pt-5">
        <Link
          href={`/opportunities/${opportunity.slug}`}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          View details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => onSave(opportunity)}
          className="min-h-10 rounded-xl border border-white/10 px-3 text-sm text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          {saved ? "Saved" : signedIn ? "Save" : "Save"}
        </button>
      </div>
    </article>
  );
}

function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  );
}

function OpportunityGrid({
  data,
}: {
  data: DiscoverPageData;
}) {
  const { openSignIn } = useSignInModal();
  const [savedIds, setSavedIds] = useState(() => new Set(data.savedIds));
  const [saving, setSaving] = useState<string | null>(null);
  const params = useSearchParams();

  const onSave = async (opportunity: MarketplaceOpportunity) => {
    if (!data.signedIn) {
      openSignIn();
      return;
    }
    if (saving) return;
    const alreadySaved = savedIds.has(opportunity.id);
    setSaving(opportunity.id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (alreadySaved) next.delete(opportunity.id);
      else next.add(opportunity.id);
      return next;
    });
    try {
      const response = await fetch("/api/discover/saved", {
        method: alreadySaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "opportunity", targetId: opportunity.id }),
      });
      if (!response.ok) throw new Error("Save request failed");
      if (!alreadySaved) track("opportunity_saved", { type: opportunity.type });
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (alreadySaved) next.add(opportunity.id);
        else next.delete(opportunity.id);
        return next;
      });
      toast.error("Could not update saved items. Your current page state is unchanged.");
    } finally {
      setSaving(null);
    }
  };

  const visible =
    data.view === "saved"
      ? data.opportunities.items.filter((item) => savedIds.has(item.id))
      : data.opportunities.items;

  if (data.view === "saved" && !data.signedIn) {
    return (
      <EmptyState
        title="Sign in to see saved items"
        body="Public browsing remains open. Sign in only when you want to save something for later."
      >
        <button
          type="button"
          onClick={openSignIn}
          className="min-h-10 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white"
        >
          Sign in
        </button>
        <Link href="/discover?view=opportunities" className="min-h-10 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">
          Browse opportunities
        </Link>
      </EmptyState>
    );
  }

  if (!visible.length) {
    return (
      <EmptyState
        title={data.view === "saved" ? "No saved items yet" : "No opportunities match these filters"}
        body={
          data.view === "saved"
            ? "Save opportunities, people, communities or pools to revisit them here."
            : "Try a broader search or clear the active filters."
        }
      >
        <Link
          href="/discover?view=opportunities"
          className="min-h-10 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {data.view === "saved" ? "Browse opportunities" : "Clear filters"}
        </Link>
        <Link
          href="/mission?intent=create-opportunity"
          className="min-h-10 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300"
        >
          Create an opportunity
        </Link>
      </EmptyState>
    );
  }

  const next = data.opportunities.nextCursor
    ? new URLSearchParams(params.toString())
    : null;
  if (next && data.opportunities.nextCursor) next.set("cursor", data.opportunities.nextCursor);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            saved={savedIds.has(opportunity.id)}
            signedIn={data.signedIn}
            onSave={onSave}
          />
        ))}
      </div>
      {next && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/discover?${next.toString()}`}
            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/[0.07]"
          >
            Load more
          </Link>
        </div>
      )}
    </>
  );
}

function PersonCard({ person }: { person: DiscoverPerson }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#091321] p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-violet-400/10 text-violet-200">
          {person.kind === "agent" ? <Bot className="h-6 w-6" /> : person.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">{person.name}</p>
          <p className="mt-1 text-xs capitalize text-slate-500">{person.kind}</p>
        </div>
        {person.verifiedIdentities.length > 0 && <ShieldCheck className="ml-auto h-5 w-5 text-cyan-300" />}
      </div>
      {person.description && <p className="mt-4 text-sm leading-6 text-slate-400">{person.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {person.verifiedIdentities.map((identity) => (
          <span key={identity} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] text-slate-400">
            {identity}
          </span>
        ))}
      </div>
      {person.amountEarnedUsd != null && (
        <p className="mt-4 text-sm text-slate-400">
          Public verified earnings <strong className="text-white">{money(person.amountEarnedUsd)}</strong>
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Link href={`/profile?identity=${encodeURIComponent(person.id)}`} onClick={() => track("provider_viewed", { kind: person.kind })} className="min-h-10 flex-1 rounded-xl bg-violet-500 px-3 py-2.5 text-center text-sm font-semibold text-white">
          View profile
        </Link>
        {person.acceptsInvitations && (
          <Link href={`/mission?invite=${encodeURIComponent(person.id)}`} className="min-h-10 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300">
            Invite
          </Link>
        )}
      </div>
    </article>
  );
}

function CommunityCard({ community }: { community: DiscoverCommunity }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#091321] p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-white">{community.name}</h2>
          <p className="mt-0.5 text-xs capitalize text-slate-500">{community.type}</p>
        </div>
        {community.verified && <ShieldCheck className="ml-auto h-4 w-4 text-cyan-300" />}
      </div>
      <p className="mt-4 min-h-12 text-sm leading-6 text-slate-400">{community.purpose}</p>
      <dl className="mt-4 flex flex-wrap gap-5 border-y border-white/[0.07] py-4 text-xs">
        {community.activeOpportunities != null && (
          <div><dt className="text-slate-600">Opportunities</dt><dd className="mt-1 text-white">{community.activeOpportunities}</dd></div>
        )}
        {community.activePools != null && (
          <div><dt className="text-slate-600">Pools</dt><dd className="mt-1 text-white">{community.activePools}</dd></div>
        )}
        {community.publicFundingUsd != null && (
          <div><dt className="text-slate-600">Public funding</dt><dd className="mt-1 text-emerald-300">{money(community.publicFundingUsd)}</dd></div>
        )}
      </dl>
      <div className="mt-5 flex gap-2">
        <Link href={`/communities/${community.slug}`} onClick={() => track("community_viewed")} className="min-h-10 flex-1 rounded-xl bg-violet-500 px-3 py-2.5 text-center text-sm font-semibold text-white">
          View community
        </Link>
        <Link href={`/discover?view=opportunities&community=${community.slug}`} className="min-h-10 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300">
          View work
        </Link>
      </div>
    </article>
  );
}

function PoolCard({ pool }: { pool: DiscoverPool }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#091321] p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <CircleDollarSign className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-white">{pool.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{pool.owner}</p>
        </div>
      </div>
      {pool.purpose && <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-400">{pool.purpose}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-white/[0.07] py-4 text-xs">
        {pool.balanceUsd != null && <div><dt className="text-slate-600">Current balance</dt><dd className="mt-1 font-semibold text-white">{money(pool.balanceUsd, pool.token)}</dd></div>}
        {pool.committedUsd != null && <div><dt className="text-slate-600">Committed</dt><dd className="mt-1 font-semibold text-emerald-300">{money(pool.committedUsd, pool.token)}</dd></div>}
        {pool.applicationModel && <div><dt className="text-slate-600">Applications</dt><dd className="mt-1 text-slate-300">{pool.applicationModel}</dd></div>}
        {pool.verificationMechanism && <div><dt className="text-slate-600">Verification</dt><dd className="mt-1 line-clamp-2 text-slate-300">{pool.verificationMechanism}</dd></div>}
      </dl>
      <div className="mt-5 flex gap-2">
        <Link href={`/capital?pool=${encodeURIComponent(pool.id)}`} onClick={() => track("pool_viewed")} className="min-h-10 flex-1 rounded-xl bg-violet-500 px-3 py-2.5 text-center text-sm font-semibold text-white">
          View pool
        </Link>
        <Link href={`/discover?view=opportunities&community=${encodeURIComponent(pool.communitySlug)}`} className="min-h-10 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300">
          Funded work
        </Link>
      </div>
    </article>
  );
}

function FailureNotice({ data }: { data: DiscoverPageData }) {
  if (!data.opportunities.failures.length) return null;
  const failure = data.opportunities.failures[0];
  return (
    <aside className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p>One opportunity source could not refresh. Available sources are still shown.</p>
        <p className="mt-1 font-mono text-[10px] text-amber-200/60">
          {failure.source} · request {failure.requestId}
        </p>
      </div>
      <button type="button" onClick={() => window.location.reload()} className="min-h-9 rounded-lg border border-amber-200/20 px-3 text-xs font-medium">
        Retry source
      </button>
    </aside>
  );
}

export function DiscoverMarketplace({
  data,
  filters,
}: {
  data: DiscoverPageData;
  filters: OpportunityFilters;
}) {
  useEffect(() => {
    track("discover_viewed", { view: data.view });
  }, [data.view]);

  let content: React.ReactNode;
  if (data.view === "people") {
    content = data.people.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.people.map((person) => <PersonCard key={person.id} person={person} />)}
        </div>
      ) : (
        <EmptyState title="No verified public profiles yet" body="People and agents appear here only after their identity is verified and public." />
      );
  } else if (data.view === "communities") {
    content = data.communities.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.communities.map((community) => <CommunityCard key={community.id} community={community} />)}
        </div>
      ) : (
        <EmptyState title="No communities are published" body="Communities will appear here once they are published." />
      );
  } else if (data.view === "pools") {
    content = data.pools.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.pools.map((pool) => <PoolCard key={pool.id} pool={pool} />)}
        </div>
      ) : (
        <EmptyState title="No public funding pools yet" body="Funding pools appear here when their purpose and public balance can be verified." />
      );
  } else {
    content = <OpportunityGrid data={data} />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Header data={data} />
      <ViewTabs active={data.view} />
      {(data.view === "opportunities" || data.view === "saved") && (
        <SearchAndFilters filters={filters} total={data.opportunities.total} />
      )}
      <section className="mt-6" aria-live="polite">
        <FailureNotice data={data} />
        {content}
      </section>
    </main>
  );
}
