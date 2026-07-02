"use client";

import { useEffect, useMemo } from "react";
import clsx from "clsx";
import type { DiscoverAction, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import { visibleDiscoverActions } from "@/lib/discover/discover-visible-actions";
import { isCommunityInstalled } from "@/lib/profile/connection-state-types";

const DOMAIN_BADGE_CLASS: Record<string, string> = {
  oss: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  music: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  research: "border-indigo-500/25 bg-indigo-500/10 text-indigo-100",
  dao: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100",
  community: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  protocol: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
};

type DiscoverFeatureRowProps = {
  gap: TrendingValueGap;
  signedIn: boolean;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  rank?: number;
  surface?: string;
  maxActions?: number;
};

function partitionActions(actions: DiscoverAction[]) {
  const attach = actions.filter((a) => a.kind === "install" || a.kind === "connect_sensor");
  const operational = actions.filter((a) => a.kind !== "install");
  return { attach, operational };
}

export function DiscoverFeatureRow({
  gap,
  signedIn: _signedIn,
  intent: _intent = "all",
  role: _role = "all",
  rank,
  surface = "feature-row",
  maxActions = 3,
}: DiscoverFeatureRowProps) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();

  const tailored = tailorDiscoverActionsForUser(
    visibleDiscoverActions(gap.actions, surface),
    connections,
  );

  const installed =
    gap.communitySlug != null && isCommunityInstalled(connections, gap.communitySlug);

  const { attach, operational } = useMemo(() => {
    const { attach: a, operational: o } = partitionActions(tailored);
    const attachVisible = installed ? [] : a.slice(0, 1);
    const ops = o.slice(0, maxActions);
    return { attach: attachVisible, operational: ops };
  }, [tailored, installed, maxActions]);

  const allVisible = [...attach, ...operational];

  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );

  const valueSignals = gap.valueSignals ?? [];
  const showValueStrip = valueSignals.length > 0 || !gap.amountVerified;

  useEffect(() => {
    for (const action of allVisible) {
      registerVisibleAction(surface, action);
    }
  }, [allVisible, registerVisibleAction, surface]);

  return (
    <li className="resolve-signal-service-row px-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {rank != null && (
              <span className="text-[10px] font-semibold tabular-nums text-resolve-muted-dim">
                #{rank}
              </span>
            )}
            {gap.ecosystem && (
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium uppercase text-sky-200/90">
                {gap.ecosystem}
              </span>
            )}
            <span
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase",
                DOMAIN_BADGE_CLASS[gap.domain] ?? "border-white/10 bg-white/[0.06] text-resolve-muted",
              )}
            >
              {gap.domain}
            </span>
            {gap.needType && (
              <span
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase",
                  needTypeBadgeClass(gap.needType),
                )}
              >
                {needTypeLabel(gap.needType)}
              </span>
            )}
            <DiscoverSourceBadge
              source={gap.dataSource}
              estimate={!gap.amountVerified && Boolean(gap.proofGithubScanAt)}
            />
          </div>

          <p className="mt-1 text-[13px] font-semibold leading-snug text-white">{gap.headline}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-resolve-muted">
            {gap.why}
          </p>

          {showValueStrip && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {valueSignals.length > 0 ? (
                valueSignals.map((signal) => (
                  <span
                    key={signal.event}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px]",
                      signal.settled
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-500/20 bg-amber-500/5 text-amber-100/90",
                    )}
                  >
                    <span className="font-medium">{signal.label}</span>
                    <span className="text-resolve-muted-dim">from {signal.source}</span>
                    {!signal.settled && (
                      <span className="text-amber-200/70">· value provided</span>
                    )}
                  </span>
                ))
              ) : (
                <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[9px] text-resolve-muted-dim">
                  Connect upstream to extract real activity
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {gap.opportunityScorecard && gap.amountVerified && (
            <span className="text-lg font-semibold tabular-nums text-resolve-accent">
              {gap.opportunityScorecard.composite}
            </span>
          )}
          <span
            className={clsx(
              "text-right text-[11px] font-semibold leading-tight",
              needed.tone === "verified" ? "text-amber-200" : "text-amber-200/60",
            )}
          >
            {needed.label}
          </span>
          {gap.proofSource && (
            <span className="max-w-[9rem] text-right text-[9px] text-resolve-muted-dim">
              {gap.proofSource}
            </span>
          )}
        </div>
      </div>

      {allVisible.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {attach.map((action, index) => (
            <button
              key={`attach-${action.id}-${index}`}
              type="button"
              onClick={() => void runAction(action, surface)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-medium text-resolve-muted transition hover:border-white/20 hover:text-white"
            >
              {friendlyDiscoverActionLabel(action, connections)}
            </button>
          ))}
          {attach.length > 0 && operational.length > 0 && (
            <span className="text-[9px] text-resolve-muted-dim">then</span>
          )}
          {operational.map((action, index) => (
            <button
              key={`op-${action.id}-${action.kind}-${index}`}
              type="button"
              onClick={() => void runAction(action, surface)}
              className={clsx(
                "rounded-md border px-2 py-1 text-[10px] font-medium transition",
                index === 0
                  ? "border-resolve-accent/35 bg-resolve-accent/12 text-resolve-accent hover:bg-resolve-accent/18"
                  : "border-white/10 text-resolve-muted hover:border-white/20 hover:text-white",
              )}
              title={action.reason}
            >
              {friendlyDiscoverActionLabel(action, connections)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
