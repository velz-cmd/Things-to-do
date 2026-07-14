"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { dedupeQueueWithTrending } from "@/lib/discover/queue-dedupe";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import type { DiscoverIntent } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";
import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { boardSubtitleForRole } from "@/lib/discover/board-actions-for-role";
import { DISCOVER_SECTION, LANE_PURPOSE } from "@/lib/discover/discover-lane-copy";
import {
  sortByOpportunityScore,
  type OpportunitySortKey,
} from "@/lib/discover/opportunity-score";
import { DiscoverAttachRail } from "@/components/resolve/discover/discover-attach-rail";
import { DiscoverBoardCommunityRow } from "@/components/resolve/discover/discover-board-community-row";
import { ValueReceiptCard } from "@/components/resolve/discover/value-receipt-card";
import { BOARD_MAX_ROWS } from "@/lib/discover/discover-row-limits";
import type { DiscoverWorkspaceLane } from "@/components/resolve/discover/discover-workspace-nav";
import styles from "./discover-workspace.module.css";
import { DiscoverFundingSkeleton } from "@/components/resolve/discover/discover-skeletons";

type DiscoverOpportunityQueueProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  needType?: DiscoverNeedTypeFilter;
  className?: string;
  onSwitchLane?: (lane: DiscoverWorkspaceLane) => void;
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
  onSwitchLane,
}: DiscoverOpportunityQueueProps) {
  const { executeFund, refreshWallet, busy, wallet } = useDiscoverActions();
  const { feed, refresh: refreshTrending } = useDiscoverRadarFeed();
  const [board, setBoard] = useState<DiscoverBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<OpportunitySortKey>("reward");
  const opportunitiesRef = useRef(board);
  opportunitiesRef.current = board;

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22_000);
    try {
      const res = await fetch("/api/capital/discover", { signal: controller.signal });
      if (!res.ok) throw new Error("Queue unavailable");
      const data = await res.json();
      const rows = data.board ?? data.opportunities ?? [];
      setBoard(rows);
      if (data.degraded && !rows.length) {
        setError("Board is still loading — try Refresh in a moment");
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      if (!opportunitiesRef.current.length) {
        const seedRes = await fetch("/api/communities").catch(() => null);
        const seedBody = seedRes?.ok ? await seedRes.json().catch(() => null) : null;
        const communities = (seedBody as { communities?: { slug: string; name: string; tagline: string }[] } | null)
          ?.communities;
        if (communities?.length) {
          setBoard(
            communities.slice(0, 5).map((c) => ({
              boardKind: "community" as const,
              programId: `community-${c.slug}`,
              programName: c.name,
              communitySlug: c.slug,
              communityName: c.name,
              communityTagline: c.tagline,
              templateId: "docs-bounty",
              templateLabel: "Program",
              fundingGapUsd: 0,
              whyFund: `${c.tagline} · set up to unlock ledger programs`,
              whoBenefits: c.name,
              score: 0,
              metricKind: "connect" as const,
              connectCta: `Set up ${c.name}`,
              connectHref: `/communities/${c.slug}`,
              needType: "funding" as const,
            })),
          );
        }
      }
      setError(aborted ? "Opportunity board timed out — showing attach rows" : "Could not load fulfillment queue");
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

  const boardProgramRows = useMemo(
    () => programFiltered.slice(0, BOARD_MAX_ROWS),
    [programFiltered],
  );

  const boardCommunityRows = useMemo(() => {
    const slotsLeft = Math.max(0, BOARD_MAX_ROWS - boardProgramRows.length);
    return exploreFiltered.slice(0, slotsLeft);
  }, [exploreFiltered, boardProgramRows.length]);

  async function fundRow(o: FundableOpportunity) {
    const raw = amountByProgram[o.programId] ?? "5";
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
      <span>
        {boardSubtitleForRole(role, signedIn, walletUsd)} · {LANE_PURPOSE.board}
      </span>
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
      title={DISCOVER_SECTION.fundingBoard}
      subtitle={subtitle}
      className={className}
      actions={<DiscoverSectionRefresh sectionId="opportunity-board" onRefresh={loadQueue} />}
    >
      {hasVerifiedPrograms && (
        <div className="mb-3 flex justify-end">
          <label className={styles.sortControl}>
            <span>Sort</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as OpportunitySortKey)}>
              <option value="reward">Funding need</option>
              <option value="urgency">Urgency</option>
              <option value="confidence">Readiness</option>
              <option value="impact">Impact</option>
              <option value="difficulty">Ease</option>
            </select>
          </label>
        </div>
      )}
      {loading && !board.length ? (
        <DiscoverFundingSkeleton />
      ) : error && !hasVerifiedPrograms && !exploreFiltered.length ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void loadQueue()} />
        </DiscoverStatePanel>
      ) : boardProgramRows.length === 0 && boardCommunityRows.length === 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <DiscoverAttachRail
            context="board"
            role={role}
            needType={needType}
            signedIn={signedIn}
          />
          <DiscoverStatePanel variant="empty" className="min-w-0 flex-1">
            <p className="text-sm text-resolve-muted">
              {query.trim()
                ? "No programs match your search."
                : "Set up a community on the left — ledger programs and fundable rows appear here."}
            </p>
            {onSwitchLane && !query.trim() && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchLane("gaps")}
                  className="rounded-lg border border-resolve-calm-blue/30 bg-resolve-calm-blue/10 px-4 py-2 text-sm font-medium text-resolve-calm-blue hover:bg-resolve-calm-blue/15"
                >
                  Browse unpaid value
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchLane("radars")}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-resolve-muted hover:text-white"
                >
                  View live signals
                </button>
              </div>
            )}
          </DiscoverStatePanel>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <DiscoverAttachRail
            context="board"
            role={role}
            needType={needType}
            signedIn={signedIn}
          />

          <div className="min-w-0 flex-1">
        <>
          {boardProgramRows.length > 0 && (
        <div className={styles.fundingQueue}>
          <div className={styles.fundingQueueHeader} aria-hidden="true">
            <span>Program</span>
            <span>Required</span>
            <span>Funded</span>
            <span>People / confidence</span>
            <span>Readiness</span>
            <span>Action</span>
          </div>
        <ul aria-label="Ready-to-fund programs">
          {boardProgramRows.map((o, index) => {
            const program = o as FundableOpportunity & { needType?: import("@/lib/discover/need-types").DiscoverNeedType };
            return (
            <li key={program.programId}>
              <ValueReceiptCard
                source={{ kind: "program", program }}
                signedIn={signedIn}
                role={role}
                surface="opportunity-board"
                lane="graph"
                rank={index + 1}
                fundAmountUsd={amountByProgram[program.programId] ?? "5"}
                onFundAmountChange={(value) =>
                  setAmountByProgram((prev) => ({ ...prev, [program.programId]: value }))
                }
                onFund={() => void fundRow(program)}
                fundingBusy={fundingId === program.programId || busy}
              />
            </li>
            );
          })}
        </ul>
        </div>
          )}

          {boardCommunityRows.length > 0 && (
            <div className={clsx(boardProgramRows.length > 0 && "mt-6 border-t border-white/[0.06] pt-5")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                {boardProgramRows.length > 0 ? "Unpaid value to act on" : "Set up communities"}
              </p>
              <ul className={styles.communityList}>
                {boardCommunityRows.map((o, index) => (
                  <DiscoverBoardCommunityRow
                    key={o.programId}
                    item={o}
                    signedIn={signedIn}
                    role={role}
                    rank={index + 1}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
          </div>
        </div>
      )}
    </DiscoverPremiumSection>
  );
}
