"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  History,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  DiscoverCommunity,
  DiscoverPageData,
  DiscoverPerson,
  DiscoverPool,
  DiscoverView,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import type {
  OpportunityFilters,
  OpportunitySort,
} from "@/lib/discover/marketplace/filters";

const views: Array<{
  id: DiscoverView;
  label: string;
  icon: typeof BriefcaseBusiness;
}> = [
  { id: "for_you", label: "For You", icon: Sparkles },
  { id: "people", label: "People", icon: Users },
  { id: "work", label: "Verified Work", icon: FileCheck2 },
  { id: "pools", label: "Pools", icon: CircleDollarSign },
  { id: "programs", label: "Programs", icon: BriefcaseBusiness },
  { id: "outcomes", label: "Outcomes", icon: History },
  { id: "my_communities", label: "My Communities", icon: Building2 },
];

const pathActions = [
  {
    id: "discover.open_people",
    title: "Fund a person",
    copy: "Support a verified creator or contributor directly.",
    href: "/discover?view=people",
    icon: UserRound,
  },
  {
    id: "discover.open_funding_pools",
    title: "Back a Pool",
    copy: "Add capital to a community program whose rules determine distribution.",
    href: "/discover?view=pools",
    icon: CircleDollarSign,
  },
  {
    id: "discover.open_verified_work",
    title: "Fund verified work",
    copy: "Support completed or proposed work with inspectable evidence.",
    href: "/discover?view=work",
    icon: FileCheck2,
  },
] as const;

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)}${token === "USDC" ? " USDC" : ` ${token}`}`;
}

function shortAddress(value: string | null) {
  if (!value) return null;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function track(actionId: string, properties?: Record<string, string | number | boolean>) {
  const payload = JSON.stringify({
    event: actionId,
    properties,
    path: window.location.pathname,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/discover/events",
      new Blob([payload], { type: "application/json" }),
    );
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
  const facts = [
    data.stats.openOpportunities
      ? `${data.stats.openOpportunities} public opportunities`
      : null,
    data.stats.activeFundingUsd
      ? `${money(data.stats.activeFundingUsd)} confirmed funding`
      : null,
    data.stats.activeCommunities
      ? `${data.stats.activeCommunities} active communities`
      : null,
  ].filter(Boolean) as string[];
  return (
    <header className="rounded-2xl border border-white/[0.08] bg-[#081321] px-5 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold text-violet-300">Discover</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
            Discover verified value
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-300 sm:text-base">
            Support a person directly, back a community Pool, or fund work with proof.
          </p>
        </div>
        {facts.length > 0 && (
          <ul className="flex max-w-xl flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
            {facts.map((fact) => (
              <li key={fact} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />
                {fact}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

function SearchBox({
  filters,
  view,
}: {
  filters: OpportunityFilters;
  view: DiscoverView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentQueryString = params.toString();
  const [query, setQuery] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(filters.q ?? "");
  }, [filters.q]);

  useEffect(() => {
    if (query === (filters.q ?? "")) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(currentQueryString);
      next.set("view", view);
      next.delete("cursor");
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
      if (query.trim()) track("discover.search", { queryLength: query.trim().length });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [currentQueryString, filters.q, pathname, query, router, view]);

  function submitSearch() {
    const next = new URLSearchParams(currentQueryString);
    next.set("view", view);
    next.delete("cursor");
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <form
      className="relative"
      role="search"
      action={pathname}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        submitSearch();
      }}
    >
      <input type="hidden" name="view" value={view} />
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a creator, contributor, community, Pool, program, or verified work"
        aria-label="Search Discover"
        className="min-h-12 w-full rounded-xl border border-white/10 bg-[#07111f] pl-11 pr-12 text-[15px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
      />
      {pending && (
        <LoaderCircle
          aria-label="Updating results"
          className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-300"
        />
      )}
    </form>
  );
}

function ViewTabs({ active, query }: { active: DiscoverView; query?: string }) {
  const [selected, setSelected] = useState(active);

  useEffect(() => {
    setSelected(active);
  }, [active]);

  useEffect(() => {
    if (selected === active) return;
    const recovery = window.setTimeout(() => setSelected(active), 10_000);
    return () => window.clearTimeout(recovery);
  }, [active, selected]);

  return (
    <nav
      aria-label="Discover sections"
      className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#07111f] p-1"
    >
      {views.map((view) => {
        const Icon = view.icon;
        const suffix = query ? `&q=${encodeURIComponent(query)}` : "";
        return (
          <Link
            key={view.id}
            href={`/discover?view=${view.id}${suffix}`}
            prefetch
            aria-current={selected === view.id ? "page" : undefined}
            aria-disabled={selected === view.id && selected !== active}
            onClick={(event) => {
              if (selected === view.id && selected !== active) {
                event.preventDefault();
                return;
              }
              setSelected(view.id);
            }}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              selected === view.id
                ? "bg-[#1a2940] font-semibold text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {view.label}
            {selected === view.id && selected !== active && (
              <LoaderCircle
                aria-label={`Loading ${view.label}`}
                className="h-3.5 w-3.5 animate-spin text-violet-300"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function FundingPaths() {
  return (
    <section aria-labelledby="funding-paths-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-cyan-300">Choose a funding path</p>
          <h2 id="funding-paths-title" className="mt-1 text-lg font-semibold text-white">
            What do you want to support?
          </h2>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {pathActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              data-action-id={action.id}
              onClick={() => track(action.id)}
              className="group rounded-xl border border-white/[0.08] bg-[#091522] p-4 transition hover:border-violet-300/30 hover:bg-[#0b1929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-white">{action.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{action.copy}</p>
                </div>
                <ArrowRight className="ml-auto mt-1 h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Recommendation({ data }: { data: DiscoverPageData }) {
  const recommendation = data.recommendation;
  return (
    <section className="rounded-xl border border-violet-300/15 bg-[linear-gradient(125deg,rgba(102,85,220,.13),rgba(7,17,31,.96)_48%)] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <p className="text-xs font-semibold text-violet-200">Recommended Now</p>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
              {recommendation.state.replaceAll("_", " ")}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">{recommendation.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{recommendation.reason}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {recommendation.secondaryActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/[0.05]"
            >
              {action.label}
            </Link>
          ))}
          <Link
            href={recommendation.primaryAction.href}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400"
          >
            {recommendation.primaryAction.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SourceFailure({
  data,
}: {
  data: DiscoverPageData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const failure = data.opportunities.failures[0];
  if (!failure) return null;
  return (
    <aside
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm text-amber-100">
          {failure.source.replaceAll("_", " ")} could not refresh. Confirmed results from
          other sources remain visible.
        </p>
        <p className="mt-1 text-xs text-amber-200/60">
          {failure.message} Request {failure.requestId.slice(0, 8)}.
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            track("discover.retry-source", { source: failure.source });
            router.refresh();
          })
        }
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-200/20 px-3 text-xs font-medium text-amber-100 disabled:opacity-50"
      >
        {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
        Retry {failure.source.replaceAll("_", " ")}
      </button>
    </aside>
  );
}

function OpportunityCard({ item }: { item: MarketplaceOpportunity }) {
  const isPool = Boolean(item.pool);
  const isWork =
    item.source.type === "repository_snapshot" ||
    ["repository_fix", "project_contribution", "task", "bounty"].includes(item.type);
  const amount = money(item.reward?.amountUsd, item.reward?.token);
  const funded = money(item.funding?.fundedAmountUsd);
  const detailPath = `/opportunities/${item.slug}`;
  return (
    <article className="flex h-full flex-col rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-violet-200">
          {isPool ? "Community Pool" : isWork ? "Verified work" : item.type.replaceAll("_", " ")}
        </span>
        <span className="inline-flex items-center gap-1 text-cyan-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          {item.verificationStatus.replaceAll("_", " ")}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-6 text-white">{item.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{item.summary}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-white/[0.07] py-4 text-xs">
        <div>
          <dt className="text-slate-500">Source</dt>
          <dd className="mt-1 text-slate-200">{item.source.type.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Community</dt>
          <dd className="mt-1 text-slate-200">{item.community?.name ?? "Independent"}</dd>
        </div>
        {amount && (
          <div>
            <dt className="text-slate-500">Target or reward</dt>
            <dd className="mt-1 font-medium text-white">{amount}</dd>
          </div>
        )}
        {funded && (
          <div>
            <dt className="text-slate-500">Confirmed funded</dt>
            <dd className="mt-1 font-medium text-emerald-300">{funded}</dd>
          </div>
        )}
      </dl>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link
          href={detailPath}
          onClick={() => track("discover.inspect-proof", { opportunity: item.id })}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white hover:bg-violet-400"
        >
          {isWork ? "View proof" : "Inspect details"}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {isPool && (
          <Link
            href={`/capital?intent=back-pool&programId=${encodeURIComponent(item.source.id)}&returnTo=${encodeURIComponent(detailPath)}`}
            onClick={() => track("discover.back-pool", { opportunity: item.id })}
            className="inline-flex min-h-10 items-center rounded-lg border border-emerald-300/20 px-3 text-sm text-emerald-200 hover:bg-emerald-300/5"
          >
            Back Pool
          </Link>
        )}
      </div>
    </article>
  );
}

function OpportunityGrid({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: MarketplaceOpportunity[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (!items.length) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <OpportunityCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function PersonCard({ person }: { person: DiscoverPerson }) {
  const primaryPath = person.acceptsDirectFunding
    ? `/capital?intent=direct-support&recipient=${encodeURIComponent(person.id)}&returnTo=${encodeURIComponent(person.profilePath ?? "/discover?view=people")}`
    : `/mission?intent=invite-to-claim&recipient=${encodeURIComponent(person.id)}&returnTo=${encodeURIComponent("/discover?view=people")}`;
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{person.name}</h3>
          <p className="mt-1 text-xs capitalize text-slate-500">{person.kind}</p>
        </div>
        <ShieldCheck className="ml-auto h-4 w-4 text-cyan-300" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {person.verifiedIdentities.map((identity) => (
          <span
            key={identity}
            className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-slate-300"
          >
            {identity}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-400">
        Direct support:{" "}
        <span className={person.acceptsDirectFunding ? "text-emerald-300" : "text-amber-200"}>
          {person.acceptsDirectFunding ? "Ready" : "Invite to claim"}
        </span>
      </p>
      <div className="mt-5 flex gap-2">
        <Link
          href={primaryPath}
          onClick={() =>
            track(
              person.acceptsDirectFunding
                ? "discover.support-person"
                : "discover.invite-person",
              { person: person.id },
            )
          }
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white hover:bg-violet-400"
        >
          {person.acceptsDirectFunding ? "Support directly" : "Invite to claim"}
        </Link>
        <Link
          href={person.profilePath ?? `/discover?view=people&person=${person.id}`}
          className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm text-slate-300"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}

function PoolCard({ pool }: { pool: DiscoverPool }) {
  const returnTo = `/discover?view=pools&pool=${encodeURIComponent(pool.id)}`;
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <CircleDollarSign className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-white">{pool.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{pool.owner}</p>
        </div>
      </div>
      {pool.purpose && (
        <p className="mt-4 text-sm leading-6 text-slate-400">{pool.purpose}</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-white/[0.07] py-4 text-xs">
        <div>
          <dt className="text-slate-500">Confirmed balance</dt>
          <dd className="mt-1 font-medium text-white">
            {money(pool.balanceUsd, pool.token) ?? "No confirmed balance"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Distribution</dt>
          <dd className="mt-1 text-slate-200">Program rule controlled</dd>
        </div>
      </dl>
      <div className="mt-5 flex gap-2">
        <Link
          href={`/capital?intent=back-pool&programId=${encodeURIComponent(pool.id)}&returnTo=${encodeURIComponent(returnTo)}`}
          onClick={() => track("discover.back-pool", { pool: pool.id })}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white"
        >
          Back this Pool
        </Link>
        <Link
          href={`/discover?view=programs&q=${encodeURIComponent(pool.name)}`}
          className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm text-slate-300"
        >
          View rule
        </Link>
      </div>
    </article>
  );
}

function CommunityCard({ community }: { community: DiscoverCommunity }) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-white">{community.name}</h3>
          <p className="mt-1 text-xs capitalize text-slate-500">{community.type}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{community.purpose}</p>
      <Link
        href={`/communities/${community.slug}`}
        onClick={() => track("discover.open-community", { community: community.slug })}
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200"
      >
        Open community <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{body}</p>
    </section>
  );
}

function ReadinessSummary({ data }: { data: DiscoverPageData }) {
  if (!data.signedIn || !data.readiness) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#091522] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-white">Connect my community</h2>
          <p className="mt-1 text-sm text-slate-400">
            Public discovery stays open. Sign in only to manage repositories, programs, and Pools.
          </p>
        </div>
        <Link
          href="/communities"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white"
        >
          Open Communities
        </Link>
      </section>
    );
  }
  const readiness = data.readiness;
  const statuses = [
    { label: "GitHub identity", value: readiness.githubState },
    { label: "Repository access", value: readiness.repositoryState },
    { label: "Capital wallet", value: readiness.walletState },
  ];
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-white">Your confirmed workspace state</h2>
          <p className="mt-1 text-sm text-slate-400">
            The same state is used by Profile, Earn, Discover, and Capital.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {readiness.lastConfirmedAt
            ? `Confirmed ${new Date(readiness.lastConfirmedAt).toLocaleString()}`
            : "No confirmed snapshot"}
        </p>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {statuses.map((status) => (
          <div key={status.label} className="rounded-lg border border-white/[0.07] p-3">
            <dt className="text-xs text-slate-500">{status.label}</dt>
            <dd className="mt-1 text-sm capitalize text-slate-200">
              {status.value.replaceAll("_", " ")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {readiness.selectedWallet && (
          <span className="text-slate-400">
            Selected wallet <strong className="font-mono text-slate-200">{shortAddress(readiness.selectedWallet)}</strong>
          </span>
        )}
        <Link href="/communities?view=integrations" className="text-violet-300">
          Manage community integrations
        </Link>
      </div>
    </section>
  );
}

function ResultsHeader({
  title,
  count,
  filters,
}: {
  title: string;
  count: number;
  filters: OpportunityFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const updateSort = (sort: OpportunitySort) => {
    const next = new URLSearchParams(params.toString());
    next.set("sort", sort);
    next.delete("cursor");
    startTransition(() => router.replace(`/discover?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {count} confirmed result{count === 1 ? "" : "s"}
        </p>
      </div>
      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-400">
        Sort
        <select
          value={filters.sort}
          disabled={pending}
          onChange={(event) => updateSort(event.target.value as OpportunitySort)}
          className="bg-transparent text-sm text-slate-200 outline-none"
        >
          <option value="newest">Newest</option>
          <option value="closing_soon">Closing soon</option>
          <option value="most_funded">Most funded</option>
          <option value="most_active">Most active</option>
        </select>
      </label>
    </div>
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
    track("discover.view", { view: data.view });
  }, [data.view]);

  const section = useMemo(() => {
    if (data.view === "people") {
      return (
        <>
          <ResultsHeader title="Verified people" count={data.people.length} filters={filters} />
          {data.people.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.people.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matching verified person"
              body="Only real public contributor records are shown. Broaden the search or invite a contributor to claim their verified work."
            />
          )}
        </>
      );
    }
    if (data.view === "pools") {
      return (
        <>
          <ResultsHeader title="Published community Pools" count={data.pools.length} filters={filters} />
          {data.pools.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.pools.map((pool) => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matching published Pool"
              body="A Pool appears only when a real program and inspectable funding rule are available."
            />
          )}
        </>
      );
    }
    if (data.view === "my_communities") {
      const installed = new Set(data.readiness?.installedCommunitySlugs ?? []);
      const communities = data.signedIn
        ? data.communities.filter((community) => installed.has(community.slug))
        : [];
      return (
        <div className="space-y-4">
          <ReadinessSummary data={data} />
          {communities.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {communities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </div>
      );
    }
    const labels: Record<Exclude<DiscoverView, "people" | "pools" | "my_communities">, string> = {
      for_you: "Top real opportunities",
      work: "Verified work",
      programs: "Published programs",
      outcomes: "Confirmed outcome campaigns",
    };
    return (
      <>
        <ResultsHeader title={labels[data.view]} count={data.opportunities.total} filters={filters} />
        <OpportunityGrid
          items={data.opportunities.items}
          emptyTitle="No matching public opportunity"
          emptyBody="No fixture or unsupported integration is substituted. Broaden the search or connect a real community in Communities."
        />
      </>
    );
  }, [data, filters]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <Header data={data} />
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBox filters={filters} view={data.view} />
        <ViewTabs active={data.view} query={filters.q} />
      </div>
      <div className="mt-5 space-y-5">
        {data.view === "for_you" && (
          <>
            <FundingPaths />
            <Recommendation data={data} />
          </>
        )}
        <SourceFailure data={data} />
        {data.view !== "for_you" && data.readiness?.stale && <ReadinessSummary data={data} />}
        {section}
      </div>
    </main>
  );
}
