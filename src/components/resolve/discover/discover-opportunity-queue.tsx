"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import { CAPITAL_YIELD_COPY } from "@/lib/capital/copy";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import type { FundableOpportunity } from "@/lib/capital/community-yield";

type DiscoverOpportunityQueueProps = {
  signedIn: boolean;
  query?: string;
  className?: string;
};

/** Discover-native fulfillment queue — inline fund via unified action router. */
export function DiscoverOpportunityQueue({
  signedIn,
  query = "",
  className,
}: DiscoverOpportunityQueueProps) {
  const { executeFund, wallet, busy } = useDiscoverActions();
  const [opportunities, setOpportunities] = useState<FundableOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/capital/discover");
      const data = await res.json();
      setOpportunities(data.opportunities ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opportunities;
    return opportunities.filter(
      (o) =>
        o.programName.toLowerCase().includes(q) ||
        o.communityName.toLowerCase().includes(q) ||
        o.communitySlug.toLowerCase().includes(q) ||
        o.whyFund.toLowerCase().includes(q),
    );
  }, [opportunities, query]);

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
      void load();
    } catch {
      /* toast handled in provider */
    } finally {
      setFundingId(null);
    }
  }

  return (
    <section id="opportunities" className={className}>
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
            Ranked by pending obligations — fulfill in place. Portfolio and wallet live in Capital.
          </p>
          {signedIn && wallet.loaded && (
            <p className="mt-1 text-[11px] text-resolve-muted-dim">
              Wallet spendable: ${wallet.spendableUsd.toFixed(2)}
            </p>
          )}
        </div>
        <Link
          href="/capital?tab=programs"
          className="text-xs text-resolve-accent hover:underline"
        >
          Your portfolio →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 px-5 py-8 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading programs…
        </div>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 px-5 py-8 text-center">
          <p className="text-sm text-resolve-muted">
            {query.trim()
              ? "No programs match your search."
              : "No active programs yet — install a community below to seed the first obligation queue."}
          </p>
          {!query.trim() && (
            <a
              href="#communities"
              className="mt-3 inline-block text-xs font-medium text-resolve-accent hover:underline"
            >
              Browse communities →
            </a>
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
                    <Money amount={o.impactValueUsd} size="sm" className="inline" /> impact
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
                  <Link
                    href="/login?next=/discover"
                    className="text-[11px] font-medium text-resolve-accent hover:underline"
                  >
                    Sign in to fund
                  </Link>
                )}
                <Link
                  href={`/communities/${o.communitySlug}`}
                  className="inline-flex items-center gap-1 text-[11px] text-resolve-muted hover:text-resolve-accent"
                >
                  {CAPITAL_YIELD_COPY.discover.viewCta}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
