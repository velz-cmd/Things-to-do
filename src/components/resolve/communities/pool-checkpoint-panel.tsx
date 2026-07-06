"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Flag, Loader2, Users, Wallet } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import {
  CAPITAL_REFRESH_EVENT,
  POOL_REFRESH_EVENT,
  type CapitalRefreshDetail,
} from "@/lib/capital/refresh-events";
import { FUND_ACTION_RECORDED_EVENT, type StoredFundAction } from "@/lib/capital/fund-action-store";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";

const poolCache = new Map<string, ProgramPoolState>();

function poolCacheKey(communitySlug: string, programId: string | null, templateId?: string | null) {
  return `${communitySlug}:${programId ?? ""}:${templateId ?? ""}`;
}

type PoolCheckpointPanelProps = {
  communitySlug: string;
  programId: string;
  compact?: boolean;
  className?: string;
};

export function useProgramPoolState(
  communitySlug: string,
  programId: string | null,
  options?: { templateId?: string | null },
) {
  const [pool, setPool] = useState<ProgramPoolState | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvedProgramId, setResolvedProgramId] = useState<string | null>(programId);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setResolvedProgramId(programId);
  }, [programId]);

  useEffect(() => {
    if (!communitySlug) return;
    const key = poolCacheKey(communitySlug, programId, options?.templateId);
    const cached = poolCache.get(key);
    if (cached) {
      setPool(cached);
    }
  }, [communitySlug, programId, options?.templateId]);

  const refresh = useCallback(async () => {
    if (!communitySlug) return;
    const key = poolCacheKey(communitySlug, programId, options?.templateId);
    const hasCache = poolCache.has(key);
    if (!hasCache) setLoading(true);
    try {
      if (programId) {
        const res = await fetch(
          `/api/communities/${encodeURIComponent(communitySlug)}/programs/${programId}/pool`,
          { credentials: "include", cache: "default" },
        );
        if (res.ok) {
          const data = await res.json();
          const next = data.pool ?? null;
          if (mountedRef.current) {
            setPool(next);
            setResolvedProgramId(programId);
          }
          if (next) poolCache.set(key, next);
        }
        return;
      }

      const qs = options?.templateId
        ? `?templateId=${encodeURIComponent(options.templateId)}`
        : "";
      const res = await fetch(
        `/api/communities/${encodeURIComponent(communitySlug)}/pool${qs}`,
        { credentials: "include", cache: "default" },
      );
      if (res.ok) {
        const data = await res.json();
        const next = data.pool ?? null;
        if (mountedRef.current) {
          setPool(next);
          setResolvedProgramId(data.programId ?? null);
        }
        if (next) poolCache.set(key, next);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [communitySlug, programId, options?.templateId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!programId) return;

    const shouldRefresh = (eventProgramId?: string) =>
      !eventProgramId || eventProgramId === programId;

    const onPoolRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ programId?: string }>).detail;
      if (shouldRefresh(detail?.programId)) void refresh();
    };

    const onCapitalRefresh = (event: Event) => {
      const detail = (event as CustomEvent<CapitalRefreshDetail>).detail;
      if (shouldRefresh(detail?.programId)) void refresh();
    };

    const onFundRecorded = (event: Event) => {
      const action = (event as CustomEvent<StoredFundAction>).detail;
      if (action?.programId && shouldRefresh(action.programId)) void refresh();
    };

    window.addEventListener(POOL_REFRESH_EVENT, onPoolRefresh);
    window.addEventListener(CAPITAL_REFRESH_EVENT, onCapitalRefresh);
    window.addEventListener(FUND_ACTION_RECORDED_EVENT, onFundRecorded);
    return () => {
      window.removeEventListener(POOL_REFRESH_EVENT, onPoolRefresh);
      window.removeEventListener(CAPITAL_REFRESH_EVENT, onCapitalRefresh);
      window.removeEventListener(FUND_ACTION_RECORDED_EVENT, onFundRecorded);
    };
  }, [programId, refresh]);

  return { pool, loading, refresh, resolvedProgramId };
}

