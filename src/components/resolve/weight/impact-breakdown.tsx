"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ContributorWeight } from "@/lib/weight/types";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

export function ImpactBreakdown({
  fundPoolUsd,
  contributors,
  weightProofHash,
  onSettle,
  settling,
  settleLabel = "Settle on Arc",
}: {
  fundPoolUsd: number;
  contributors: ContributorWeight[];
  weightProofHash: string;
  onSettle: () => void;
  settling?: boolean;
  settleLabel?: string;
}) {
  const totalWeight = contributors.reduce((s, c) => s + c.totalWeight, 0);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [pausedPayees, setPausedPayees] = useState<Set<string>>(new Set());

  async function challengeWeight(c: ContributorWeight) {
    setChallenging(c.payeeKey);
    try {
      const res = await fetch("/api/weight/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payeeKey: c.payeeKey,
          claimedSharePercent: c.sharePercent,
          challengerStakeUsd: 2,
          reason: "Dispute impact share before settlement",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Challenge failed");
      setPausedPayees((prev) => new Set(prev).add(c.payeeKey));
      toast.success(`Challenge opened · ${data.challengeId} · settlement paused for this payee`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setChallenging(null);
    }
  }

  const topContributor = contributors[0];
  const canChallenge = (c: ContributorWeight) =>
    topContributor && c.payeeKey === topContributor.payeeKey && c.sharePercent >= 15;

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
              Impact breakdown
            </p>
            <p className="mt-1 text-sm text-white">
              {contributors.length} contributors · {totalWeight} total weight
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-resolve-muted">Fund pool</p>
            <Money amount={fundPoolUsd} size="md" />
          </div>
        </div>

        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-resolve-hover">
          {contributors.map((c, i) => {
            const colors = ["bg-blue-500", "bg-cyan-400", "bg-violet-400", "bg-amber-400", "bg-emerald-400"];
            return (
              <div
                key={c.payeeKey}
                className={colors[i % colors.length]}
                style={{ width: `${c.sharePercent}%` }}
                title={`${c.payeeName ?? c.payeeKey}: ${c.sharePercent}%`}
              />
            );
          })}
        </div>

        <ul className="mt-4 divide-y divide-resolve-border text-xs">
          {contributors.map((c) => (
            <li key={c.payeeKey} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{c.payeeName ?? c.payeeKey}</p>
                  {pausedPayees.has(c.payeeKey) && (
                    <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-200">
                      CHALLENGED
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-resolve-muted">{c.topRationale}</p>
                <p className="mt-1 text-[10px] text-resolve-muted-dim">
                  {c.eventCount} events · weight {c.totalWeight}
                </p>
                {canChallenge(c) && !pausedPayees.has(c.payeeKey) && (
                  <button
                    type="button"
                    onClick={() => challengeWeight(c)}
                    disabled={challenging === c.payeeKey}
                    className="mt-2 text-[10px] text-amber-300 hover:underline"
                  >
                    {challenging === c.payeeKey ? "Opening challenge…" : "Challenge this weight (stake $2)"}
                  </button>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tabular-nums text-white">{c.sharePercent}%</p>
                <p className="text-[9px] uppercase text-resolve-muted">share</p>
                <Money amount={c.payoutUsd} size="sm" className="mt-1" />
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 font-mono text-[10px] text-resolve-muted">
          Weight proof: {weightProofHash.slice(0, 18)}…
        </p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSettle}
          disabled={settling || !contributors.length}
          className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {settling ? "Preparing settlement…" : settleLabel}
        </button>
        <p className="self-center text-[11px] text-resolve-muted">
          Open Contribution Graph → Proof-of-Weight → Proportional Settlement Split
        </p>
      </div>
    </div>
  );
}
