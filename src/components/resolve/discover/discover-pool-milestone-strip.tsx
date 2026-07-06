"use client";

import { useMemo } from "react";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";
import { useMyPoolStakes } from "@/hooks/use-my-pool-stakes";
import { computePoolMilestoneSegment } from "@/lib/capital/pool-milestone-progress";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";

/** Shared pool milestone progress across Discover workspace lanes. */
export function DiscoverPoolMilestoneStrip({ signedIn }: { signedIn: boolean }) {
  const { data } = useMyPoolStakes();

  const totalPoolUsd = useMemo(() => {
    const stakes = data?.stakes ?? [];
    return stakes.reduce((s, row) => s + row.totalPrincipalUsd, 0);
  }, [data?.stakes]);

  const segment = computePoolMilestoneSegment(totalPoolUsd);

  if (!signedIn && totalPoolUsd <= 0) return null;

  return (
    <DiscoverCapitalCard className="discover-pool-milestone-strip" padding hover={false}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-1 pb-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
            Pool progress
          </p>
          <p className="mt-0.5 text-[11px] text-resolve-muted">
            {totalPoolUsd > 0
              ? "Real USDC in active program pools · advances at each milestone"
              : "Fulfill a pool to start the $500 → $2.5k milestone ladder"}
          </p>
        </div>
        {totalPoolUsd > 0 && (
          <p className="text-right text-[11px] tabular-nums text-emerald-300">
            ${totalPoolUsd.toFixed(2)} deposited
          </p>
        )}
      </div>
      <PoolMilestoneBar poolUsd={totalPoolUsd} segment={segment} compact />
    </DiscoverCapitalCard>
  );
}
