"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  CheckCircle2,
  LineChart,
  Loader2,
  Receipt,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";
import {
  buildMissionBlueprintFromAgent,
  simulateBlueprintPackage,
  type MissionBlueprintPackage,
} from "@/lib/mission/mission-blueprint-package";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";

type AgentExecution = {
  findings?: string[];
  recommendations?: string[];
};

export function MissionBlueprintPackage({
  prompt,
  chargedUsd,
  headline,
  detail,
  execution,
  receiptHref,
  onAuthorize,
}: {
  prompt: string;
  chargedUsd: number;
  headline: string;
  detail?: string;
  execution?: AgentExecution | null;
  receiptHref?: string | null;
  onAuthorize?: (pkg: MissionBlueprintPackage) => void;
}) {
  const [pool, setPool] = useState<ProgramPoolState | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [budgetUsd, setBudgetUsd] = useState(500);
  const [simulated, setSimulated] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  const draftPkg = useMemo(
    () =>
      buildMissionBlueprintFromAgent({
        prompt,
        chargedUsd,
        headline,
        detail,
        findings: execution?.findings,
        recommendations: execution?.recommendations,
        poolPayees: pool?.nextBatchPayees,
        milestoneUsd: pool?.activeMilestoneUsd ?? budgetUsd,
        communitySlug: null,
      }),
    [
      prompt,
      chargedUsd,
      headline,
      detail,
      execution?.findings,
      execution?.recommendations,
      pool?.nextBatchPayees,
      pool?.activeMilestoneUsd,
      budgetUsd,
    ],
  );

  const pkg = useMemo(
    () => ({ ...draftPkg, totalCapitalUsd: budgetUsd, milestoneUsd: pool?.activeMilestoneUsd ?? budgetUsd }),
    [draftPkg, budgetUsd, pool?.activeMilestoneUsd],
  );

  const simulation = useMemo(() => simulateBlueprintPackage(pkg), [pkg]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch(
        `/api/communities/${encodeURIComponent(pkg.communitySlug)}/pool`,
        { credentials: "include", cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { pool?: ProgramPoolState | null };
        setPool(data.pool ?? null);
        if (data.pool?.activeMilestoneUsd) {
          setBudgetUsd((prev) => Math.max(prev, data.pool!.activeMilestoneUsd));
        }
      }
    } finally {
      setPoolLoading(false);
    }
  }, [pkg.communitySlug]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  function handleSimulate() {
    setSimulated(true);
    toast.success("Simulation ready", {
      description: `${simulation.clearedAuthorizations} payees · $${simulation.totalPayeeUsd.toFixed(2)} allocated`,
    });
  }

  async function handleAuthorize() {
    setAuthorizing(true);
    try {
      if (onAuthorize) {
        onAuthorize(pkg);
        return;
      }
      const params = new URLSearchParams({
        community: pkg.communitySlug,
        intent: "fund",
      });
      window.location.href = `/capital?${params}`;
    } finally {
      setAuthorizing(false);
    }
  }

  const poolUsd = pool?.poolBalanceUsd ?? 0;

  return (
    <section className="rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.08] to-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            Mission Blueprint
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{pkg.communityLabel} · settlement package</h3>
          <p className="mt-1 text-xs text-resolve-muted">
            Signal {formatAgentPrice(chargedUsd)} → {pkg.payees.length} payees auto-filled from proof
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-white">
            <Money amount={simulation.totalPayeeUsd} size="sm" className="inline text-lg" />
          </p>
          <p className="text-[10px] text-resolve-muted-dim">
            {Math.round(pkg.confidence * 100)}% confidence · ledger-backed
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-100">
        <span className="font-medium">{headline}</span>
        {detail && <span className="text-emerald-200/80"> — {detail}</span>}
        {receiptHref && (
          <Link href={receiptHref} className="ml-2 inline-flex items-center gap-1 text-resolve-accent hover:underline">
            <Receipt className="h-3 w-3" />
            Arc receipt
          </Link>
        )}
      </div>

      {execution?.findings && execution.findings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {execution.findings.slice(0, 3).map((f) => (
            <li key={f} className="flex gap-2 text-[11px] text-resolve-muted">
              <span className="text-resolve-accent">•</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
          Deploy budget (USDC)
          <input
            type="range"
            min={100}
            max={5000}
            step={50}
            value={budgetUsd}
            onChange={(e) => {
              setBudgetUsd(Number(e.target.value));
              setSimulated(false);
            }}
            className="mt-1 block w-40 accent-violet-400"
          />
          <span className="mt-0.5 block text-sm font-semibold tabular-nums text-white">
            ${budgetUsd.toLocaleString()}
          </span>
        </label>
        {poolLoading ? (
          <span className="flex items-center gap-1.5 text-[11px] text-resolve-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Syncing communal pool…
          </span>
        ) : (
          <div className="min-w-[140px] flex-1">
            <p className="text-[10px] text-resolve-muted-dim">Communal pool</p>
            <Money amount={poolUsd} size="sm" className="text-white" />
            <PoolMilestoneBar poolUsd={poolUsd} className="mt-1" compact />
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.08]">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-resolve-muted-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Payee</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {pkg.payees.map((p) => (
              <tr key={p.label} className="text-resolve-muted">
                <td className="px-3 py-2 text-white/90">{p.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-300">
                  ${p.owedUsd.toFixed(2)}
                </td>
                <td className="hidden px-3 py-2 text-resolve-muted-dim sm:table-cell">{p.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {simulated && (
        <div
          className={clsx(
            "mt-3 rounded-lg border px-3 py-2.5 text-xs",
            simulation.checkpointReached
              ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-100"
              : "border-amber-500/25 bg-amber-500/[0.06] text-amber-100",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Simulation · dry run (no funds moved)
          </p>
          <p className="mt-1">
            {simulation.clearedAuthorizations} authorizations · ${simulation.totalPayeeUsd.toFixed(2)} to
            payees
            {simulation.surplusUsd > 0 && (
              <span> · ${simulation.surplusUsd.toFixed(2)} remains in pool reserve</span>
            )}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={handleSimulate}
        >
          <LineChart className="h-3.5 w-3.5" />
          Simulate
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={authorizing || (!simulated && pkg.payees.length === 0)}
          onClick={() => void handleAuthorize()}
        >
          {authorizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          {simulated ? "Authorize settlement" : "Simulate first"}
        </Button>
        <Link
          href={`/discover?community=${encodeURIComponent(pkg.communitySlug)}`}
          className="inline-flex items-center gap-1 self-center px-2 text-[11px] font-medium text-resolve-accent hover:underline"
        >
          Fund pool in Discover
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-resolve-muted-dim">{pkg.rationale}</p>
    </section>
  );
}
