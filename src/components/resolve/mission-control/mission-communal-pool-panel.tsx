"use client";

import Link from "next/link";
import { Loader2, Zap } from "lucide-react";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";
import { Money } from "@/components/resolve/ui/money";
import { useProgramPoolState } from "@/components/resolve/communities/pool-checkpoint-panel";

/** Read-only communal pool — autopay at milestone; fund on Discover only. */
export function MissionCommunalPoolPanel({
  communitySlug,
  prompt,
}: {
  communitySlug: string;
  prompt?: string;
}) {
  const { pool, loading } = useProgramPoolState(communitySlug, null, { scope: "community" });
  const poolUsd = pool?.poolBalanceUsd ?? 0;
  const milestoneUsd = pool?.activeMilestoneUsd ?? pool?.nextCheckpointUsd ?? 500;

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/90 p-4 sm:p-5"
      data-testid="mission-communal-pool-panel"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
        Communal pool · read-only
      </p>
      <h3 className="mt-1 text-base font-semibold capitalize text-white">
        {communitySlug.replace(/-/g, " ")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-resolve-muted">
        This is the <span className="text-white/90">network pool</span> — shared by all funders. No one
        person allocates it. When the milestone is reached,{" "}
        <span className="text-emerald-200">payouts run automatically</span> from the authorization
        ledger.
      </p>

      {prompt && (
        <p className="mt-3 border-l-2 border-white/10 pl-3 text-xs text-resolve-muted-dim">
          {prompt}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3">
        <p className="flex items-center gap-2 text-xs font-medium text-emerald-100">
          <Zap className="h-3.5 w-3.5 shrink-0" />
          Autopay at checkpoint — no manual settle
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted">
          Add USDC on Discover. The system batches payees when the pool clears the milestone.
        </p>
      </div>

      {loading && !pool ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-resolve-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading pool…
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Pool balance</p>
              <Money amount={poolUsd} size="sm" className="text-lg text-white" />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Milestone</p>
              <Money amount={milestoneUsd} size="sm" className="text-white" />
            </div>
          </div>
          <PoolMilestoneBar poolUsd={poolUsd} compact />
          {pool?.nextBatchPayees && pool.nextBatchPayees.length > 0 && (
            <p className="text-[11px] text-resolve-muted">
              Next autopay batch: {pool.nextBatchPayees.length} payee
              {pool.nextBatchPayees.length === 1 ? "" : "s"} queued from ledger
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/discover?community=${encodeURIComponent(communitySlug)}&intent=fund`}
          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
        >
          Add funds on Discover
        </Link>
        <Link
          href={`/capital?tab=activity&community=${encodeURIComponent(communitySlug)}`}
          className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm text-resolve-muted transition hover:text-white"
        >
          Your stake in Capital
        </Link>
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-resolve-muted-dim">
        Custom batch payouts for your community (PDF + Arc memo) → use{" "}
        <span className="text-white/80">Batch payout</span> in Mission, not this pool.
      </p>
    </section>
  );
}
