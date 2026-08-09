"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  GitBranch,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { DiscoverActionWorkbench } from "@/components/resolve/discover/marketplace/discover-action-workbench";
import type {
  DiscoverAction,
  DiscoverActivityItem,
  DiscoverInboxItem,
  DiscoverPageData,
  DiscoverPool,
  DiscoverSourceDiagnostic,
  DiscoverView,
  EconomicActionItem,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import type { OpportunityFilters } from "@/lib/discover/marketplace/filters";

type OpenAction = (action: DiscoverAction, item?: EconomicActionItem) => void;

const views: Array<{ id: DiscoverView; label: string; icon: typeof Activity }> =
  [
    { id: "for_you", label: "Verified Work", icon: FileCheck2 },
    { id: "explore", label: "Open Requests", icon: ClipboardList },
    { id: "activity", label: "Pools", icon: CircleDollarSign },
    { id: "outcomes", label: "Activity", icon: History },
  ];

const publicViewId: Record<DiscoverView, string> = {
  for_you: "verified_work",
  explore: "requests",
  activity: "pools",
  outcomes: "activity",
};

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${token}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function discoverHref(
  view: DiscoverView,
  filters: OpportunityFilters,
  kind = filters.kind,
) {
  const params = new URLSearchParams({ view: publicViewId[view] });
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
  if (view === "explore" && kind && kind !== "all") params.set("kind", kind);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return `/discover?${params.toString()}`;
}

function track(
  actionId: string,
  properties?: Record<string, string | number | boolean>,
) {
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
  const owningView =
    entityType === "pool" || entityType === "program" || entityType === "community"
      ? "pools"
      : "verified_work";
  return {
    id: ids[entityType],
    label,
    href: `/discover?view=${owningView}&action=${ids[entityType]}&subject=${encodeURIComponent(subjectId)}`,
    enabled: true,
    presentation: {
      kind: "workbench",
      target: { panel: "entity_details", subjectId, entityType },
    },
  };
}

function findContext(data: DiscoverPageData, subjectId: string) {
  return data.economicActions.find(
    (item) =>
      item.subjectId === subjectId ||
      item.poolId === subjectId ||
      item.programId === subjectId ||
      item.receiptId === subjectId,
  );
}

function Header({
  filters,
  view,
}: {
  filters: OpportunityFilters;
  view: DiscoverView;
}) {
  return (
    <header className="grid min-h-[96px] gap-4 rounded-2xl border border-white/[0.08] bg-[#081321] px-5 py-4 lg:grid-cols-[minmax(260px,.7fr)_minmax(420px,1fr)] lg:items-center lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
          Discover
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Find accepted work, support contributors, and fund ready Pools with
          USDC on Arc Testnet.
        </p>
      </div>
      <SearchBox filters={filters} view={view} />
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
  const current = params.toString();
  const [query, setQuery] = useState(filters.q ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<number | null>(null);
  useEffect(() => setHydrated(true), []);
  useEffect(() => setQuery(filters.q ?? ""), [filters.q]);
  const commitQuery = useCallback(
    (value: string) => {
      const next = new URLSearchParams(current);
      next.set("view", publicViewId[view]);
      next.delete("cursor");
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}?${next.toString()}`,
      );
      startTransition(() => router.refresh());
    },
    [current, pathname, router, view],
  );
  useEffect(() => {
    if (query === (filters.q ?? "")) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      commitQuery(query);
    }, 250);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [commitQuery, filters.q, query]);
  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        const submitted = new FormData(event.currentTarget).get("q");
        commitQuery(typeof submitted === "string" ? submitted : query);
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={query}
        disabled={!hydrated}
        name="q"
        onChange={(event) => setQuery(event.target.value)}
        type="search"
        aria-label="Search Discover"
        placeholder="Search accepted work, contributors, repositories or Pools"
        className="min-h-11 w-full rounded-xl border border-white/10 bg-[#050e19] pl-11 pr-11 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60"
      />
      {pending ? (
        <LoaderCircle
          aria-label="Updating results"
          className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-300"
        />
      ) : null}
    </form>
  );
}

function ViewTabs({
  active,
  filters,
}: {
  active: DiscoverView;
  filters: OpportunityFilters;
}) {
  const [selected, setSelected] = useState(active);
  useEffect(() => setSelected(active), [active]);
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
        const loading = selected === view.id && selected !== active;
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
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm transition ${selected === view.id ? "bg-[#1a2940] font-semibold text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
          >
            <Icon className="h-4 w-4" />
            {view.label}
            {loading ? (
              <LoaderCircle
                aria-label={`Loading ${view.label}`}
                className="h-3.5 w-3.5 animate-spin text-violet-300"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ContextualAction({
  action,
  item,
  primary = false,
  onOpen,
}: {
  action: DiscoverAction;
  item?: EconomicActionItem;
  primary?: boolean;
  onOpen: OpenAction;
}) {
  const classes = primary
    ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400"
    : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/[0.05]";
  if (!action.enabled)
    return (
      <button
        type="button"
        disabled
        title={action.disabledReason}
        className={`${classes} cursor-not-allowed opacity-50`}
      >
        {action.label}
      </button>
    );
  if (action.presentation.kind === "workbench") {
    const subjectId = action.presentation.target.subjectId;
    return (
      <button
        type="button"
        data-action-id={action.id}
        onClick={() => {
          track("discover_action_opened", {
            actionId: action.id,
            subject: item?.subjectId ?? subjectId,
          });
          onOpen(action, item);
        }}
        className={classes}
      >
        {action.label}
        {primary ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    );
  }
  return (
    <Link
      href={action.href}
      target={action.presentation.target === "external" ? "_blank" : undefined}
      rel={action.presentation.target === "external" ? "noreferrer" : undefined}
      data-action-id={action.id}
      className={classes}
    >
      {action.label}
      {action.presentation.target === "external" ? (
        <ExternalLink className="h-3.5 w-3.5" />
      ) : null}
    </Link>
  );
}

function WorkRow({
  work,
  data,
  onOpen,
  selectable = false,
  selected = false,
  onSelect,
}: {
  work: MarketplaceOpportunity;
  data: DiscoverPageData;
  onOpen: OpenAction;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}) {
  const context = findContext(data, work.source.id);
  const blocker = work.entityState?.blocker?.toLowerCase() ?? "";
  const payoutState =
    work.primaryAction?.id === "discover.fund_verified_work"
      ? "Payout ready"
      : work.primaryAction?.id === "profile.set_payout_destination"
        ? "Payout setup required"
        : blocker.includes("not claimed")
          ? "Contributor unclaimed"
          : blocker.includes("payout")
            ? "Payout not ready"
            : "Reward unavailable";
  const coverageState = work.program?.name
    ? `Covered by ${work.program.name}`
    : "Not currently covered";
  const inspectEvidence =
    work.primaryAction?.id === "discover.open_evidence"
      ? work.primaryAction
      : ((work.secondaryActions ?? []).find(
          (action) => action.id === "discover.open_evidence",
        ) ?? detailAction("work", work.source.id, "Inspect evidence"));
  return (
    <article className="grid gap-4 rounded-xl border border-white/[0.08] bg-[#091522] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        {selectable ? (
          <label className="mb-3 inline-flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelect?.(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/30 accent-violet-500"
            />
            Add to support bundle
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-cyan-300">
            <GitBranch className="h-3.5 w-3.5" />
            {work.repository ?? "GitHub"}
          </span>
          <span className="text-slate-600">{dateLabel(work.updatedAt)}</span>
        </div>
        <h3 className="mt-2 font-semibold text-white">{work.title}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {work.creator.name} /{" "}
          {work.category?.replaceAll("_", " ") ?? "accepted contribution"}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="text-emerald-300">
            {work.verificationStatus === "verified"
              ? "Evidence verified"
              : `Evidence ${work.verificationStatus.replaceAll("_", " ")}`}
          </span>
          <span>{coverageState}</span>
          <span>{payoutState}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {work.primaryAction &&
        work.primaryAction.id !== "discover.open_evidence" ? (
          <ContextualAction
            action={work.primaryAction}
            item={context}
            primary
            onOpen={onOpen}
          />
        ) : null}
        <ContextualAction
          action={inspectEvidence}
          item={context}
          primary={
            !work.primaryAction ||
            work.primaryAction.id === "discover.open_evidence"
          }
          onOpen={onOpen}
        />
      </div>
    </article>
  );
}

function PoolCard({
  pool,
  data,
  onOpen,
}: {
  pool: DiscoverPool;
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const context = findContext(data, pool.id);
  const target = pool.targetUsd;
  const confirmed = pool.balanceUsd;
  const progress =
    target && target > 0 && confirmed != null
      ? Math.min(100, Math.max(0, (confirmed / target) * 100))
      : null;
  const ready = pool.lifecycleState === "accepting_funding";
  const operatorAction =
    pool.primaryAction.presentation.kind === "workbench" &&
    pool.primaryAction.presentation.target.panel === "program_setup";
  const details = detailAction("pool", pool.id, "View Pool");
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-emerald-300">
            {pool.communitySlug}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">{pool.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{pool.type}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] ${ready ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-100"}`}
        >
          {ready ? "Accepting funds" : "Setup incomplete"}
        </span>
      </div>
      {pool.purpose ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">
          {pool.purpose}
        </p>
      ) : null}
      <div className="mt-5">
        <div className="flex items-end justify-between text-xs">
          <span className="text-slate-500">Confirmed funding</span>
          <span className="text-slate-200">
            {money(confirmed) ?? "Not confirmed"}
            {target ? ` / ${money(target)}` : ""}
          </span>
        </div>
        {progress != null ? (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
        {pool.pendingDepositsUsd ? (
          <p className="mt-2 text-xs text-amber-100">
            {money(pool.pendingDepositsUsd)} pending confirmation
          </p>
        ) : null}
      </div>
      {!ready ? (
        <p className="mt-4 rounded-lg bg-amber-300/[0.04] px-3 py-2 text-xs leading-5 text-amber-100">
          {operatorAction
            ? pool.blocker
            : "Funding is not available until setup is complete."}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <ContextualAction
          action={ready || operatorAction ? pool.primaryAction : details}
          item={context}
          primary
          onOpen={onOpen}
        />
        {ready || operatorAction ? (
          <ContextualAction action={details} item={context} onOpen={onOpen} />
        ) : null}
      </div>
    </article>
  );
}

function ActivityRow({
  item,
  data,
  onOpen,
}: {
  item: DiscoverActivityItem;
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const Icon =
    item.kind === "receipt"
      ? BadgeCheck
      : item.kind === "work"
        ? FileCheck2
        : item.kind === "program"
          ? GitBranch
          : item.kind === "account"
            ? UserRound
            : WalletCards;
  const context = findContext(data, item.id.replace(/^[^:]+:/, ""));
  return (
    <article className="grid gap-3 border-b border-white/[0.07] px-1 py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-slate-300">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-white">{item.title}</h3>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-400">
            {item.state.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {item.description}
          {item.amountUsd != null
            ? ` / ${money(item.amountUsd, item.token)}`
            : ""}
        </p>
      </div>
      {item.primaryAction ? (
        <ContextualAction
          action={item.primaryAction}
          item={context}
          onOpen={onOpen}
        />
      ) : null}
    </article>
  );
}

function SectionTitle({
  title,
  count,
  href,
}: {
  title: string;
  count?: number;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">
        {title}
        {count != null ? (
          <span className="ml-2 text-xs font-normal text-slate-500">
            {count}
          </span>
        ) : null}
      </h2>
      {href ? (
        <Link
          href={href}
          className="text-xs font-medium text-violet-300 hover:text-violet-200"
        >
          View all
        </Link>
      ) : null}
    </div>
  );
}

function SourceFailure({ data }: { data: DiscoverPageData }) {
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
          One source could not refresh. Last-known records remain visible.
        </p>
        <p className="mt-1 text-xs text-amber-200/60">
          {failure.message} Request {failure.requestId.slice(0, 8)}.
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-200/20 px-3 text-xs font-medium text-amber-100 disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Retry
      </button>
    </aside>
  );
}

function ForYouView({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  filters: OpportunityFilters;
  onOpen: OpenAction;
}) {
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  if (data.projection.kind !== "for_you") return null;
  const work = data.opportunities.items
    .filter(
      (item) =>
        item.marketplaceKind === "verified_work" ||
        item.source.type === "github_evidence" ||
        item.source.type === "repository_snapshot",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const rewardReady = work.filter(
    (item) => item.primaryAction?.id === "discover.fund_verified_work",
  ).length;
  const rewardTargets = work.flatMap((item) =>
    item.primaryAction?.presentation.kind === "workbench" &&
    item.primaryAction.presentation.target.panel === "work_funding"
      ? [{ work: item, target: item.primaryAction.presentation.target }]
      : [],
  );
  const selectedTargets = rewardTargets.filter(({ work: item }) =>
    selectedWorkIds.includes(item.id),
  );
  const bundleAction: DiscoverAction = {
    id: "discover.create_support_bundle",
    label: `Support selected (${selectedTargets.length})`,
    href: "/discover?view=verified_work",
    enabled: selectedTargets.length > 0,
    disabledReason: "Select at least one reward-ready work item.",
    requiresConfirmation: true,
    presentation: {
      kind: "workbench",
      target: {
        panel: "support_bundle",
        subjectId: `bundle:${selectedTargets.map(({ work: item }) => item.id).join(",")}`,
        workItems: selectedTargets.map(({ target }) => target),
      },
    },
  };
  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-violet-300">Accepted work</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Verify the work, then reward the person who did it
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Every row comes from a persisted accepted event and a current Evidence record. Inspecting proof is public. Rewards require a claimed contributor and a verified Arc payout destination.
          </p>
        </div>
        {work.length ? (
          <div className="flex gap-2 text-xs">
            <span className="rounded-lg border border-white/[0.08] bg-[#091522] px-3 py-2 text-slate-300">
              {work.length} accepted event{work.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-2 text-emerald-200">
              {rewardReady} reward ready
            </span>
          </div>
        ) : null}
      </section>
      <RepositoryAnalyzer />
      {rewardTargets.length ? (
        <section className="flex flex-col gap-3 rounded-xl border border-violet-300/15 bg-violet-300/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Support several contributors</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">Select reward-ready work below, review each recipient and amount, then authorise the real Arc transfers.</p>
          </div>
          <ContextualAction action={bundleAction} primary onOpen={onOpen} />
        </section>
      ) : null}
      {work.length ? (
        <section>
          <SectionTitle title="Verified work" count={work.length} />
          <div className="space-y-3">
            {work.map((item) => (
              <WorkRow
                key={item.id}
                work={item}
                data={data}
                onOpen={onOpen}
                selectable={rewardTargets.some(({ work: candidate }) => candidate.id === item.id)}
                selected={selectedWorkIds.includes(item.id)}
                onSelect={(checked) =>
                  setSelectedWorkIds((current) =>
                    checked
                      ? [...new Set([...current, item.id])]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : (
        <CompactEmpty
          title="No accepted work matches the current source snapshot"
          body="Analyse a public repository above. RESOLVE will persist only supported merged work. Provider failure keeps the last valid snapshot visible and reports the source reason instead of replacing it with fake or empty records."
        />
      )}
    </div>
  );
}

type RepositoryAnalysis = {
  persisted: boolean;
  fingerprint: string;
  ingest: {
    fullName: string;
    prCount: number;
    contributorCount: number;
    ingestedAt: string;
  };
  pullRequests: Array<{
    number: number;
    title: string;
    author: string;
    mergedAt: string | null;
  }>;
};



function RepositoryAnalyzer() {
  const router = useRouter();
  const params = useSearchParams();
  const [repository, setRepository] = useState(params.get("repository") ?? "");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    const requested = params.get("repository");
    if (requested) setRepository(requested);
  }, [params]);
  async function analyze(repositoryValue = repository) {
    const match = repositoryValue.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!match) {
      setError("Enter a public repository as owner/repository.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: match[1], repo: match[2] }),
      });
      const body = (await response.json()) as RepositoryAnalysis & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Repository analysis failed");
      setAnalysis(body);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Repository analysis failed",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      id="repository-analysis"
      className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,.75fr)_minmax(360px,1fr)] lg:items-center">
        <div>
          <p className="text-xs font-semibold text-cyan-300">
            Repository analyzer
          </p>
          <h2 className="mt-1 font-semibold text-white">
            Analyse accepted GitHub work
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Merged supported activity is saved as evidence and appears in Work
            after validation.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("repository");
            const submittedRepository =
              typeof value === "string" ? value : repository;
            setRepository(submittedRepository);
            void analyze(submittedRepository);
          }}
          className="flex gap-2"
        >
          <input
            name="repository"
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            disabled={pending || !hydrated}
            placeholder="owner/repository"
            aria-label="Public GitHub repository"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#050d17] px-3 text-sm text-white outline-none disabled:opacity-60"
          />
          <button
            disabled={pending || !hydrated}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Analyse
          </button>
        </form>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {analysis ? (
        <div className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.03] p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                {analysis.ingest.fullName}
              </h3>
              <p className="mt-1 text-xs text-emerald-200">
                Evidence saved to Discover
              </p>
            </div>
            <p className="text-xs text-slate-300">
              {analysis.ingest.prCount} pull requests /{" "}
              {analysis.ingest.contributorCount} contributors
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {analysis.pullRequests
              .filter((item) => item.mergedAt)
              .slice(0, 4)
              .map((item) => (
                <div
                  key={item.number}
                  className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-300"
                >
                  #{item.number} {item.title} / @{item.author}
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RequestCard({
  request,
  data,
  onOpen,
}: {
  request: MarketplaceOpportunity;
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const context = findContext(data, request.source.id);
  const statusLabel = request.status.replaceAll("_", " ");
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-300">
            {request.repository ?? "Independent request"}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {request.title}
          </h3>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-slate-300">
          {statusLabel}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
        {request.description}
      </p>
      <dl className="mt-4 grid gap-3 border-y border-white/[0.07] py-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Requester</dt>
          <dd className="mt-1 text-white">{request.creator.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Budget</dt>
          <dd className="mt-1 text-white">
            {money(request.reward?.amountUsd, request.reward?.token ?? "USDC") ??
              "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Evidence required</dt>
          <dd className="mt-1 line-clamp-2 text-white">
            {request.evidenceRequirements[0] ?? "Persisted Evidence"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Payment protection</dt>
          <dd className="mt-1 text-white">
            {request.funding?.status === "escrowed"
              ? "Arc escrow confirmed"
              : "Funding required before publication"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {request.primaryAction ? (
          <ContextualAction
            action={request.primaryAction}
            item={context}
            primary
            onOpen={onOpen}
          />
        ) : null}
      </div>
    </article>
  );
}

function ExploreView({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  filters: OpportunityFilters;
  onOpen: OpenAction;
}) {
  if (data.projection.kind !== "explore") return null;
  const requests = data.opportunities.items.filter(
    (item) => item.source.type === "resolve_request",
  );
  const postAction: DiscoverAction = {
    id: "discover.post_request",
    label: "Post a request",
    href: "/discover?view=requests",
    enabled: true,
    requiresConfirmation: false,
    presentation: {
      kind: "workbench",
      target: { panel: "request", subjectId: "new", mode: "post" },
    },
  };
  const openRequests = requests.filter((item) => item.status === "open");
  const personalRequests = requests.filter((item) => item.status !== "open");
  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-cyan-300">Funded requests</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Ask for useful work, with proof and payment terms
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            A request becomes public only after its USDC budget is confirmed in Arc escrow. Contributors submit persisted Evidence before the requester can release payment.
          </p>
        </div>
        <ContextualAction action={postAction} primary onOpen={onOpen} />
      </section>
      {openRequests.length ? (
        <section>
          <SectionTitle title="Open and funded" count={openRequests.length} />
          <div className="grid gap-3 lg:grid-cols-2">
            {openRequests.map((request) => (
              <RequestCard key={request.id} request={request} data={data} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : (
        <CompactEmpty
          title="No funded request is open right now"
          body="Post a real request above. Drafts stay private and no opportunity is shown as open until Arc escrow confirms its budget."
          action={<ContextualAction action={postAction} primary onOpen={onOpen} />}
        />
      )}
      {personalRequests.length ? (
        <section>
          <SectionTitle title="Your request workspaces" count={personalRequests.length} />
          <div className="grid gap-3 lg:grid-cols-2">
            {personalRequests.map((request) => (
              <RequestCard key={request.id} request={request} data={data} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ActivityView({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  if (data.projection.kind !== "activity") return null;
  const ready = data.pools.filter(
    (pool) => pool.lifecycleState === "accepting_funding",
  );
  const operator = data.pools.filter(
    (pool) =>
      pool.primaryAction.presentation.kind === "workbench" &&
      pool.primaryAction.presentation.target.panel === "program_setup",
  );
  const unavailable = data.pools.filter(
    (pool) => !ready.includes(pool) && !operator.includes(pool),
  );
  const distributions = data.opportunities.items.filter(
    (item) =>
      item.marketplaceKind === "outcome" &&
      item.source.type === "confirmed_receipt" &&
      Boolean(item.pool),
  );
  return (
    <div className="space-y-7">
      <section>
        <p className="text-xs font-semibold text-emerald-300">Community funding</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          Pools with visible rules, treasury state, and receipts
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
          Fund only Pools whose publication, policy, allocation, treasury, and Arc preflight pass. Operator-owned Pools stay visible here with the exact setup action that remains.
        </p>
      </section>
      {ready.length ? (
        <section>
          <SectionTitle title="Ready to fund" count={ready.length} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {ready.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}
          </div>
        </section>
      ) : (
        <CompactEmpty
          title="No Pool has passed funding preflight"
          body="The stored Pools remain visible below. Funding stays disabled until their real publication, policy, allocation, treasury and Arc checks pass."
        />
      )}
      {operator.length ? (
        <section>
          <SectionTitle title="Your Pools to finish" count={operator.length} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {operator.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}
          </div>
        </section>
      ) : null}
      {unavailable.length ? (
        <section>
          <SectionTitle title="Published Pool records" count={unavailable.length} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {unavailable.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}
          </div>
        </section>
      ) : null}
      {distributions.length ? (
        <section>
          <SectionTitle title="Confirmed distributions" count={distributions.length} />
          <div className="space-y-2">
            {distributions.map((outcome) => <OutcomeRow key={outcome.id} outcome={outcome} data={data} onOpen={onOpen} />)}
          </div>
        </section>
      ) : (
        <p className="text-xs text-slate-500">
          No Pool distribution receipt is confirmed in the current database.
        </p>
      )}
    </div>
  );
}

function OutcomesView({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const { openSignIn } = useSignInModal();
  const params = useSearchParams();
  if (data.projection.kind !== "outcomes") return null;
  if (!data.signedIn) {
    return (
      <CompactEmpty
        title="Sign in to view your economic activity"
        body="Your requests, rewards, Pool funding, transaction states and receipts are private to your RESOLVE session."
        action={<button type="button" onClick={openSignIn} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">Sign in</button>}
      />
    );
  }
  const supportedKinds = new Set(["work", "funding", "pool", "transaction", "receipt"]);
  const personal = (data.activity ?? []).filter((item) => supportedKinds.has(item.kind));
  const confirmedReceipts = data.projection.items;
  const activeFilter = params.get("state") ?? "all";
  const filtered = personal.filter((item) => {
    if (activeFilter === "receipts") return item.kind === "receipt";
    if (activeFilter === "confirmed") return ["confirmed", "completed"].includes(item.state);
    if (activeFilter === "in_progress") return ["prepared", "submitted", "pending", "awaiting_confirmation", "under_review", "approved"].includes(item.state);
    return true;
  });
  const tabs = [
    ["all", "All"],
    ["in_progress", "In progress"],
    ["confirmed", "Confirmed"],
    ["receipts", "Receipts"],
  ];
  return (
    <div className="space-y-7">
      <section>
        <p className="text-xs font-semibold text-violet-300">Your ledger</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Activity and receipts</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
          Follow each real action from preparation through submission, confirmation, and receipt. Submitted transactions never appear as confirmed before Arc and RESOLVE both record proof.
        </p>
        <nav aria-label="Activity state" className="mt-4 flex gap-1 overflow-x-auto">
          {tabs.map(([id, label]) => <Link key={id} href={`/discover?view=activity&state=${id}`} className={`rounded-full border px-3 py-1.5 text-xs ${activeFilter === id ? "border-violet-300/30 bg-violet-400/10 text-white" : "border-white/10 text-slate-400"}`}>{label}</Link>)}
        </nav>
      </section>
      {filtered.length ? (
        <section className="rounded-xl border border-white/[0.08] bg-[#091522] px-4">
          {filtered.map((item) => <ActivityRow key={item.id} item={item} data={data} onOpen={onOpen} />)}
        </section>
      ) : (
        <CompactEmpty title="No activity matches this state" body="Only canonical records tied to your account are shown. Start a request, reward verified work, or fund a ready Pool to create a real lifecycle record." />
      )}
      {confirmedReceipts.length ? (
        <section>
          <SectionTitle title="Receipt archive" count={confirmedReceipts.length} />
          <div className="space-y-2">{confirmedReceipts.map((outcome) => <OutcomeRow key={outcome.id} outcome={outcome} data={data} onOpen={onOpen} />)}</div>
        </section>
      ) : (
        <p className="text-xs text-slate-500">No receipt-backed outcome is confirmed for this account.</p>
      )}
    </div>
  );
}

function OutcomeRow({
  outcome,
  data,
  onOpen,
}: {
  outcome: MarketplaceOpportunity;
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const context = findContext(data, outcome.source.id);
  return (
    <article className="grid gap-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
        <CheckCircle2 className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-medium text-emerald-300">
          Confirmed outcome
        </p>
        <h3 className="mt-1 font-semibold text-white">{outcome.title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {outcome.community?.name ?? "RESOLVE"} /{" "}
          {dateLabel(outcome.updatedAt)} / {outcome.reward?.network ?? "Arc"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-white">
          {money(outcome.funding?.fundedAmountUsd, outcome.reward?.token)}
        </span>
        {outcome.primaryAction ? (
          <ContextualAction
            action={outcome.primaryAction}
            item={context}
            primary
            onOpen={onOpen}
          />
        ) : null}
      </div>
    </article>
  );
}

function AttentionRow({
  item,
  data,
  onOpen,
}: {
  item: DiscoverInboxItem;
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const context = findContext(data, item.id);
  return (
    <article className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-medium text-white">{item.title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{item.why}</p>
        {item.blocker ? (
          <p className="mt-1 text-xs text-amber-200">{item.blocker}</p>
        ) : null}
      </div>
      <ContextualAction
        action={item.primaryAction}
        item={context}
        onOpen={onOpen}
      />
    </article>
  );
}

function CompactEmpty({
  title,
  body,
  action,
  lifecycle = false,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  lifecycle?: boolean;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-dashed border-white/[0.1] px-5 py-8 text-center">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {body}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      {lifecycle ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span>Prepared</span>
          <ArrowRight className="h-3 w-3" />
          <span>Submitted</span>
          <ArrowRight className="h-3 w-3" />
          <span>Confirmed</span>
          <ArrowRight className="h-3 w-3" />
          <span>Receipt</span>
        </div>
      ) : null}
    </section>
  );
}

function SourceDiagnostics({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  if (!data.sourceDiagnostics.length || data.view !== "outcomes") return null;
  return (
    <section>
      <SectionTitle title="Source status" />
      <div className="grid gap-3 lg:grid-cols-2">
        {data.sourceDiagnostics.map((diagnostic) => (
          <SourceDiagnosticCard
            key={diagnostic.id}
            diagnostic={diagnostic}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function SourceDiagnosticCard({
  diagnostic,
  onOpen,
}: {
  diagnostic: DiscoverSourceDiagnostic;
  onOpen: OpenAction;
}) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] p-4">
      <div className="flex justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white">
            {diagnostic.repository ?? "GitHub connection"}
          </h3>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {diagnostic.state.replaceAll("_", " ")}
          </p>
        </div>
        {diagnostic.stale ? (
          <span className="text-xs text-amber-200">Last-known snapshot</span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        {diagnostic.reason}
      </p>
      <div className="mt-3">
        <ContextualAction action={diagnostic.primaryAction} onOpen={onOpen} />
      </div>
    </article>
  );
}

function LandingView({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  const work = data.opportunities.items
    .filter((item) => item.source.type === "github_evidence")
    .slice(0, 3);
  const requests = data.opportunities.items
    .filter(
      (item) => item.source.type === "resolve_request" && item.status === "open",
    )
    .slice(0, 2);
  const pools = data.pools
    .filter((pool) => pool.lifecycleState === "accepting_funding")
    .slice(0, 2);
  const inProgress = (data.activity ?? [])
    .filter((item) => !["confirmed", "receipt_issued"].includes(item.state))
    .slice(0, 3);
  const noLiveSections =
    work.length + requests.length + pools.length + inProgress.length === 0;
  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/discover?view=verified_work" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4 transition hover:border-cyan-300/30"><p className="text-sm font-semibold text-white">Fund proven work</p><p className="mt-1 text-xs leading-5 text-slate-400">Inspect persisted evidence and reward the attributed contributor.</p></Link>
        <Link href="/discover?view=requests" className="rounded-xl border border-violet-300/15 bg-violet-300/[0.035] p-4 transition hover:border-violet-300/30"><p className="text-sm font-semibold text-white">Post or take a request</p><p className="mt-1 text-xs leading-5 text-slate-400">Use evidence requirements and Arc escrow for work that still needs doing.</p></Link>
        <Link href="/discover?view=pools" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4 transition hover:border-emerald-300/30"><p className="text-sm font-semibold text-white">Back a shared Pool</p><p className="mt-1 text-xs leading-5 text-slate-400">Fund only published Pools with a valid rule and treasury.</p></Link>
      </section>
      {work.length ? <section><SectionTitle title="Verified work ready for action" count={work.length} href="/discover?view=verified_work" /><div className="space-y-3">{work.map((item) => <WorkRow key={item.id} work={item} data={data} onOpen={onOpen} />)}</div></section> : null}
      {requests.length ? <section><SectionTitle title="Open and funded requests" count={requests.length} href="/discover?view=requests" /><div className="grid gap-3 lg:grid-cols-2">{requests.map((item) => <RequestCard key={item.id} request={item} data={data} onOpen={onOpen} />)}</div></section> : null}
      {pools.length ? <section><SectionTitle title="Pools accepting USDC" count={pools.length} href="/discover?view=pools" /><div className="grid gap-3 lg:grid-cols-2">{pools.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}</div></section> : null}
      {data.signedIn && inProgress.length ? <section><SectionTitle title="In progress" count={inProgress.length} href="/discover?view=activity" /><div className="space-y-2">{inProgress.map((item) => <ActivityRow key={item.id} item={item} data={data} onOpen={onOpen} />)}</div></section> : null}
      {noLiveSections ? <p className="rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-slate-400">No persisted marketplace record is ready yet. Analyse accepted GitHub work, post a funded request, or finish an operator-owned Pool. RESOLVE won&apos;t fill this page with demo records.</p> : null}
    </div>
  );
}

function DiscoverMarketplaceContent({
  data,
  filters,
}: {
  data: DiscoverPageData;
  filters: OpportunityFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [active, setActive] = useState<{
    action: DiscoverAction;
    item?: EconomicActionItem;
  } | null>(null);
  const pendingWorkbenchKey = useRef<string | null>(null);
  const landing = params.toString() === "";
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
  const generatedDetails = useMemo(
    () => [
      ...data.people.map((person) =>
        detailAction("person", person.id, "View profile"),
      ),
      ...data.pools.map((pool) => detailAction("pool", pool.id, "View Pool")),
      ...data.communities.map((community) =>
        detailAction("community", community.id, "Explore community"),
      ),
      ...data.opportunities.items
        .filter((item) => item.marketplaceKind === "program")
        .map((item) => detailAction("program", item.source.id, "View Program")),
    ],
    [data],
  );
  const activeKey =
    active?.action.presentation.kind === "workbench"
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
    if (pendingWorkbenchKey.current === urlKey)
      pendingWorkbenchKey.current = null;
    if (activeKey === urlKey) return;
    const candidates = [
      ...data.opportunities.items.flatMap((opportunity) =>
        [opportunity.primaryAction, ...(opportunity.secondaryActions ?? [])]
          .filter((action): action is DiscoverAction => Boolean(action))
          .map((action) => ({
            action,
            item: findContext(data, opportunity.source.id),
          })),
      ),
      ...data.people.flatMap((person) =>
        [person.primaryAction, ...person.secondaryActions]
          .filter((action): action is DiscoverAction => Boolean(action))
          .map((action) => ({ action, item: findContext(data, person.id) })),
      ),
      ...data.pools.flatMap((pool) =>
        [pool.primaryAction, ...pool.secondaryActions]
          .filter((action): action is DiscoverAction => Boolean(action))
          .map((action) => ({ action, item: findContext(data, pool.id) })),
      ),
      ...data.economicActions.flatMap((item) => [
        { action: item.primaryAction, item },
        ...item.secondaryActions.map((action) => ({ action, item })),
      ]),
      ...data.sourceDiagnostics.flatMap((diagnostic) =>
        [diagnostic.primaryAction, ...diagnostic.secondaryActions].map(
          (action) => ({
            action,
            item: undefined,
          }),
        ),
      ),
      ...generatedDetails.map((action) => ({
        action,
        item: findContext(data, subjectId),
      })),
    ];
    const match = candidates.find(
      ({ action }) =>
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
  return (
    <div
      data-discover-marketplace
      className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8"
    >
      <Header filters={filters} view={data.view} />
      <div className="mt-3">
        <ViewTabs active={data.view} filters={filters} />
      </div>
      <div className="mt-4 space-y-4">
        <SourceFailure data={data} />
        <div className="pt-1">
          {landing ? (
            <LandingView data={data} onOpen={openWorkbench} />
          ) : data.projection.kind === "for_you" ? (
            <ForYouView data={data} filters={filters} onOpen={openWorkbench} />
          ) : data.projection.kind === "explore" ? (
            <ExploreView data={data} filters={filters} onOpen={openWorkbench} />
          ) : data.projection.kind === "activity" ? (
            <ActivityView data={data} onOpen={openWorkbench} />
          ) : (
            <OutcomesView data={data} onOpen={openWorkbench} />
          )}
        </div>
        <SourceDiagnostics data={data} onOpen={openWorkbench} />
      </div>
      <DiscoverActionWorkbench
        action={active?.action ?? null}
        item={active?.item}
        data={data}
        onClose={closeWorkbench}
      />
    </div>
  );
}

export function DiscoverMarketplace(props: {
  data: DiscoverPageData;
  filters: OpportunityFilters;
}) {
  return <DiscoverMarketplaceContent {...props} />;
}
