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
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";

type WalletResponse = {
  ok?: boolean;
  balance?: { spendableUsd?: string };
};

type DiscoverOpportunityQueueProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  className?: string;
};

const RETURN_URL = "/discover#opportunities";

/** Discover-native fulfillment queue — deduped from trending, inline fund refreshes gaps. */
export function DiscoverOpportunityQueue({
  signedIn,
  query = "",
  intent = "all",
  className,
}: DiscoverOpportunityQueueProps) {
  const { executeFund, refreshWallet, busy } = useDiscoverActions();
  const { feed, refresh: refreshTrending } = useDiscoverRadarFeed();
  const [opportunities, setOpportunities] = useState<FundableOpportunity[]>([]);
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});
  const opportunitiesRef = useRef(opportunities);
  opportunitiesRef.current = opportunities;

  const showQueue = intent === "all" || intent === "fund" || intent === "sponsor";

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/capital/discover");
      if (!res.ok) throw new Error("Queue unavailable");
      const data = await res.json();
      setOpportunities(data.opportunities ?? []);
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

  const deduped = useMemo(
    () => dedupeQueueWithTrending(opportunities, feed?.gaps ?? []),
    [opportunities, feed?.gaps],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deduped;
    return deduped.filter(
      (o) =>
        o.programName.toLowerCase().includes(q) ||
        o.communityName.toLowerCase().includes(q) ||
        o.communitySlug.toLowerCase().includes(q) ||
        o.whyFund.toLowerCase().includes(q),
    );
  }, [deduped, query]);

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
              Fulfillment queue
            </p>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">Fund where capital unlocks value</h2>
          <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
            Programs with pending obligations not already in trending — fulfill in place.
          </p>
          {signedIn && walletUsd != null && (
            <p className="mt-1 text-[11px] text-resolve-muted-dim">
              Funder wallet:{" "}
              <span className="font-medium text-emerald-300">${walletUsd.toFixed(2)}</span> spendable
            </p>
          )}
        </div>
      </div>

      {loading && !opportunities.length ? (
        <div className="flex items-center gap-2 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 px-5 py-8 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading programs…
        </div>
      ) : error && !filtered.length ? (
        <div className="rounded-xl border border-dashed border-rose-500/30 bg-rose-500/[0.04] px-5 py-8 text-center">
          <p className="text-sm text-resolve-muted">{error}</p>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="mt-3 text-xs font-medium text-resolve-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 px-5 py-8 text-center">
          <p className="text-sm text-resolve-muted">
            {query.trim()
              ? "No programs match your search."
              : "No programs in the fulfillment queue — install a community to seed the first obligation."}
          </p>
          {!query.trim() && (
            <button
              type="button"
              onClick={scrollToCommunities}
              className="mt-4 inline-flex rounded-lg border border-resolve-accent/30 bg-resolve-accent/10 px-4 py-2 text-sm font-medium text-resolve-accent hover:bg-resolve-accent/15"
            >
              Install community
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.slice(0, 8).map((o) => (
            <li
              key={o.programId}
              className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{o.programName}</p>
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-violet-300">
                      {o.templateLabel}
                    </span>
                    <DiscoverSourceBadge source="supabase_ledger" />
                    {o.yieldMultiplier >= o.targetMultiplier && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-300">
                        {CAPITAL_YIELD_COPY.discover.targetBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-resolve-muted">
                    {o.communityName} — {o.communityTagline}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-resolve-muted-dim">{o.whyFund}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="text-[10px] uppercase text-resolve-muted-dim">
                    {o.metricKind === "match_leverage"
                      ? CAPITAL_YIELD_COPY.discover.qfLabel
                      : CAPITAL_YIELD_COPY.discover.fulfillmentLabel}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-300">
                    {o.yieldMultiplier > 0 ? `${o.yieldMultiplier.toFixed(2)}×` : "—"}
                  </p>
                  <p className="mt-1 text-resolve-muted">
                    <Money amount={o.fundingGapUsd} size="sm" className="inline" /> gap
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
                        value={amountByProgram[o.programId] ?? "25"}
                        onChange={(e) =>
                          setAmountByProgram((prev) => ({
                            ...prev,
                            [o.programId]: e.target.value,
                          }))
                        }
                        className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={fundingId === o.programId || busy}
                      onClick={() => void fundRow(o)}
                    >
                      {fundingId === o.programId || busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : o.templateId === "quadratic-funding" ? (
                        CAPITAL_YIELD_COPY.discover.fundCta
                      ) : (
                        CAPITAL_YIELD_COPY.discover.fundFulfillCta
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-amber-200">
                      ${o.fundingGapUsd.toFixed(0)} gap
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
                  href={`/communities/${o.communitySlug}`}
                  className="text-[11px] text-resolve-muted hover:text-resolve-accent"
                >
                  {CAPITAL_YIELD_COPY.discover.viewCta} →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
