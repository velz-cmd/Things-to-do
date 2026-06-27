"use client";

import clsx from "clsx";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import type { MissionPhase } from "@/lib/mission/phases";
import type { CommunityKind } from "@/lib/mission/community/types";
import type { CapitalLoopPhase, OperatingMode } from "@/lib/mission/capital-os";
import { MissionTimeline } from "@/components/resolve/mission-control/mission-timeline";
import { MissionCapitalLoop } from "@/components/resolve/mission-control/mission-capital-loop";

const CONTEXT_SECTIONS: Partial<Record<CommunityKind, string[]>> = {
  music: ["Artists", "Listeners", "Royalties", "Patronage"],
  research: ["Citations", "Grants", "Labs", "Publications"],
  oss: ["Maintainers", "Dependencies", "Treasury", "Governance"],
  protocol: ["Validators", "Treasury", "Governance", "Developers"],
  local: ["Maintainers", "Universities", "Grants", "Events"],
};

function contextLabel(kind: CommunityKind): string {
  switch (kind) {
    case "music":
      return "Creative context";
    case "research":
      return "Research context";
    case "protocol":
    case "dao":
      return "Protocol context";
    default:
      return "Community context";
  }
}

/** Revealed only when a mission topic exists. */
export function MissionContextPanel({
  topicName,
  topicKind,
  phase,
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
  operatingMode,
  loopPhase,
}: {
  topicName: string;
  topicKind: CommunityKind;
  phase: MissionPhase;
  showCapital: boolean;
  showPolicies: boolean;
  showTimeline: boolean;
  policies: PolicyProposal[];
  selectedPolicyId: string | null;
  onSelectPolicy: (id: string) => void;
  allocations?: AllocationLine[];
  treasuryBalanceUsd?: number;
  timeline: ServerTimelineEvent[];
  timelineLoading?: boolean;
  operatingMode?: OperatingMode;
  loopPhase?: CapitalLoopPhase;
}) {
  const sections = CONTEXT_SECTIONS[topicKind] ?? CONTEXT_SECTIONS.oss ?? [];

  return (
    <aside className="hidden w-52 shrink-0 border-l border-white/[0.06] bg-[#070b14]/50 lg:block xl:w-56">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          {contextLabel(topicKind)}
        </p>
        <p className="mt-1 text-sm font-medium text-white">{topicName}</p>

        {sections.length > 0 && (
          <ul className="mt-4 space-y-1">
            {sections.map((s) => (
              <li key={s} className="text-[11px] text-resolve-muted">
                {s}
              </li>
            ))}
          </ul>
        )}

        {(showCapital || showPolicies) && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <MissionCapitalLoop activePhase={loopPhase ?? "understand"} compact />
          </div>
        )}

        {showPolicies && policies.length > 0 && (
          <section className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Policy</p>
            <ul className="mt-2 space-y-1">
              {policies.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPolicy(p.id)}
                    className={clsx(
                      "w-full rounded-lg px-2 py-1.5 text-left text-[11px] transition",
                      selectedPolicyId === p.id ?
                        "bg-white/[0.06] text-white"
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

        {showCapital && (
          <section className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Capital</p>
            {treasuryBalanceUsd !== undefined && (
              <p className="mt-1 text-[11px] tabular-nums text-white">
                ${treasuryBalanceUsd.toLocaleString()}
              </p>
            )}
            {allocations && allocations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {allocations.map((l) => (
                  <li key={l.id} className="flex justify-between text-[10px] text-resolve-muted">
                    <span className="truncate pr-1">{l.label}</span>
                    <span className="tabular-nums text-white">${l.amountUsd.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {phase === "execute" && (
              <p className="mt-2 text-[10px] text-amber-200/70">Settlement pending approval</p>
            )}
          </section>
        )}

        {showTimeline && timeline.length > 0 && (
          <section className="mt-4 border-t border-white/[0.06] pt-4">
            <MissionTimeline events={timeline} loading={timelineLoading} />
          </section>
        )}
      </div>
    </aside>
  );
}
