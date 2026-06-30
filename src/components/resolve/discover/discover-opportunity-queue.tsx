"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, TrendingUp } from "lucide-react";
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
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";

type WalletResponse = {
  ok?: boolean;
  balance?: { spendableUsd?: string };
};

type DiscoverOpportunityQueueProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  className?: string;
};

const RETURN_URL = "/discover#opportunities";

/** Discover-native fulfillment queue — deduped from trending, inline fund refreshes gaps. */
export function DiscoverOpportunityQueue({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  className,
}: DiscoverOpportunityQueueProps) {
  const { executeFund, refreshWallet, busy } = useDiscoverActions();
  const { feed, refresh: refreshTrending } = useDiscoverRadarFeed();
  const [board, setBoard] = useState<DiscoverBoardItem[]>([]);
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});
  const opportunitiesRef = useRef(board);
  opportunitiesRef.current = board;

  const showQueue =
    sectionVisibleForRole("opportunities", role) &&
    (role === "all" || role === "funder" || role === "founder" || role === "dao" || intent === "fund" || intent === "sponsor");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/capital/discover");
      if (!res.ok) throw new Error("Queue unavailable");
      const data = await res.json();
      setBoard(data.board ?? data.opportunities ?? []);
    } catch {
      setError("Could not load fulfillment queue");
      discoverFetchErrorToast(
        "discover-queue",
        "Fulfillment queue unavailable",
        () => void loadQueue(),
        Boolean(opportunitiesRef.current.length),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    if (!signedIn) {
      setWalletUsd(null);
      return;
    }
    try {
      const res = await fetch("/api/capital/wallet", { credentials: "include" });
      const data = (await res.json()) as WalletResponse;
      if (data.ok !== false && data.balance?.spendableUsd != null) {
        setWalletUsd(Number(data.balance.spendableUsd));
      }
    } catch {
      setWalletUsd(null);
    }
  }, [signedIn]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

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

  const combined = useMemo(() => [...deduped.map((p) => ({ ...p, boardKind: "program" as const })), ...communityItems], [deduped, communityItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return combined;
    return combined.filter(
      (o) =>
        o.programName.toLowerCase().includes(q) ||
        o.communityName.toLowerCase().includes(q) ||
        o.communitySlug.toLowerCase().includes(q) ||
        o.whyFund.toLowerCase().includes(q),
    );
  }, [combined, query]);

  async function fundRow(o: FundableOpportunity) {
    const raw = amountByProgram[o.programId] ?? "25";
    const amountUsd = Number(raw);
    if (!Number.isFinite(amountUsd) || amountUsd < 5) return;
    setFundingId(o.programId);
    try {
      await executeFund({
        programId: o.programId,
        amountUsd,
        label: o.programName,
        communitySlug: o.communitySlug,
        templateId: o.templateId,
      });
      await Promise.all([loadQueue(), loadWallet(), refreshWallet(), refreshTrending()]);
    } catch {
      /* toast handled in provider */
    } finally {
      setFundingId(null);
    }
  }

  function scrollToCommunities() {
    document.getElementById("communities")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section id="opportunities" className={className} hidden={!showQueue}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-resolve-accent" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              Opportunity board
            </p>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">Every community opportunity</h2>
          <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
            Funded programs plus connect/install paths — refresh when you want updated gaps.
          </p>
          {signedIn && walletUsd != null && (
            <p className="mt-1 text-[11px] text-resolve-muted-dim">
              Funder wallet:{" "}
              <span className="font-medium text-emerald-300">${walletUsd.toFixed(2)}</span> spendable
            </p>
          )}
        </div>
        <DiscoverSectionRefresh sectionId="opportunity-board" onRefresh={loadQueue} />
      </div>

      {loading && !board.length ? (
        <DiscoverStatePanel variant="loading">
          <div className="flex items-center justify-center gap-2 text-sm text-resolve-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading programs…
          </div>
        </DiscoverStatePanel>
      ) : error && !filtered.length ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void loadQueue()} />
        </DiscoverStatePanel>
      ) : !filtered.length ? (
        <DiscoverStatePanel variant="empty">
          <p className="text-sm text-resolve-muted">
            {query.trim()
              ? "No programs match your search."
              : "No opportunities yet — connect GitHub, Jellyfin, or ListenBrainz to seed real value."}
          </p>
          {!query.trim() && (
            <button
              type="button"
              onClick={scrollToCommunities}
              className="mt-4 inline-flex rounded-lg border border-resolve-calm-blue/30 bg-resolve-calm-blue/10 px-4 py-2 text-sm font-medium text-resolve-calm-blue hover:bg-resolve-calm-blue/15"
            >
              Connect a community
            </button>
          )}
        </DiscoverStatePanel>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => {
            if (o.boardKind === "community") {
              return (
                <li
                  key={o.programId}
                  className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">{o.programName}</p>
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-blue-300">
                          {o.templateLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-resolve-muted">{o.communityTagline}</p>
                      <p className="mt-2 text-xs leading-relaxed text-resolve-muted-dim">{o.whyFund}</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-amber-200/80">
                      Est. ${o.fundingGapUsd.toFixed(0)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                    <Link
                      href={o.connectHref}
                      className="rounded-lg border border-resolve-accent/30 bg-resolve-accent/10 px-3 py-1.5 text-[11px] font-medium text-resolve-accent hover:bg-resolve-accent/15"
                    >
                      {o.connectCta}
                    </Link>
                  </div>
                </li>
              );
            }

            const program = o as FundableOpportunity;
            return (
            <li
              key={program.programId}
              className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{program.programName}</p>
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
                </div>
                <div className="shrink-0 text-right text-xs">
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
                        step={5}
                        value={amountByProgram[program.programId] ?? "25"}
                        onChange={(e) =>
                          setAmountByProgram((prev) => ({
                            ...prev,
                            [program.programId]: e.target.value,
                          }))
                        }
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
                      ) : program.templateId === "quadratic-funding" ? (
                        CAPITAL_YIELD_COPY.discover.fundCta
                      ) : (
                        CAPITAL_YIELD_COPY.discover.fundFulfillCta
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
    </section>
  );
}
