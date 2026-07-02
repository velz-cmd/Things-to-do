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
import { discoverActionsForRole } from "@/lib/discover/discover-role-actions";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { isPreviewSource } from "@/lib/discover/source-badges";
import { DiscoverProofPipeline } from "@/components/resolve/discover/discover-proof-pipeline";

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
  role = "all",
  rank,
  surface = "feature-row",
  maxActions = 3,
}: DiscoverFeatureRowProps) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();

  const tailored = tailorDiscoverActionsForUser(
    discoverActionsForRole(
      role,
      visibleDiscoverActions(gap.actions, surface),
    ),
    connections,
  );

  const installed =
    gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);

  const { attach, operational } = useMemo(() => {
    const { attach: a, operational: o } = partitionActions(tailored);
    const attachVisible = installed ? [] : a.slice(0, 1);
    const ops = o.slice(0, maxActions);
    return { attach: attachVisible, operational: ops };
  }, [tailored, installed, maxActions]);

  const allVisible = useMemo(() => [...attach, ...operational], [attach, operational]);

  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );

  const valueSignals = gap.valueSignals ?? [];
  const showProof = Boolean(gap.valueMetrics);
  const showSignals = !showProof && valueSignals.length > 0;

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
            {!gap.ecosystem && (
              <span
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase",
                  DOMAIN_BADGE_CLASS[gap.domain] ?? "border-white/10 bg-white/[0.06] text-resolve-muted",
                )}
              >
                {gap.domain}
              </span>
            )}
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
            {gap.amountVerified && !isPreviewSource(gap.dataSource) && (
              <DiscoverSourceBadge
                source={gap.dataSource}
                estimate={Boolean(gap.proofGithubScanAt)}
              />
            )}
          </div>

          <p className="mt-1 text-[13px] font-semibold leading-snug text-white">{gap.headline}</p>
          {!showProof && gap.why && (
            <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-resolve-muted">
              {gap.why}
            </p>
          )}

          {showProof && gap.valueMetrics && (
            <DiscoverProofPipeline
              metrics={gap.valueMetrics}
              connected={installed}
              amountVerified={gap.amountVerified}
              className="mt-2"
            />
          )}

          {showSignals && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {valueSignals
                .filter((s) => !s.event.startsWith("payout.") && !s.event.startsWith("settlement."))
                .slice(0, 2)
                .map((signal) => (
                  <span
                    key={signal.event}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px]",
                      signal.settled
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                        : "border-white/[0.08] bg-white/[0.02] text-resolve-muted",
                    )}
                  >
                    <span className="font-medium text-white/90">{signal.label}</span>
                    {signal.count != null && signal.count > 0 && (
                      <span className="tabular-nums text-resolve-muted-dim">{signal.count}</span>
                    )}
                  </span>
                ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={clsx(
              "text-right text-[11px] font-semibold leading-tight tabular-nums",
              needed.tone === "verified" ? "text-amber-200" : "text-amber-200/60",
            )}
          >
            {needed.label}
          </span>
        </div>
      </div>

      {allVisible.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {attach.map((action, index) => (
            <button
              key={`attach-${action.id}-${index}`}
              type="button"
              onClick={() => void runAction(action, surface)}
              className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-medium text-resolve-muted transition hover:border-white/20 hover:text-white"
            >
              {friendlyDiscoverActionLabel(action, connections)}
            </button>
          ))}
          {operational.map((action, index) => (
            <button
              key={`op-${action.id}-${action.kind}-${index}`}
              type="button"
              onClick={() => void runAction(action, surface)}
              className={clsx(
                "rounded-md border px-2.5 py-1 text-[10px] font-medium transition",
                index === 0
                  ? "border-resolve-accent/35 bg-resolve-accent/12 text-resolve-accent hover:bg-resolve-accent/18"
                  : "border-white/10 text-resolve-muted hover:border-white/20 hover:text-white",
              )}
            >
              {friendlyDiscoverActionLabel(action, connections)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
