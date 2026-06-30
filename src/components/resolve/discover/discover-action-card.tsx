"use client";

import { useEffect } from "react";
import clsx from "clsx";
import type { DiscoverAction, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { filterActionsByIntent } from "@/lib/discover/intent-filters";

const ACTION_STYLES: Record<string, string> = {
  fund: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  install: "border-resolve-accent/30 bg-resolve-accent/10 text-resolve-accent hover:bg-resolve-accent/20",
  claim: "border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
  create_program: "border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20",
  sponsor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  default: "border-white/10 bg-white/[0.04] text-resolve-muted hover:text-white hover:bg-white/[0.08]",
};

type DiscoverActionCardProps = {
  gap: TrendingValueGap;
  signedIn: boolean;
  intent?: DiscoverIntent;
  rank?: number;
  compact?: boolean;
  surface?: string;
};

export function DiscoverActionCard({
  gap,
  signedIn: _signedIn,
  intent = "all",
  rank,
  compact,
  surface = "action-card",
}: DiscoverActionCardProps) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const actions = filterActionsByIntent(gap.actions, intent);
  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );
  const movable = formatDiscoverMoney(
    gap.moneyCanMoveUsd,
    gap.amountVerified && gap.moneyCanMoveUsd > 0,
    gap.dataSource,
    gap.amountKind,
  );

  useEffect(() => {
    for (const action of actions) {
      registerVisibleAction(surface, action);
    }
  }, [actions, registerVisibleAction, surface]);

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
            <DiscoverSourceBadge
              source={gap.dataSource}
              estimate={!gap.amountVerified && Boolean(gap.proofGithubScanAt)}
            />
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
          <p
            className={clsx(
              "text-lg font-semibold tabular-nums",
              needed.tone === "verified"
                ? "text-amber-200"
                : needed.tone === "estimate"
                  ? "text-amber-200/70"
                  : "text-resolve-muted",
            )}
          >
            {needed.label}
          </p>
          {gap.amountVerified &&
            gap.moneyCanMoveUsd > 0 &&
            gap.moneyCanMoveUsd !== gap.amountNeededUsd && (
              <p
                className={clsx(
                  "text-[10px]",
                  movable.tone === "verified" ? "text-emerald-300/80" : "text-resolve-muted",
                )}
              >
                {movable.label} can move
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
          {gap.proofAuthorizationId ? ` · auth ${gap.proofAuthorizationId.slice(0, 8)}` : ""}
          {gap.proofGithubScanAt && !gap.proofAuthorizationId
            ? ` · scanned ${new Date(gap.proofGithubScanAt).toLocaleString()}`
            : ""}
          {gap.proofHref ? (
            <>
              {" "}
              ·{" "}
              <a href={gap.proofHref} className="text-resolve-accent hover:underline">
                View proof
              </a>
            </>
          ) : null}
        </p>
      )}

      <div className={clsx("flex flex-wrap gap-2", compact ? "mt-2" : "mt-4")}>
        {actions.map((action) => (
          <ActionChip
            key={action.id}
            action={action}
            onClick={() => void runAction(action, surface)}
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
  signedIn: _signedIn,
  primary,
  surface = "action-chip",
}: {
  action: DiscoverAction;
  signedIn: boolean;
  primary?: boolean;
  surface?: string;
}) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();

  useEffect(() => {
    registerVisibleAction(surface, action);
  }, [action, registerVisibleAction, surface]);

  const style = primary
    ? ACTION_STYLES[action.kind] ?? ACTION_STYLES.fund
    : ACTION_STYLES.default;

  return (
    <button
      type="button"
      onClick={() => void runAction(action, surface)}
      className={clsx(
        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
        style,
      )}
    >
      {action.label}
    </button>
  );
}
