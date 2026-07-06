"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Flag, Loader2, Radio, Users } from "lucide-react";
import { communitiesInstallHandoff } from "@/lib/mission/mission-handoff";
import { ValueGraph } from "@/components/resolve/discover/value-graph";
import { DiscoverProofPipeline } from "@/components/resolve/discover/discover-proof-pipeline";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";
import { Money } from "@/components/resolve/ui/money";
import { MissionCapitalLoop } from "@/components/resolve/mission-control/mission-capital-loop";
import { useProgramPoolState } from "@/components/resolve/communities/pool-checkpoint-panel";
import { missionProofStages } from "@/lib/mission/mission-proof-stages";
import { rfbProgramsForKind } from "@/lib/mission/mission-lane-copy";
import type { CommunityKind } from "@/lib/mission/community/types";
import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { MissionPhase } from "@/lib/mission/phases";
import type { LiveEventItem } from "@/lib/events/live";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import { MissionTimeline } from "@/components/resolve/mission-control/mission-timeline";

type MissionPoolStripProps = {
  communitySlug: string;
  compact?: boolean;
};

export function MissionPoolStrip({ communitySlug, compact }: MissionPoolStripProps) {
  const { pool, loading } = useProgramPoolState(communitySlug, null, { scope: "community" });

  if (loading && !pool) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-resolve-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading communal pool…
      </div>
    );
  }

  if (!pool) return null;

  const poolUsd = pool.poolBalanceUsd ?? 0;
  const milestoneUsd = pool.activeMilestoneUsd ?? pool.nextCheckpointUsd ?? 500;
  const funderCount = pool.funderCount ?? 0;

  return (
    <div
      className={clsx(
        "rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04]",
        compact ? "px-3 py-2.5" : "px-3 py-3",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
          Communal pool
        </p>
        {funderCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-resolve-muted">
            <Users className="h-3 w-3" />
            {funderCount} funder{funderCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
        <Money amount={poolUsd} size="sm" className="inline text-sm" />{" "}
        <span className="text-xs font-normal text-resolve-muted">
          toward <Money amount={milestoneUsd} size="sm" className="inline text-xs" />
        </span>
      </p>
      {poolUsd >= 0 && (
        <PoolMilestoneBar poolUsd={poolUsd} className="mt-2" compact />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={`/discover?community=${encodeURIComponent(communitySlug)}`}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-resolve-accent hover:underline"
        >
          Discover scope
        </Link>
        <Link
          href={communitiesInstallHandoff(communitySlug)}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-resolve-muted hover:text-white"
        >
          Install program
        </Link>
      </div>
    </div>
  );
}

function LiveEventRow({ event }: { event: LiveEventItem }) {
  return (
    <li className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
      <p className="text-[11px] font-medium text-white/90">{event.title}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] text-resolve-muted">{event.detail}</p>
      {event.amountUsd != null && event.amountUsd > 0 && (
        <p className="mt-1 text-[10px] tabular-nums text-emerald-300">
          ${event.amountUsd.toFixed(event.amountUsd < 0.01 ? 4 : 2)} USDC
        </p>
      )}
    </li>
  );
}

export function MissionLivePanel({
  topicName,
  topicKind,
  communitySlug,
  missionPhase,
  loopPhase,
  hasAgentReceipt,
  hasAllocation,
  missionId,
  showCapital,
  showPolicies,
  showTimeline,
  policies,
  selectedPolicyId,
  onSelectPolicy,
  allocations,
  treasuryBalanceUsd,
  timeline,
  timelineLoading,
  className,
}: {
  topicName?: string | null;
  topicKind?: CommunityKind;
  communitySlug?: string | null;
  missionPhase: MissionPhase;
  loopPhase: CapitalLoopPhase;
  hasAgentReceipt?: boolean;
  hasAllocation?: boolean;
  missionId?: string | null;
  showCapital?: boolean;
  showPolicies?: boolean;
  showTimeline?: boolean;
  policies?: PolicyProposal[];
  selectedPolicyId?: string | null;
  onSelectPolicy?: (id: string) => void;
  allocations?: AllocationLine[];
  treasuryBalanceUsd?: number;
  timeline?: ServerTimelineEvent[];
  timelineLoading?: boolean;
  className?: string;
}) {
  const [events, setEvents] = useState<LiveEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const proofStages = missionProofStages({
    missionPhase,
    loopPhase,
    hasAgentReceipt,
    hasPool: Boolean(communitySlug),
    hasAllocation,
  });

  const rfbPrograms = rfbProgramsForKind(topicKind ?? "oss");

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    const params = new URLSearchParams({ scope: "network", limit: "6" });
    if (communitySlug) params.set("community", communitySlug);
    if (missionId) params.set("mission", missionId);

    void fetch(`/api/events/live?${params}`)
      .then((r) => r.json())
      .then((body: { events?: LiveEventItem[] }) => {
        if (!cancelled) setEvents(body.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [communitySlug, missionId]);

  return (
    <aside
      className={clsx(
        "flex w-full shrink-0 flex-col border-l border-white/[0.06] bg-[#070b14]/60 lg:w-64 xl:w-72",
        className,
      )}
    >
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-resolve-accent" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Live panel
          </p>
        </div>
        {topicName && (
          <p className="mt-1 text-sm font-medium text-white">{topicName}</p>
        )}

        <div className="mt-4">
          <MissionCapitalLoop activePhase={loopPhase} compact />
        </div>

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Proof pipeline</p>
          <DiscoverProofPipeline stages={proofStages} className="mt-2" />
        </div>

        {communitySlug && (
          <div className="mt-4">
            <MissionPoolStrip communitySlug={communitySlug} compact />
          </div>
        )}

        <section className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-resolve-muted-dim">
            <Flag className="h-3 w-3" />
            Program rails
          </p>
          <ul className="mt-2 space-y-1.5">
            {rfbPrograms.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2"
              >
                <p className="text-[10px] font-semibold text-resolve-accent">{p.trackLabel}</p>
                <p className="text-[11px] text-white/90">{p.name}</p>
                <p className="mt-0.5 text-[10px] text-resolve-muted-dim">{p.upstream}</p>
              </li>
            ))}
          </ul>
        </section>

        {showPolicies && policies && policies.length > 0 && (
          <section className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Policy</p>
            <ul className="mt-2 space-y-1">
              {policies.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPolicy?.(p.id)}
                    className={clsx(
                      "w-full rounded-lg px-2 py-1.5 text-left text-[11px] transition",
                      selectedPolicyId === p.id
                        ? "bg-white/[0.06] text-white"
                        : "text-resolve-muted hover:text-white",
                    )}
                  >
                    {p.emoji} {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showCapital && allocations && allocations.length > 0 && (
          <section className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Allocation</p>
            {treasuryBalanceUsd !== undefined && (
              <p className="mt-1 text-[11px] tabular-nums text-white">
                Treasury ${treasuryBalanceUsd.toLocaleString()}
              </p>
            )}
            <ul className="mt-2 space-y-1">
              {allocations.map((l) => (
                <li key={l.id} className="flex justify-between text-[10px] text-resolve-muted">
                  <span className="truncate pr-1">{l.label}</span>
                  <span className="tabular-nums text-white">${l.amountUsd.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showTimeline && timeline && timeline.length > 0 && (
          <section className="mt-4 border-t border-white/[0.06] pt-4">
            <MissionTimeline events={timeline} loading={timelineLoading} />
          </section>
        )}

        <section className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
            Network pulse
          </p>
          {eventsLoading && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-resolve-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          )}
          {!eventsLoading && events.length === 0 && (
            <p className="mt-2 text-[11px] text-resolve-muted-dim">
              No live events yet — run a signal or fund a pool.
            </p>
          )}
          {!eventsLoading && events.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {events.slice(0, 5).map((e) => (
                <LiveEventRow key={e.id} event={e} />
              ))}
            </ul>
          )}
          <Link
            href="/discover"
            className="mt-2 inline-block text-[10px] font-medium text-resolve-muted hover:text-resolve-accent"
          >
            Discover gaps →
          </Link>
          {communitySlug && (
            <div className="mt-3">
              <ValueGraph variant="compact" />
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
