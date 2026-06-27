"use client";

import Link from "next/link";
import type { EvidenceAction } from "@/lib/workspace/advisors/evidence-actions";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";

export function MissionActionPanel({
  actions,
  policies,
  showPolicies,
  selectedPolicyId,
  onSelectPolicy,
  onReject,
  missionActive,
}: {
  actions: EvidenceAction[];
  policies: PolicyProposal[];
  showPolicies: boolean;
  selectedPolicyId: string | null;
  onSelectPolicy: (id: string) => void;
  onReject: () => void;
  missionActive: boolean;
}) {
  if (!missionActive) {
    return (
      <aside className="hidden w-64 shrink-0 border-l border-resolve-border xl:block">
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
            Actions
          </p>
          <p className="mt-4 text-xs leading-relaxed text-resolve-muted">
            Recommendations appear here after analysis. Nothing executes without your approval.
          </p>
        </div>
      </aside>
    );
  }

  const primary = actions[0];

  return (
    <aside className="hidden w-64 shrink-0 border-l border-resolve-border xl:block">
      <div className="flex h-full flex-col overflow-y-auto p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
          Actions
        </p>

        {primary ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-white">{primary.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{primary.detail}</p>
            <p className="mt-2 text-[10px] text-resolve-muted-dim">{primary.evidence}</p>
          </div>
        ) : (
          <p className="mt-4 text-xs text-resolve-muted">No actions recommended yet.</p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {primary && (
            <Link
              href={primary.href}
              className="rounded-lg bg-resolve-accent px-3 py-2 text-center text-xs font-semibold text-white hover:bg-blue-500"
            >
              Approve
            </Link>
          )}
          <Link
            href="/mission/fund"
            className="rounded-lg border border-resolve-border px-3 py-2 text-center text-xs font-medium text-white hover:bg-resolve-hover/30"
          >
            Fund
          </Link>
          <button
            type="button"
            className="rounded-lg border border-resolve-border px-3 py-2 text-xs font-medium text-resolve-muted hover:text-white"
          >
            Simulate
          </button>
          <button
            type="button"
            onClick={onReject}
            className="rounded-lg px-3 py-2 text-xs text-resolve-muted hover:text-white"
          >
            Reject
          </button>
        </div>

        {showPolicies && policies.length > 0 && (
          <div className="mt-8 border-t border-resolve-border pt-6">
            <p className="text-xs font-medium text-white">Choose allocation strategy</p>
            <p className="mt-1 text-[11px] text-resolve-muted">
              Appears when a funding decision is in scope.
            </p>
            <ul className="mt-4 space-y-2">
              {policies.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPolicy(p.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                      selectedPolicyId === p.id
                        ? "border-resolve-accent/40 bg-resolve-accent/10 text-white"
                        : "border-resolve-border text-resolve-muted hover:text-white"
                    }`}
                  >
                    <span className="mr-1">{p.emoji}</span>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions.length > 1 && (
          <ul className="mt-6 space-y-3 border-t border-resolve-border pt-6">
            {actions.slice(1, 4).map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="text-xs text-resolve-accent hover:underline">
                  {a.label}
                </Link>
                <p className="mt-0.5 text-[10px] text-resolve-muted">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
