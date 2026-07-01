"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import { CAPITAL_YIELD_COPY } from "@/lib/capital/copy";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { dedupeQueueWithTrending } from "@/lib/discover/queue-dedupe";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import type { DiscoverIntent } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { sectionVisibleForRole } from "@/lib/discover/role-filters";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { needTypeBadgeClass, needTypeLabel, primaryBoardCtaLabel } from "@/lib/discover/need-types";
import {
  boardCommunityActions,
  boardSubtitleForRole,
  boardUseCaseLine,
} from "@/lib/discover/board-actions-for-role";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { isCommunityInstalled } from "@/lib/profile/connection-state-types";
import {
  sortByOpportunityScore,
  type OpportunitySortKey,
} from "@/lib/discover/opportunity-score";
import { DiscoverOpportunityScoreChips } from "@/components/resolve/discover/discover-opportunity-score-chips";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";

type DiscoverOpportunityQueueProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  needType?: DiscoverNeedTypeFilter;
  className?: string;
};

const RETURN_URL = "/discover#opportunities";

/** Discover-native fulfillment queue — deduped from trending, inline fund refreshes gaps. */
export function DiscoverOpportunityQueue({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  needType = "all",
  className,
}: DiscoverOpportunityQueueProps) {
  const { executeFund, refreshWallet, busy, wallet } = useDiscoverActions();
  const { state: connections } = useUserConnections();
  const { feed, refresh: refreshTrending } = useDiscoverRadarFeed();
  const [board, setBoard] = useState<DiscoverBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<OpportunitySortKey>("composite");
  const opportunitiesRef = useRef(board);
  opportunitiesRef.current = board;

  const showQueue =
    sectionVisibleForRole("opportunities", role) &&
    (role === "all" || role === "funder" || role === "founder" || role === "dao" || intent === "fund" || intent === "sponsor");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28_000);
    try {
      const res = await fetch("/api/capital/discover", { signal: controller.signal });
      if (!res.ok) throw new Error("Queue unavailable");
      const data = await res.json();
      setBoard(data.board ?? data.opportunities ?? []);
      if (data.degraded && !(data.board ?? data.opportunities ?? []).length) {
        setError("Board is still loading — try Refresh in a moment");
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      setError(aborted ? "Opportunity board timed out — try Refresh" : "Could not load fulfillment queue");
      discoverFetchErrorToast(
        "discover-queue",
        aborted ? "Opportunity board timed out" : "Fulfillment queue unavailable",
        () => void loadQueue(),
        Boolean(opportunitiesRef.current.length),
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  const walletUsd = wallet.loaded ? wallet.spendableUsd : null;

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const programItems = useMemo(
    () => board.filter((b): b is FundableOpportunity & { boardKind: "program" } => b.boardKind === "program"),
    [board],
  );

  const deduped = useMemo(
    () => dedupeQueueWithTrending(programItems, feed?.gaps ?? []),
    [programItems, feed?.gaps],
  );

  const communityItems = useMemo(
    () => board.filter((b) => b.boardKind === "community"),
    [board],
  );

  const programFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = deduped.map((p) => ({ ...p, boardKind: "program" as const }));
    if (needType !== "all") {
      rows = rows.filter((o) => o.needType === needType);
    }
    if (q) {
      rows = rows.filter(
        (o) =>
          o.programName.toLowerCase().includes(q) ||
          o.communityName.toLowerCase().includes(q) ||
          o.communitySlug.toLowerCase().includes(q) ||
          o.whyFund.toLowerCase().includes(q),
      );
    }
    return sortByOpportunityScore(rows, sortKey);
  }, [deduped, query, needType, sortKey]);

  const exploreFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = communityItems;
    if (needType !== "all") {
      rows = rows.filter((o) => o.needType === needType);
    }
    if (q) {
      rows = rows.filter(
        (o) =>
          o.programName.toLowerCase().includes(q) ||
          o.communityName.toLowerCase().includes(q) ||
          o.communitySlug.toLowerCase().includes(q) ||
          o.whyFund.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [communityItems, query, needType]);

  const hasVerifiedPrograms = programFiltered.length > 0;

  async function fundRow(o: FundableOpportunity) {
    const raw = amountByProgram[o.programId] ?? "25";
    const amountUsd = Number(raw);
    if (!Number.isFinite(amountUsd) || amountUsd < 5) {
      toast.error("Amount can't be less than $5");
      return;
    }
    setFundingId(o.programId);
    try {
      await executeFund({
        programId: o.programId,
        amountUsd,
        label: o.programName,
        communitySlug: o.communitySlug,
        templateId: o.templateId,
      });
      await Promise.all([loadQueue(), refreshWallet(), refreshTrending()]);
    } catch {
      /* toast handled in provider */
    } finally {
      setFundingId(null);
    }
  }

  const subtitle = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{boardSubtitleForRole(role, signedIn, walletUsd)}</span>
      {signedIn && walletUsd != null && (
        <Link
          href="/capital"
          className="inline-flex items-center gap-1 rounded-md border border-resolve-accent/25 bg-resolve-accent/10 px-2 py-0.5 text-[11px] font-medium text-resolve-accent hover:bg-resolve-accent/15"
        >
          <Wallet className="h-3 w-3" />
          Manage wallet
        </Link>
      )}
    </span>
  );

  return (
    <DiscoverPremiumSection
      id="opportunities"
      title="Opportunity board"
      subtitle={subtitle}
      className={className}
      hidden={!showQueue}
      actions={<DiscoverSectionRefresh sectionId="opportunity-board" onRefresh={loadQueue} />}
    >
      <p className="mb-4 text-[11px] leading-relaxed text-resolve-muted-dim">{boardUseCaseLine(role)}</p>
      {hasVerifiedPrograms && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Sort by
          </span>
          {(
            [
              ["composite", "Score"],
              ["reward", "Reward"],
              ["urgency", "Urgency"],
              ["confidence", "Confidence"],
              ["impact", "Impact"],
              ["difficulty", "Ease"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-[10px] font-medium transition",
                sortKey === key
                  ? "border-resolve-accent/40 bg-resolve-accent/15 text-white"
                  : "border-white/10 text-resolve-muted hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {loading && !board.length ? (
        <DiscoverStatePanel variant="loading">
          <div className="flex items-center justify-center gap-2 text-sm text-resolve-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading programs…
          </div>
        </DiscoverStatePanel>
      ) : error && !hasVerifiedPrograms && !exploreFiltered.length ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void loadQueue()} />
        </DiscoverStatePanel>
      ) : !hasVerifiedPrograms && !exploreFiltered.length ? (
        <DiscoverStatePanel variant="empty">
          <p className="text-sm text-resolve-muted">
            {query.trim()
              ? "No programs match your search."
              : "No ledger-backed programs to fund yet. Attach a community below — verified gaps rank on Gaps and Radars when sensors sync."}
          </p>
          {!query.trim() && (
            <button
              type="button"
              onClick={() => {
                document.getElementById("discover-workspace")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-4 inline-flex rounded-lg border border-resolve-calm-blue/30 bg-resolve-calm-blue/10 px-4 py-2 text-sm font-medium text-resolve-calm-blue hover:bg-resolve-calm-blue/15"
            >
              Browse Gaps
            </button>
          )}
        </DiscoverStatePanel>
      ) : (
        <>
          {hasVerifiedPrograms && (
        <ul className="divide-y divide-white/[0.06]">
          {programFiltered.map((o) => {
            const program = o as FundableOpportunity & { needType?: import("@/lib/discover/need-types").DiscoverNeedType };
            const programNeed = program.needType ?? "funding";
            const fundLabel = primaryBoardCtaLabel(programNeed, {
              boardKind: "program",
              templateId: program.templateId,
            });
            return (
            <li
              key={program.programId}
              className="resolve-signal-service-row px-1 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{program.programName}</p>
                    <span
                      className={clsx(
                        "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase",
                        needTypeBadgeClass(programNeed),
                      )}
                    >
                      {needTypeLabel(programNeed)}
                    </span>
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-violet-300">
                      {program.templateLabel}
                    </span>
                    <DiscoverSourceBadge source="supabase_ledger" />
                    {program.yieldMultiplier >= program.targetMultiplier && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-300">
                        {CAPITAL_YIELD_COPY.discover.targetBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-resolve-muted">
                    {program.communityName} — {program.communityTagline}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-resolve-muted-dim">{program.whyFund}</p>
                  {program.opportunityScorecard && (
                    <DiscoverOpportunityScoreChips
                      chips={program.opportunityScorecard.chips}
                      composite={program.opportunityScorecard.composite}
                      compact
                      className="mt-3"
                    />
                  )}
                </div>
                <div className="shrink-0 text-right text-xs">
                  {program.opportunityScorecard && (
                    <p className="mb-1 text-2xl font-semibold tabular-nums text-resolve-accent">
                      {program.opportunityScorecard.composite}
                    </p>
                  )}
                  <p className="text-[10px] uppercase text-resolve-muted-dim">
                    {program.metricKind === "match_leverage"
                      ? CAPITAL_YIELD_COPY.discover.qfLabel
                      : CAPITAL_YIELD_COPY.discover.fulfillmentLabel}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-300">
                    {program.yieldMultiplier > 0 ? `${program.yieldMultiplier.toFixed(2)}×` : "—"}
                  </p>
                  <p className="mt-1 text-resolve-muted">
                    <Money amount={program.fundingGapUsd} size="sm" className="inline" /> gap
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
                {signedIn ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-resolve-muted">$</span>
                      <input
                        type="number"
                        min={5}
                        step="0.01"
                        value={amountByProgram[program.programId] ?? "25"}
                        onChange={(e) =>
                          setAmountByProgram((prev) => ({
                            ...prev,
                            [program.programId]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const raw = amountByProgram[program.programId] ?? "25";
                          const n = Number(raw);
                          if (raw !== "" && Number.isFinite(n) && n < 5) {
                            toast.error("Amount can't be less than $5");
                          }
                        }}
                        className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={fundingId === program.programId || busy}
                      onClick={() => void fundRow(program)}
                    >
                      {fundingId === program.programId || busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        fundLabel
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-amber-200">
                      ${program.fundingGapUsd.toFixed(0)} gap
                    </span>
                    <Link
                      href={`/login?next=${encodeURIComponent(RETURN_URL)}`}
                      className="rounded-lg border border-resolve-accent/30 bg-resolve-accent/10 px-3 py-1.5 text-[11px] font-medium text-resolve-accent hover:bg-resolve-accent/15"
                    >
                      Sign in to fund
                    </Link>
                  </div>
                )}
                <Link
                  href={`/communities/${program.communitySlug}`}
                  className="text-[11px] text-resolve-muted hover:text-resolve-accent"
                >
                  {CAPITAL_YIELD_COPY.discover.viewCta} →
                </Link>
              </div>
            </li>
            );
          })}
        </ul>
          )}

          {exploreFiltered.length > 0 && (
            <div className={clsx(hasVerifiedPrograms && "mt-6 border-t border-white/[0.06] pt-5")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                {hasVerifiedPrograms ? "Attach to unlock" : "No ledger programs yet — attach a community"}
              </p>
              <p className="mt-1 text-[11px] text-resolve-muted-dim">
                Not on your ledger yet — attach once, then fund or launch a program. Ranked scores appear on Gaps after sensors sync.
              </p>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {exploreFiltered.map((o) => {
                  const installed = isCommunityInstalled(connections, o.communitySlug);
                  const actions = boardCommunityActions(role === "all" ? "funder" : role, {
                    communitySlug: o.communitySlug,
                    templateId: o.templateId,
                    needType: o.needType,
                    communityName: o.communityName,
                    installed,
                  });
                  return (
                    <li key={o.programId} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-white">{o.programName}</p>
                            <span
                              className={clsx(
                                "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase",
                                needTypeBadgeClass(o.needType),
                              )}
                            >
                              {needTypeLabel(o.needType)}
                            </span>
                            <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-200/90">
                              {isCommunityInstalled(connections, o.communitySlug) ? "Attached" : "Attach first"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-resolve-muted">{o.communityTagline}</p>
                          <p className="mt-2 text-xs leading-relaxed text-resolve-muted-dim">{o.whyFund}</p>
                          {o.fundingGapUsd > 0 && o.opportunityScorecard && (
                            <p className="mt-2 text-[11px] text-amber-200/80">
                              GitHub scan est. ${o.fundingGapUsd.toFixed(0)} — not ledger-verified
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {actions.map((action, index) => (
                          <DiscoverActionChip
                            key={action.id}
                            action={action}
                            signedIn={signedIn}
                            primary={index === 0}
                            surface="opportunity-board-explore"
                          />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </DiscoverPremiumSection>
  );
}