function formatUsd(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PoolCheckpointPanel({
  communitySlug,
  programId,
  compact = false,
  className,
}: PoolCheckpointPanelProps) {
  const { pool, loading, refresh } = useProgramPoolState(communitySlug, programId);
  const [settling, setSettling] = useState(false);

  async function runCheckpointBatch() {
    setSettling(true);
    try {
      const res = await fetch(
        `/api/communities/${encodeURIComponent(communitySlug)}/programs/${programId}/checkpoint-settle`,
        { method: "POST", credentials: "include" },
      );
      await res.json();
      await refresh();
    } finally {
      setSettling(false);
    }
  }

  if (loading && !pool) {
    return (
      <div className={clsx("flex items-center gap-2 text-xs text-resolve-muted", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading pool…
      </div>
    );
  }

  if (!pool) return null;

  const readyCheckpoint = pool.checkpoints.find((c) => c.status === "reached");
  const canBatch =
    pool.owedToCreatorsUsd > 0 &&
    pool.availableUsd >= pool.owedToCreatorsUsd &&
    readyCheckpoint != null;

  return (
    <div
      id="pool-checkpoints"
      className={clsx(
        "scroll-mt-24 rounded-xl border border-white/[0.08] bg-black/25",
        compact ? "p-3 space-y-3" : "p-4 space-y-4",
        className,
      )}
      data-testid="pool-checkpoint-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-resolve-accent">
            Pool balance
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">
            ${formatUsd(pool.poolBalanceUsd)}
          </p>
          <p className="mt-0.5 text-[11px] text-resolve-muted">
            Real USDC deposited · {pool.funderCount} funder{pool.funderCount === 1 ? "" : "s"}
          </p>
        </div>
        {!compact && (
          <div className="text-right text-[11px] text-resolve-muted">
            <p>
              Owed to {pool.payeeCategory}:{" "}
              <span className="font-medium text-amber-100">
                ${formatUsd(pool.owedToCreatorsUsd)}
              </span>
            </p>
            <p className="mt-0.5">
              Settled:{" "}
              <span className="text-emerald-300">${formatUsd(pool.settledUsd)}</span>
            </p>
          </div>
        )}
      </div>

      {pool.funder.yourDepositUsd > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-resolve-muted">
              <Wallet className="h-3 w-3" />
              Your deposit
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              ${formatUsd(pool.funder.yourDepositUsd)}
            </p>
            <p className="text-[10px] text-resolve-muted-dim">
              {pool.funder.yourSharePct.toFixed(1)}% of pool
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-amber-500/25 bg-amber-500/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/80">
              Est. share of owed
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-100">
              ${formatUsd(pool.funder.estimatedShareOfOwedUsd)}
            </p>
            <p className="text-[10px] text-resolve-muted-dim">Projection · not guaranteed</p>
          </div>
          <div className="rounded-lg border border-dashed border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-violet-200/80">
              Projected impact
            </p>
            <p className="mt-1 text-sm font-semibold text-violet-100">
              ${formatUsd(pool.funder.projectedImpactUsd)}
            </p>
            <p className="text-[10px] text-resolve-muted-dim">Model · if pool fulfills</p>
          </div>
        </div>
      )}

      <PoolMilestoneBar poolUsd={pool.poolBalanceUsd} compact={compact} />

      {pool.nextBatchPayees.length > 0 && (
        <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted">
            Next ${formatUsd(pool.activeMilestoneUsd)} batch
          </p>
          <p className="text-[11px] text-resolve-muted-dim">
            {pool.nextBatchPayees.length} {pool.payeeCategory} · $
            {formatUsd(pool.nextBatchTotalUsd)} owed when checkpoint clears
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {pool.nextBatchPayees.map((payee) => (
              <li
                key={`${payee.payeeKeyType}:${payee.payeeKey}`}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-white">{payee.label}</span>
                <Money amount={payee.owedUsd} size="sm" className="shrink-0 text-amber-100" />
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-resolve-muted-dim">
            Variable per eligibility — minimum blocks earn ~$10; stronger signals earn more.
            After ${formatUsd(pool.activeMilestoneUsd)} distributes, the pool advances toward $
            {pool.activeMilestoneUsd >= 500 && pool.activeMilestoneUsd < 2500 ? "2,500" : "next"}.
          </p>
        </div>
      )}

      <ol className="flex flex-wrap gap-2">
        {pool.checkpoints.slice(0, compact ? 6 : 10).map((cp) => (
          <li
            key={cp.thresholdUsd}
            className={clsx(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              cp.status === "paid" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
              cp.status === "reached" && "border-resolve-accent/40 bg-resolve-accent/10 text-resolve-accent",
              cp.status === "active" && "border-white/15 text-white",
              cp.status === "locked" && "border-white/5 text-resolve-muted-dim",
            )}
          >
            {cp.status === "paid" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Flag className="h-3 w-3" />
            )}
            ${cp.thresholdUsd >= 1000 ? `${cp.thresholdUsd / 1000}k` : cp.thresholdUsd}
            {cp.paidUsd != null && cp.paidUsd > 0 && (
              <span className="text-resolve-muted-dim">· ${formatUsd(cp.paidUsd)}</span>
            )}
          </li>
        ))}
      </ol>

      {pool.recentBatches.length > 0 && !compact && (
        <div className="space-y-1 border-t border-white/[0.06] pt-3">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">
            Recent batches
          </p>
          {pool.recentBatches.map((b) => (
            <p key={b.id} className="flex items-center gap-2 text-[11px] text-resolve-muted">
              <Users className="h-3 w-3 shrink-0" />
              <Money amount={b.settledUsd} size="sm" className="inline text-white" />
              <span>→ {b.payeeCount} {pool.payeeCategory}</span>
              {b.checkpointThresholdUsd != null && (
                <span className="text-resolve-muted-dim">
                  @ ${formatUsd(b.checkpointThresholdUsd)} checkpoint
                </span>
              )}
            </p>
          ))}
        </div>
      )}

      {canBatch && (
        <Button size="sm" variant="secondary" disabled={settling} onClick={() => void runCheckpointBatch()}>
          {settling ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Paying batch…
            </>
          ) : (
            <>
              Pay ${formatUsd(pool.owedToCreatorsUsd)} to {pool.payeeCategory} at checkpoint
            </>
          )}
        </Button>
      )}
    </div>
  );
}
