"use client";

import clsx from "clsx";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import type { MissionPhase } from "@/lib/mission/phases";
import { MissionTimeline } from "@/components/resolve/mission-control/mission-timeline";

/** Contextual capabilities — appear only when the mission requires them. */
export function MissionContextPanel({
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
}: {
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
}) {
  const hasContent = showCapital || showPolicies || showTimeline;
  if (!hasContent) return null;

  return (
    <aside className="hidden w-56 shrink-0 border-l border-white/[0.06] bg-[#070b14]/50 xl:block 2xl:w-64">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          In scope
        </p>

        {showPolicies && policies.length > 0 && (
          <section className="mt-4">
            <p className="text-xs font-medium text-white">Allocation policy</p>
            <p className="mt-0.5 text-[10px] text-resolve-muted-dim">
              Switch philosophy — reasoning updates instantly.
            </p>
            <ul className="mt-3 space-y-1.5">
              {policies.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPolicy(p.id)}
                    className={clsx(
                      "w-full rounded-lg border px-2.5 py-2 text-left text-[11px] transition",
                      selectedPolicyId === p.id ?
                        "border-resolve-accent/40 bg-resolve-accent/10 text-white"
                      : "border-white/[0.06] text-resolve-muted hover:text-white",
                    )}
                  >
                    <span className="mr-1">{p.emoji}</span>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showCapital && (
          <section className="mt-4">
            <p className="text-xs font-medium text-white">Capital</p>
            {treasuryBalanceUsd !== undefined && (
              <p className="mt-1 text-[11px] text-resolve-muted">
                Treasury{" "}
                <span className="tabular-nums text-white">
                  ${treasuryBalanceUsd.toLocaleString()}
                </span>
              </p>
            )}
            {allocations && allocations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {allocations.map((l) => (
                  <li
                    key={l.id}
                    className="flex justify-between text-[11px] text-resolve-muted"
                  >
                    <span className="truncate pr-2">{l.label}</span>
                    <span className="shrink-0 tabular-nums text-white">
                      ${l.amountUsd.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {phase === "execute" && (
              <p className="mt-2 text-[10px] text-amber-200/80">
                Settlement rail active — review amounts before moving capital.
              </p>
            )}
          </section>
        )}

        {showTimeline && (
          <section className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="text-xs font-medium text-white">Mission timeline</p>
            <MissionTimeline events={timeline} loading={timelineLoading} />
          </section>
        )}
      </div>
    </aside>
  );
}
