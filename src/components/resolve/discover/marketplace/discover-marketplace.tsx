"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
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
import { DISCOVER_VIEW_TO_ROUTE } from "@/lib/discover/marketplace/contracts";
import { isMarketListedPool } from "@/lib/discover/marketplace/pool-listing";
import type {
  DiscoverAction,
  DiscoverActivityItem,
  DiscoverAgentService,
  DiscoverInboxItem,
  DiscoverPageData,
  DiscoverPool,
  DiscoverSourceDiagnostic,
  DiscoverView,
  EconomicActionItem,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import { describeSignal } from "@/lib/discover/impact/impact-signals";
import type { ImpactProfile } from "@/lib/discover/impact/impact-signals";
import type { EconomicMatch } from "@/lib/discover/impact/economic-matching";
import type { OpportunityFilters } from "@/lib/discover/marketplace/filters";

type OpenAction = (action: DiscoverAction, item?: EconomicActionItem) => void;

const views: Array<{ id: DiscoverView; label: string; icon: typeof Activity }> =
  [
    { id: "for_you", label: "Verified Work", icon: FileCheck2 },
    { id: "explore", label: "Open Requests", icon: ClipboardList },
    { id: "activity", label: "Pools", icon: CircleDollarSign },
    { id: "agents", label: "Agent Marketplace", icon: Bot },
    { id: "outcomes", label: "Activity", icon: History },
  ];

// Single canonical serializer, shared with the parser in filters.ts via
// DISCOVER_VIEW_TO_ROUTE/DISCOVER_ROUTE_TO_VIEW so the two can never drift
// out of sync the way the old locally-duplicated tables did.
const publicViewId = DISCOVER_VIEW_TO_ROUTE;

function money(value?: number, token = "USDC") {
  if (value == null) return null;
  // Two decimals renders a real 0.003 USDC agent charge as "0 USDC". A
  // payment that happened must never display as nothing, so sub-cent amounts
  // keep the precision that shows what actually moved.
  const magnitude = Math.abs(value);
  const maximumFractionDigits = value !== 0 && magnitude < 0.01 ? 6 : 2;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value)} ${token}`;
}

/**
 * Root cause of React error #418 (authenticated Discover hydration
 * mismatch), found via a deterministic SSR/client digest comparison:
 * data was provably identical between server and client render passes,
 * and the error reproduced only in views that render this function
 * (WorkRow, OutcomesView) - never in views that don't (Agent Marketplace).
 * `Intl.DateTimeFormat` with no explicit `timeZone` uses the runtime's
 * local zone: Vercel's server always runs in UTC, but the viewer's
 * browser uses their own zone, so the same timestamp can format as a
 * different calendar day (e.g. 2026-08-18T02:00Z is "Aug 18" in UTC but
 * "Aug 17" in US Pacific) - a real text-node mismatch, not a false
 * positive. Pinning UTC makes the two passes agree unconditionally.
 */
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
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

// "Run service" names the mechanism, not the question being answered - a
// buyer decides from what they get back, not from a verb that fits every
// service equally. Keyed by the real registered service id.
const AGENT_SERVICE_RUN_LABEL: Record<string, string> = {
  sentiment: "Classify feedback",
  "citation-verify": "Check citation",
  "docs-review": "Review documentation",
  attribution: "Check attribution",
  "security-signal": "Analyze security evidence",
};

function agentServiceAction(service: DiscoverAgentService): DiscoverAction {
  const run = service.available;
  return {
    id: run
      ? "discover.run_agent_service"
      : "discover.inspect_agent_service",
    label: run
      ? (AGENT_SERVICE_RUN_LABEL[service.id] ?? "Get result")
      : "Inspect service",
    href: `/discover?view=agents&action=${run ? "discover.run_agent_service" : "discover.inspect_agent_service"}&subject=${encodeURIComponent(service.id)}`,
    enabled: true,
    requiresConfirmation: run,
    presentation: {
      kind: "workbench",
      target: { panel: "agent_service", subjectId: service.id },
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

/** The contextual Agent-purchase action attachVerifiedWorkActions attaches
 * when a work item has no persisted result yet - undefined once a result
 * exists, since the point is to resolve one real uncertainty, not to keep
 * offering the same purchase forever. */
function agentReviewSecondaryAction(work: MarketplaceOpportunity): DiscoverAction | undefined {
  return (work.secondaryActions ?? []).find(
    (action) => action.id === "discover.run_agent_service",
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
          Fund proven work, earn from funded requests, back shared Pools, or
          pay agents for useful services.
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
        placeholder="Search work, requests, Pools, contributors, repositories or services"
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentHref = `${pathname}${search ? `?${search}` : ""}`;
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [selected, setSelected] = useState(active);
  useEffect(() => setSelected(active), [active]);
  useEffect(() => {
    if (pendingHref === currentHref) setPendingHref(null);
  }, [currentHref, pendingHref]);
  useEffect(() => {
    if (!pendingHref) return;
    const recovery = window.setTimeout(() => {
      setPendingHref(null);
      setSelected(active);
    }, 10_000);
    return () => window.clearTimeout(recovery);
  }, [active, pendingHref]);
  return (
    <nav
      aria-label="Discover sections"
      className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#07111f] p-1"
    >
      {views.map((view) => {
        const Icon = view.icon;
        const href = discoverHref(view.id, filters);
        const loading = pendingHref === href && currentHref !== href;
        return (
          <Link
            key={view.id}
            href={href}
            prefetch
            aria-current={selected === view.id ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (currentHref === href || pendingHref === href) return;
              setPendingHref(href);
              setSelected(view.id);
              router.push(href, { scroll: false });
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

/**
 * Renders sourced adoption evidence, or states plainly that impact is not
 * yet measurable. Deliberately never falls back to stars/forks/merge counts
 * - see src/lib/discover/impact/impact-signals.ts. Each number shows its
 * source so a reader can check it, and repository-scoped numbers keep their
 * scope caveat rather than reading as per-change benefit.
 */
function ImpactSummary({ profile }: { profile?: ImpactProfile }) {
  if (!profile) return null;
  if (!profile.measurable) {
    return (
      <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">
        Impact not yet measurable. {profile.reason}
      </p>
    );
  }
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      {profile.signals.map((signal) => (
        <div key={signal.id} className="min-w-0">
          <dt className="text-[11px] text-slate-500">
            {signal.label}
            {signal.scope === "repository" ? " (repository)" : null}
          </dt>
          <dd className="mt-0.5 flex items-baseline gap-1.5 text-xs">
            <span className="font-semibold tabular-nums text-white">
              {signal.value}
            </span>
            {signal.sourceUrl ? (
              <a
                href={signal.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                {signal.source}
              </a>
            ) : (
              <span className="text-slate-500">{signal.source}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const MECHANISM_LABELS: Record<string, string> = {
  pool_allocation: "Pool allocation",
  sponsor_program: "Sponsor program",
  funded_request: "Funded request",
  recurring_support: "Recurring support",
  direct_support: "Direct support",
};

/**
 * Level 2 of the outcome row: which real capital could fund this, what was
 * ruled out and why, and whether a prior payment already covers it. Excluded
 * mechanisms stay behind a disclosure so the row stays dense, but they are
 * never hidden - a funder needs to see what RESOLVE considered.
 */
function EconomicMatchSummary({ match }: { match?: EconomicMatch }) {
  if (!match) return null;
  const { eligible, excluded, coverage, overlap } = match;
  if (!eligible.length && !excluded.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold text-violet-300">Funding match</span>
        {match.recommended ? (
          <span className="text-slate-200">
            {MECHANISM_LABELS[match.recommended] ?? match.recommended}
          </span>
        ) : (
          <span className="text-slate-400">No current funding match</span>
        )}
        {match.requiresReview ? (
          <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-[11px] text-amber-200">
            Needs funder review
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        {match.recommendationReason}
      </p>
      {eligible.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {eligible.map((entry) => (
            <li
              key={entry.intent.id}
              className="rounded border border-emerald-300/20 bg-emerald-300/[0.06] px-2 py-0.5 text-[11px] text-emerald-200"
            >
              {entry.intent.label}
            </li>
          ))}
        </ul>
      ) : null}
      {coverage.length ? (
        <p className="mt-2 text-xs text-slate-400">
          {coverage.length} prior payment{coverage.length === 1 ? "" : "s"} found.{" "}
          {overlap === "duplicate_obligation"
            ? "This obligation is already settled and must not be paid again."
            : overlap === "possible_overlap"
              ? "Purpose may overlap, so a funder decides."
              : "Different economic purpose, so this is not a duplicate."}
        </p>
      ) : null}
      {excluded.length ? (
        <details className="mt-2 group">
          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
            Why? ({excluded.length})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {excluded.map((entry) => (
              <li key={entry.intent.id} className="text-[11px] leading-4 text-slate-500">
                <span className="text-slate-400">{entry.intent.label}</span> — {entry.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Deterministic, evidence-based reasons this outcome is in the feed.
 *
 * Deliberately not a score. "Impact 87/100" compresses unlike things into one
 * number a reader cannot check; each line here is a statement they can verify
 * against the evidence, and a line is only emitted when it is actually true.
 */
function whySurfaced(work: MarketplaceOpportunity): string[] {
  const reasons: string[] = [];
  const profile = work.impactProfile;

  if (profile?.measurable) {
    // describeSignal carries the scope caveat - repository-level adoption is
    // explicitly not a claim about this specific change.
    for (const signal of profile.signals.slice(0, 2)) {
      reasons.push(describeSignal(signal));
    }
  }

  const match = work.economicMatch;
  if (match?.eligible.length) {
    reasons.push(`${match.eligible[0]!.intent.label} accepts this class of outcome`);
  }
  if (match && match.coverage.length === 0) {
    reasons.push("No previous obligation covers the same purpose");
  }
  if (work.entityState?.financialReadiness === "ready") {
    reasons.push("Recipient payout route is ready");
  }
  return reasons;
}

function WhySurfaced({ work }: { work: MarketplaceOpportunity }) {
  const reasons = whySurfaced(work);
  if (!reasons.length) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
        Why RESOLVE surfaced this
      </summary>
      <ul className="mt-1.5 space-y-1">
        {reasons.map((reason) => (
          <li key={reason} className="text-[11px] leading-4 text-slate-400">
            · {reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The real source ecosystem for the dense row's Ecosystem column - never a
 * "GitHub" fallback for a non-GitHub source just because `repository` is
 * unset. */
function ecosystemLabel(work: MarketplaceOpportunity): string {
  if (work.repository) return work.repository;
  switch (work.source.type) {
    case "research_work":
      return "Research";
    case "listenbrainz_listen":
      return "Media";
    case "open_collective_contribution":
      return "Open Collective";
    default:
      return work.category ?? "Verified work";
  }
}

/** The real source platform name, for the row's quiet metadata line - never a decorative badge. */
function platformLabel(work: MarketplaceOpportunity): string {
  switch (work.source.type) {
    case "github_evidence":
    case "repository_snapshot":
      return "GitHub";
    case "research_work":
      return "Research index";
    case "listenbrainz_listen":
      return "ListenBrainz";
    case "open_collective_contribution":
      return "Open Collective";
    default:
      return "";
  }
}

/**
 * Truthful role label (Phase 2 item 2/9): GitHub evidence proves
 * contribution/authorship/publication, never "maintainer". A release
 * outcome's creator published that release; every other GitHub-evidence
 * outcome's creator contributed it. Never inflated for how it reads.
 */
function creatorRoleLabel(work: MarketplaceOpportunity): string {
  if (work.id.startsWith("github-release:")) return "Release publisher";
  if (work.source.type === "github_evidence") return "Contributor";
  return "";
}

/** The single strongest, most concrete impact fact for a dense row - never
 * a blended score, always the first real connector-observed signal. */
function strongestImpactFact(profile?: ImpactProfile): string | null {
  if (!profile || !profile.measurable || !profile.signals.length) return null;
  const top = profile.signals[0];
  return `${top.value} ${top.label.toLowerCase()}`;
}

/** Normalizes the funding mechanics into one plain-language economic state,
 * for the dense row's Funding column. Full mechanism detail (which intents
 * were excluded and why) stays in the row's Details disclosure. */
function fundingStateLabel(
  work: MarketplaceOpportunity,
  payoutState: string,
): string {
  if (work.economicMatch?.overlap === "duplicate_obligation") return "Already covered";
  if (work.economicMatch?.overlap === "possible_overlap") return "Possible overlap";
  if (work.economicMatch?.recommended) return "Funding match found";
  if (payoutState === "Payout setup required" || payoutState === "Contributor unclaimed") {
    return "Payout setup needed";
  }
  if (work.economicMatch?.coverage.length) return "Already covered";
  return "No current funding match";
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
            // "Reward unavailable" named a payment that was never offered and
            // gave the reader nothing to act on. State the settlement fact.
            : "No settlement route yet";
  // Coverage is a matching result, not a guess from an attached program name.
  const coverageState = work.economicMatch?.coverage.length
    ? `${work.economicMatch.coverage.length} prior payment${work.economicMatch.coverage.length === 1 ? "" : "s"}`
    : work.program?.name
      ? `Covered by ${work.program.name}`
      : "No prior payment found";
  const inspectEvidence =
    work.primaryAction?.id === "discover.open_evidence"
      ? work.primaryAction
      : ((work.secondaryActions ?? []).find(
          (action) => action.id === "discover.open_evidence",
        ) ?? detailAction("work", work.source.id, "View proof"));
  // Community-funding rows are already-confirmed outcomes from an external
  // ledger, not unfunded GitHub work waiting on attribution/payout - running
  // them through the GitHub-shaped payout/coverage logic above would show
  // "No settlement route yet" on money that already moved.
  //
  // Three visual zones, not six equal fields: outcome (title + quiet
  // ecosystem/creator line), state (strongest fact + funding state), one
  // action. Backend still carries every field; the row reads as one
  // sentence, not six competing decisions.
  const ROW_GRID =
    "grid gap-x-5 gap-y-1.5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_auto] md:items-center";

  if (work.source.type === "open_collective_contribution") {
    return (
      <article className="rounded-xl border border-white/[0.08] bg-[#091522] px-4 py-3">
        <div className={ROW_GRID}>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-white">{work.title}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Open Collective · {work.summary}
            </p>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-emerald-300">
              {money(work.funding?.fundedAmountUsd)} confirmed
            </p>
            <p className="truncate text-[11px] text-slate-500">{dateLabel(work.updatedAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {work.primaryAction ? (
              <ContextualAction action={work.primaryAction} item={context} onOpen={onOpen} primary />
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  const impactFact = strongestImpactFact(work.impactProfile);
  const fundingLabel = fundingStateLabel(work, payoutState);
  const hasDetails = Boolean(
    work.impactProfile ||
      work.economicMatch ||
      work.agentResult?.summary ||
      whySurfaced(work).length ||
      work.entityState?.blocker,
  );

  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#091522] px-4 py-3">
      {selectable ? (
        <label className="mb-2 inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect?.(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black/30 accent-violet-500"
          />
          Add to support bundle
        </label>
      ) : null}
      <div className={ROW_GRID}>
        {/* Outcome: title, then one quiet line - ecosystem/platform/creator role.
            Rich data stays visible; it reads as one sentence, not three fields. */}
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-white">{work.title}</h3>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 truncate text-xs text-slate-500">
            <GitBranch className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
            <span className="min-w-0 truncate">{ecosystemLabel(work)}</span>
            {platformLabel(work) ? <span aria-hidden>·</span> : null}
            {platformLabel(work) ? <span>{platformLabel(work)}</span> : null}
            <span aria-hidden>·</span>
            <span>
              {creatorRoleLabel(work) ? `${creatorRoleLabel(work)} ` : ""}
              {work.creator.name}
            </span>
          </p>
        </div>
        {/* State: the one strongest observed fact, then the funding state quietly beneath it. */}
        <div className="min-w-0">
          <p className="truncate text-xs">
            {impactFact ? (
              <span className="font-medium text-white">{impactFact}</span>
            ) : (
              <span className="text-slate-500">Impact not yet measured</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{fundingLabel}</p>
        </div>
        {/* Action: exactly one primary, at most one quiet secondary. */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {work.primaryAction &&
          work.primaryAction.id !== "discover.open_evidence" ? (
            <ContextualAction
              action={work.primaryAction}
              item={context}
              primary
              onOpen={onOpen}
            />
          ) : null}
          {/* Cap at one secondary action. Proof is supporting evidence, not an
              economic action, so it never becomes the highlighted primary
              button - but when there's real, unresolved uncertainty and no
              persisted Agent result yet, offering to resolve it is more
              useful here than a second "View proof" click. */}
          {(!work.primaryAction || work.primaryAction.id === "discover.open_evidence") &&
          !work.agentResult &&
          agentReviewSecondaryAction(work) ? (
            <ContextualAction action={agentReviewSecondaryAction(work)!} item={context} onOpen={onOpen} />
          ) : (
            <ContextualAction action={inspectEvidence} item={context} onOpen={onOpen} />
          )}
        </div>
      </div>
      {hasDetails ? (
        <details className="mt-2 group">
          <summary className="cursor-pointer list-none text-[11px] text-slate-500 hover:text-slate-300">
            Details
          </summary>
          <div className="mt-2 border-t border-white/[0.06] pt-3">
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="text-emerald-300">
                {work.verificationStatus === "verified" ||
                work.verificationStatus.startsWith("verified_")
                  ? "Evidence verified"
                  : `Evidence ${work.verificationStatus.replaceAll("_", " ")}`}
              </span>
              <span>{coverageState}</span>
              <span>{payoutState}</span>
            </div>
            <ImpactSummary profile={work.impactProfile} />
            <EconomicMatchSummary match={work.economicMatch} />
            {work.agentResult?.summary ? (
              <p className="mt-3 max-w-3xl text-xs leading-5 text-cyan-200/80">
                <span className="font-medium text-cyan-200">Agent result:</span>{" "}
                {work.agentResult.summary}
              </p>
            ) : null}
            <WhySurfaced work={work} />
            {work.entityState?.blocker ? (
              <p className="mt-3 max-w-3xl text-xs leading-5 text-amber-100/80">
                {work.entityState.blocker}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
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
          <span className="text-slate-500">Confirmed on Arc</span>
          <span className="text-slate-200">
            {money(confirmed) ?? "Nothing confirmed yet"}
          </span>
        </div>
        {/* The bar tracks the next checkpoint, not budgetUsd: funding
            increments budgetUsd, so a bar drawn against it moved the finish
            line on every deposit and could never fill. */}
        {pool.nextCheckpointUsd && pool.checkpointProgressPct != null ? (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width]"
                style={{
                  width: `${Math.min(100, Math.max(0, pool.checkpointProgressPct))}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {pool.checkpointProgressPct}% to the next checkpoint at{" "}
              {money(pool.nextCheckpointUsd)}
              {confirmed && confirmed > 0
                ? ` · ${money(Math.max(0, pool.nextCheckpointUsd - confirmed))} still needed`
                : ""}
            </p>
          </>
        ) : null}
        {/* "Pending confirmation" claims a deposit is in flight on Arc. That
            is only true when a transaction was actually submitted. This number
            is a sum of recorded stakes whose on-chain provenance RESOLVE
            cannot verify, so it must not borrow the language of settlement. */}
        {pool.pendingDepositsUsd ? (
          <p className="mt-2 text-xs text-slate-400">
            {money(pool.pendingDepositsUsd)} recorded as committed. RESOLVE has
            no on-chain record for it, so it is not counted as funding.
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

function AgentServiceCard({
  service,
  onOpen,
}: {
  service: DiscoverAgentService;
  onOpen: OpenAction;
}) {
  const action = agentServiceAction(service);
  // What this answers, what it costs, and where it's useful, at a glance -
  // "Use this when / Produces / Cannot establish" on every card read as API
  // documentation. The same detail (plus limitations) now lives one click
  // away in the run drawer, where a buyer sees it right before paying.
  const use = service.decisionContext?.useWhen ?? service.tagline;
  return (
    <article className="grid gap-4 rounded-xl border border-white/[0.08] bg-[#091522] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-cyan-300">
            <Bot className="h-3.5 w-3.5" />
            {service.provider}
          </span>
          {!service.available ? (
            <span className="rounded-full border border-amber-300/20 px-2 py-0.5 text-[11px] text-amber-100">
              Payment paused
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 font-semibold text-white">{service.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{use}</p>
        <p className="mt-2 text-xs text-slate-500">
          {service.priceUsd.toFixed(3)} USDC / {service.billingUnit}
          {service.deliverables.length ? ` · ${service.deliverables[0]}` : ""}
        </p>
        {!service.available && service.blocker ? (
          <p className="mt-2 max-w-lg text-xs leading-5 text-amber-100/80">
            {service.blocker}
          </p>
        ) : null}
      </div>
      <ContextualAction action={action} primary onOpen={onOpen} />
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
  const supportable = work.filter(
    (item) => item.primaryAction?.id === "discover.fund_verified_work",
  ).length;
  const supportTargets = work.flatMap((item) =>
    item.primaryAction?.presentation.kind === "workbench" &&
    item.primaryAction.presentation.target.panel === "work_funding"
      ? [{ work: item, target: item.primaryAction.presentation.target }]
      : [],
  );
  const selectedTargets = supportTargets.filter(({ work: item }) =>
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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-violet-300">Verified impact</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Outcomes with evidence, and who they reached
          </h2>
          {/* A merge is provenance, not value. This surface answers what
              changed, what adoption evidence exists, and whether any capital
              has declared an interest - not "who deserves a reward". */}
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Each row is a persisted outcome with a source record. Adoption
            evidence is shown only where a connector observed it. Payment
            appears when capital has an interest and the recipient can settle.
          </p>
        </div>
        {work.length ? (
          <div className="flex gap-2 text-xs">
            <span className="rounded-lg border border-white/[0.08] bg-[#091522] px-3 py-2 text-slate-300">
              {work.length} outcome{work.length === 1 ? "" : "s"}
            </span>
            {supportable > 0 ? (
              <span className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-2 text-emerald-200">
                {supportable} can settle now
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
      {supportTargets.length ? (
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
                selectable={supportTargets.some(({ work: candidate }) => candidate.id === item.id)}
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
          title="No outcomes match the current source snapshot"
          body="Connect a project below to observe its accepted work and adoption evidence. If a source fails, RESOLVE keeps the last valid snapshot and reports the reason rather than showing empty or invented records."
        />
      )}
      {/* Source ingestion is a setup task, not a marketplace opportunity, so
          it sits after the feed instead of occupying the first viewport. */}
      <details className="group rounded-xl border border-white/[0.08] bg-[#091522]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-300 transition hover:text-white">
          <span className="inline-flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-cyan-300" />
            Add a project source
            <span className="text-xs font-normal text-slate-500">
              Observe accepted work and adoption evidence from a public repository
            </span>
          </span>
        </summary>
        <div className="border-t border-white/[0.06] px-4 py-4">
          <RepositoryAnalyzer />
        </div>
      </details>
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
            Project source
          </p>
          <h2 className="mt-1 font-semibold text-white">
            Observe a public repository
          </h2>
          {/* Merges are recorded as provenance. Whether an outcome carries
              economic weight depends on adoption evidence and on capital
              declaring an interest - not on the merge itself. */}
          <p className="mt-1 text-xs leading-5 text-slate-400">
            RESOLVE records accepted work as source evidence and observes
            downstream adoption where a connector can measure it. Recording a
            project does not by itself make its work payable.
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
            {request.funding?.status === "funded"
              ? "Payment confirmed on Arc"
              : request.funding?.status === "escrowed"
                ? "Arc escrow confirmed"
                : "Funding required before publication"}
          </dd>
        </div>
        {request.provider.selected ? (
          <div>
            <dt className="text-slate-500">Contributor</dt>
            <dd className="mt-1 text-white">{request.provider.selected.name}</dd>
          </div>
        ) : null}
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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-cyan-300">Funded requests</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Ask for useful work, with proof and payment terms
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            A request becomes public once its USDC budget is confirmed in Arc escrow. Contributors submit proof before the requester releases payment.
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
        /* The header already carries the single Post CTA. Repeating it here
           was two buttons for one action; this space explains what an
           outcome-backed request is instead. */
        <CompactEmpty
          title="No funded requests are open right now"
          body="Need something done? Post a request above - it becomes public once its budget is confirmed in Arc escrow."
        />
      )}
      {personalRequests.length ? (
        <section>
          <SectionTitle title="Your requests" count={personalRequests.length} />
          <div className="mt-3 space-y-5">
            {personalRequestGroups(personalRequests).map((group) => (
              <div key={group.key}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {group.title} · {group.requests.length}
                </p>
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  {group.requests.map((request) => (
                    <RequestCard key={request.id} request={request} data={data} onOpen={onOpen} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Groups a requester's own requests by lifecycle stage instead of one flat
 * list, so "needs your action now" (review, release) doesn't get lost
 * between drafts and long-settled ones. */
function personalRequestGroups(
  requests: MarketplaceOpportunity[],
): Array<{ key: string; title: string; requests: MarketplaceOpportunity[] }> {
  const stageOrder: Array<{ key: string; title: string; statuses: string[] }> = [
    { key: "needs_review", title: "Needs your review", statuses: ["under_review", "approved"] },
    { key: "in_progress", title: "In progress", statuses: ["assigned", "payment_submitted"] },
    { key: "ready_to_fund", title: "Ready to fund", statuses: ["ready_to_fund", "draft"] },
    { key: "completed", title: "Completed", statuses: ["confirmed", "completed"] },
    { key: "closed", title: "Closed", statuses: ["refunded", "cancelled"] },
  ];
  const remaining = [...requests];
  const groups: Array<{ key: string; title: string; requests: MarketplaceOpportunity[] }> = [];
  for (const stage of stageOrder) {
    const matched = remaining.filter((request) => stage.statuses.includes(request.status));
    if (!matched.length) continue;
    for (const request of matched) remaining.splice(remaining.indexOf(request), 1);
    groups.push({ key: stage.key, title: stage.title, requests: matched });
  }
  if (remaining.length) groups.push({ key: "other", title: "Other", requests: remaining });
  return groups;
}

function PoolsView({
  data,
  onOpen,
}: {
  data: DiscoverPageData;
  onOpen: OpenAction;
}) {
  if (data.projection.kind !== "activity") return null;
  // One canonical authority for what belongs in the public market, instead
  // of two independent heuristics (a lifecycle-state check that missed
  // funded/distributing Pools entirely, and an action-shape check that
  // classified "operator" by what button happened to render).
  const ready = data.pools.filter((pool) => isMarketListedPool(pool));
  const operator = data.pools.filter((pool) => !isMarketListedPool(pool));
  const distributions = data.opportunities.items.filter(
    (item) =>
      item.marketplaceKind === "outcome" &&
      item.source.type === "confirmed_receipt" &&
      Boolean(item.pool),
  );
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold text-emerald-300">Community funding</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Pools</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
          {ready.length
            ? `${ready.length} market-listed Pool${ready.length === 1 ? "" : "s"}.`
            : "No Pools are market-listed right now."}
        </p>
      </section>
      {ready.length ? (
        <section>
          <SectionTitle title="Pools" count={ready.length} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {ready.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}
          </div>
        </section>
      ) : (
        <CompactEmpty
          title="No Pools are market-listed right now"
          body="A Pool becomes fundable once its policy, treasury, and evidence source are all configured and it passes review."
        />
      )}
      {/* Unfinished Pools you operate are your setup backlog, not market
          inventory - a wall of full cards here made 17 admin to-dos read as
          the marketplace itself. One compact row per Pool, grouped only by
          the single prerequisite still blocking it. */}
      {operator.length ? (
        <section className="rounded-xl border border-amber-300/10 bg-amber-300/[0.03] p-4">
          <p className="text-xs font-semibold text-amber-200">
            Needs your attention · {operator.length} Pool{operator.length === 1 ? "" : "s"} you operate
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Not visible to funders until setup is complete.
          </p>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {operatorPoolGroups(operator).map((group) => (
              <div key={group.key} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {group.title}
                </p>
                <div className="mt-2 space-y-2">
                  {group.pools.map((pool) => (
                    <div
                      key={pool.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{pool.name}</p>
                        <p className="truncate text-xs text-slate-500">{pool.communitySlug}</p>
                      </div>
                      <ContextualAction action={pool.primaryAction} onOpen={onOpen} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

/**
 * Buckets operator-owned Pools by the first unmet prerequisite - the same
 * precedence the normalizer uses to choose each card's action, so the group
 * heading and the button inside it always agree.
 */
function operatorPoolGroups(pools: DiscoverPool[]): Array<{
  key: string;
  title: string;
  explanation: string;
  pools: DiscoverPool[];
}> {
  // Group on setupStep, the same field the card's action is built from.
  // policyState/treasuryReadiness are both derived from one financialReadiness
  // boolean, so grouping on them put a Pool whose policy was already active
  // under "Needs a funding rule" while its button correctly said "Add
  // treasury" - heading and action contradicting each other.
  const groups = [
    {
      key: "publication",
      title: "Waiting on your publication review",
      explanation:
        "These are configured but not yet approved for public discovery. Nobody else can fund them until you approve.",
      match: (pool: DiscoverPool) =>
        pool.setupStep === "publication" ||
        (!pool.setupStep && pool.publicationState !== "approved"),
    },
    {
      key: "policy",
      title: "Needs a funding rule",
      explanation:
        "A Pool cannot decide who qualifies for capital until a versioned funding policy is active.",
      match: (pool: DiscoverPool) =>
        pool.setupStep === "policy" ||
        (!pool.setupStep && pool.policyState === "setup_required"),
    },
    {
      key: "treasury",
      title: "Needs a treasury destination",
      explanation:
        "Capital has nowhere to settle until a valid Arc address is attached.",
      match: (pool: DiscoverPool) =>
        pool.setupStep === "treasury" ||
        (!pool.setupStep && pool.treasuryReadiness === "setup_required"),
    },
    {
      key: "source",
      title: "Needs an evidence source",
      explanation:
        "Without a connected source there is no evidence to decide who qualifies for capital.",
      match: (pool: DiscoverPool) => pool.setupStep === "source",
    },
  ];

  const remaining = [...pools];
  const result: Array<{
    key: string;
    title: string;
    explanation: string;
    pools: DiscoverPool[];
  }> = [];

  for (const group of groups) {
    const matched = remaining.filter(group.match);
    if (!matched.length) continue;
    for (const pool of matched) remaining.splice(remaining.indexOf(pool), 1);
    result.push({
      key: group.key,
      title: group.title,
      explanation: group.explanation,
      pools: matched,
    });
  }

  if (remaining.length) {
    result.push({
      key: "other",
      title: "Your other Pools",
      explanation:
        "Setup is complete for these. They are held here because Arc preflight has not passed yet.",
      pools: remaining,
    });
  }
  return result;
}

function AgentMarketplaceView({
  data,
  filters,
  onOpen,
}: {
  data: DiscoverPageData;
  filters: OpportunityFilters;
  onOpen: OpenAction;
}) {
  if (data.view !== "agents") return null;
  const query = filters.q?.trim().toLowerCase();
  const services = query
    ? data.agentMarketplace.services.filter((service) =>
        [
          service.name,
          service.tagline,
          service.description,
          service.provider,
          service.domain,
          ...service.deliverables,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : data.agentMarketplace.services;
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold text-cyan-300">
          Pay per useful result
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          Agent Marketplace
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
          Inspect a registered service, set a maximum spend, choose a wallet,
          and pay once for a structured result. A successful run records the
          Arc transaction and RESOLVE execution reference.
        </p>
      </section>
      {data.agentMarketplace.blocker ? (
        <aside className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3">
          <p className="text-sm font-medium text-amber-100">
            Payment is not available on this deployment yet
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-200/70">
            Prices and services below are real. No payment or result will be
            claimed until this is resolved.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-amber-200/50 hover:text-amber-200/80">
              Why?
            </summary>
            <p className="mt-1 text-[11px] leading-5 text-amber-200/60">
              {data.agentMarketplace.blocker}
            </p>
          </details>
        </aside>
      ) : null}
      {services.length ? (
        <section>
          <SectionTitle title="Services" count={services.length} />
          <div className="space-y-3">
            {services.map((service) => (
              <AgentServiceCard
                key={service.id}
                service={service}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ) : (
        <CompactEmpty
          title="No registered service matches this search"
          body="RESOLVE does not create placeholder providers or synthetic service cards. Clear the search to inspect the current provider registry."
        />
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
  // agent_service was missing, so every paid agent run was filtered out of
  // the ledger even though it settled on Arc and produced a result.
  const supportedKinds = new Set([
    "work",
    "funding",
    "pool",
    "transaction",
    "receipt",
    "agent_service",
  ]);
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
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold text-violet-300">Your ledger</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Activity and receipts</h2>
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
  const agentServices = data.agentMarketplace.services.slice(0, 3);
  const inProgress = (data.activity ?? [])
    .filter((item) => !["confirmed", "receipt_issued"].includes(item.state))
    .slice(0, 3);
  const noLiveSections =
    work.length + requests.length + pools.length + agentServices.length + inProgress.length === 0;
  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/discover?view=verified_work" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4 transition hover:border-cyan-300/30"><p className="text-sm font-semibold text-white">Fund proven work</p><p className="mt-1 text-xs leading-5 text-slate-400">Inspect persisted evidence and reward the attributed contributor.</p></Link>
        <Link href="/discover?view=requests" className="rounded-xl border border-violet-300/15 bg-violet-300/[0.035] p-4 transition hover:border-violet-300/30"><p className="text-sm font-semibold text-white">Post or take a request</p><p className="mt-1 text-xs leading-5 text-slate-400">Use evidence requirements and Arc escrow for work that still needs doing.</p></Link>
        <Link href="/discover?view=pools" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4 transition hover:border-emerald-300/30"><p className="text-sm font-semibold text-white">Back a shared Pool</p><p className="mt-1 text-xs leading-5 text-slate-400">Fund only published Pools with a valid rule and treasury.</p></Link>
        <Link href="/discover?view=agents" className="rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-4 transition hover:border-amber-300/30"><p className="text-sm font-semibold text-white">Buy an agent result</p><p className="mt-1 text-xs leading-5 text-slate-400">Review the price and output before authorising one Arc USDC service run.</p></Link>
      </section>
      {work.length ? <section><SectionTitle title="Verified work ready for action" count={work.length} href="/discover?view=verified_work" /><div className="space-y-3">{work.map((item) => <WorkRow key={item.id} work={item} data={data} onOpen={onOpen} />)}</div></section> : null}
      {requests.length ? <section><SectionTitle title="Open and funded requests" count={requests.length} href="/discover?view=requests" /><div className="grid gap-3 lg:grid-cols-2">{requests.map((item) => <RequestCard key={item.id} request={item} data={data} onOpen={onOpen} />)}</div></section> : null}
      {pools.length ? <section><SectionTitle title="Pools accepting USDC" count={pools.length} href="/discover?view=pools" /><div className="grid gap-3 lg:grid-cols-2">{pools.map((pool) => <PoolCard key={pool.id} pool={pool} data={data} onOpen={onOpen} />)}</div></section> : null}
      {agentServices.length ? <section><SectionTitle title="Agent services with live pricing" count={data.agentMarketplace.services.length} href="/discover?view=agents" /><div className="space-y-3">{agentServices.map((service) => <AgentServiceCard key={service.id} service={service} onOpen={onOpen} />)}</div></section> : null}
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
      ...data.agentMarketplace.services.map(agentServiceAction),
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
            <PoolsView data={data} onOpen={openWorkbench} />
          ) : data.view === "agents" ? (
            <AgentMarketplaceView
              data={data}
              filters={filters}
              onOpen={openWorkbench}
            />
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
