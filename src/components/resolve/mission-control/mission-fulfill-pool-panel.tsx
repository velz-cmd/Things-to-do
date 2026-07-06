"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import { PayFromWalletSection } from "@/components/resolve/fund/pay-from-wallet-section";
import { useFundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import { fundingSourceLabel } from "@/lib/wallet/funding-source";
import type { FundableOpportunity } from "@/lib/capital/community-yield";

type DiscoverPayload = {
  opportunities?: FundableOpportunity[];
};

/** Discover communal pools — fulfill (fund) only. Not personal pools. */
export function MissionFulfillPoolPanel({
  prompt,
  highlightSlug,
}: {
  prompt?: string;
  highlightSlug?: string | null;
}) {
  const [opportunities, setOpportunities] = useState<FundableOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/capital/discover");
      const data = (await res.json()) as DiscoverPayload;
      const rows = [...(data.opportunities ?? [])].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.signalCount - a.signalCount,
      );
      setOpportunities(rows);
      if (rows[0] && !activeProgramId) setActiveProgramId(rows[0].programId);
    } finally {
      setLoading(false);
    }
  }, [activeProgramId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    if (!highlightSlug) return opportunities;
    const match = opportunities.filter((o) => o.communitySlug === highlightSlug);
    const rest = opportunities.filter((o) => o.communitySlug !== highlightSlug);
    return [...match, ...rest];
  }, [opportunities, highlightSlug]);

  const activeAmount = activeProgramId
    ? Number(amountByProgram[activeProgramId] ?? "25")
    : 25;
  const walletChoice = useFundingWalletChoice(
    Number.isFinite(activeAmount) ? activeAmount : 25,
  );
  const { executeFund } = useFundProgramExecution();

  async function fulfill(program: FundableOpportunity) {
    const raw = amountByProgram[program.programId] ?? "25";
    const amountUsd = Number(raw);
    if (!Number.isFinite(amountUsd) || amountUsd < 5) {
      toast.error("Enter at least $5");
      return;
    }
    setFundingId(program.programId);
    setActiveProgramId(program.programId);
    try {
      const source = walletChoice.assertFundingSource();
      const result = await executeFund(
        {
          programId: program.programId,
          amountUsd,
          communitySlug: program.communitySlug,
          label: program.programName,
        },
        source,
      );
      toast.success(
        `${result.message} via ${fundingSourceLabel(result.fundingSource)}`,
      );
      void load();
      void walletChoice.spendable.refresh().catch(() => null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fulfill failed");
    } finally {
      setFundingId(null);
    }
  }

  return (
    <section
      className="rounded-2xl border border-sky-500/25 bg-[#0c1220]/90 p-4 sm:p-5"
      data-testid="mission-fulfill-pool-panel"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
        Fulfill pool
      </p>
      <h3 className="mt-1 text-base font-semibold text-white">
        Active Discover pools
      </h3>
      <p className="mt-2 text-sm text-resolve-muted">
        These are <span className="text-white/90">communal</span> community pools on Discover — shared
        by all funders, autopay at milestone. Mission can <span className="text-white/90">fulfill</span>{" "}
        (add USDC) only. For your own pool with custom batches, use{" "}
        <span className="text-violet-200">Personal pool</span>.
      </p>

      {prompt && (
        <p className="mt-3 border-l-2 border-white/10 pl-3 text-xs text-resolve-muted-dim">
          {prompt}
        </p>
      )}

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-resolve-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading active pools…
        </p>
      ) : !sorted.length ? (
        <p className="mt-4 text-sm text-resolve-muted">
          No active programs yet.{" "}
          <Link href="/discover" className="text-resolve-accent hover:underline">
            Browse Discover
          </Link>
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.slice(0, 8).map((o, index) => (
            <li
              key={o.programId}
              className="rounded-xl border border-white/[0.08] bg-black/20 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {index === 0 && (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-sky-300">
                        Most active
                      </span>
                    )}
                    <p className="text-sm font-medium text-white">{o.programName}</p>
                    <span className="text-[10px] text-resolve-muted">{o.communityName}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-resolve-muted-dim">{o.whyFund}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-[10px] uppercase text-resolve-muted-dim">Pool</p>
                  <Money amount={o.budgetUsd} size="sm" className="text-white" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                <span className="text-[11px] text-resolve-muted">$</span>
                <input
                  type="number"
                  min={5}
                  step="1"
                  value={amountByProgram[o.programId] ?? "25"}
                  onChange={(e) => {
                    setAmountByProgram((prev) => ({
                      ...prev,
                      [o.programId]: e.target.value,
                    }));
                    setActiveProgramId(o.programId);
                  }}
                  onFocus={() => setActiveProgramId(o.programId)}
                  className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                />
                {activeProgramId === o.programId && (
                  <PayFromWalletSection
                    amountUsd={Number(amountByProgram[o.programId] ?? "25") || 25}
                    disabled={fundingId === o.programId}
                    choice={walletChoice}
                    className="w-full basis-full"
                  />
                )}
                <Button
                  size="sm"
                  disabled={fundingId === o.programId}
                  onClick={() => void fulfill(o)}
                >
                  {fundingId === o.programId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Fulfill pool
                    </>
                  )}
                </Button>
                <Link
                  href={`/discover?community=${encodeURIComponent(o.communitySlug)}`}
                  className="inline-flex items-center gap-1 text-[10px] text-resolve-accent hover:underline"
                >
                  On Discover
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
