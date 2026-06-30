"use client";

import clsx from "clsx";
import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import { useDiscoverActions } from "@/components/resolve/discover/use-discover-actions";

const ACTION_STYLES: Record<string, string> = {
  fund: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  install: "border-resolve-accent/30 bg-resolve-accent/10 text-resolve-accent hover:bg-resolve-accent/20",
  claim: "border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
  create_program: "border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20",
  default: "border-white/10 bg-white/[0.04] text-resolve-muted hover:text-white hover:bg-white/[0.08]",
};

type DiscoverActionCardProps = {
  gap: TrendingValueGap;
  signedIn: boolean;
  rank?: number;
  compact?: boolean;
};

export function DiscoverActionCard({ gap, signedIn, rank, compact }: DiscoverActionCardProps) {
  const { runAction } = useDiscoverActions(signedIn);

  return (
    <article
      className={clsx(
        "rounded-xl border border-white/[0.08] bg-[#0a0f18]/70",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null && (
              <span className="text-[10px] font-semibold tabular-nums text-resolve-muted-dim">
                #{rank}
              </span>
            )}
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase text-resolve-muted">
              {gap.domain}
            </span>
          </div>
          <h3 className={clsx("mt-1 font-medium text-white", compact ? "text-sm" : "text-base")}>
            {gap.headline}
          </h3>
          {!compact && (
            <>
              <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{gap.why}</p>
              <p className="mt-1 text-[11px] text-resolve-muted-dim">{gap.whoBenefits}</p>
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          {gap.amountNeededUsd > 0 && (
            <p className="text-lg font-semibold tabular-nums text-amber-200">
              ${gap.amountNeededUsd.toFixed(0)}
            </p>
          )}
          {gap.moneyCanMoveUsd > 0 && gap.moneyCanMoveUsd !== gap.amountNeededUsd && (
            <p className="text-[10px] text-emerald-300/80">
              ${gap.moneyCanMoveUsd.toFixed(0)} can move
            </p>
          )}
          {gap.peopleImpacted > 0 && (
            <p className="mt-1 text-[10px] text-resolve-muted">
              {gap.peopleImpacted} impacted
            </p>
          )}
        </div>
      </div>

      {!compact && (
        <p className="mt-3 text-[10px] text-resolve-muted-dim">
          Proof: {gap.proofSource}
        </p>
      )}

      <div className={clsx("flex flex-wrap gap-2", compact ? "mt-2" : "mt-4")}>
        {gap.actions.map((action) => (
          <ActionChip
            key={action.id}
            action={action}
            onClick={() => void runAction(action)}
          />
        ))}
      </div>
    </article>
  );
}

function ActionChip({ action, onClick }: { action: DiscoverAction; onClick: () => void }) {
  const style = ACTION_STYLES[action.kind] ?? ACTION_STYLES.default;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
        style,
      )}
    >
      {action.label}
    </button>
  );
}

export function DiscoverActionChip({
  action,
  signedIn,
  primary,
}: {
  action: DiscoverAction;
  signedIn: boolean;
  primary?: boolean;
}) {
  const { runAction } = useDiscoverActions(signedIn);
  const style = primary
    ? ACTION_STYLES[action.kind] ?? ACTION_STYLES.fund
    : ACTION_STYLES.default;

  return (
    <button
      type="button"
      onClick={() => void runAction(action)}
      className={clsx(
        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
        style,
      )}
    >
      {action.label}
    </button>
  );
}
