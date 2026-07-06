"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  LineChart,
  Loader2,
  Receipt,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";
import {
  MISSION_POLICY_OPTIONS,
  applyPolicyToPayees,
  buildMissionBlueprintFromAgent,
  buildMissionBlueprintFromScope,
  simulateBlueprintPackage,
  type MissionBlueprintPackage,
  type MissionBlueprintPolicyId,
} from "@/lib/mission/mission-blueprint-package";
import {
  createReportFromPackage,
  saveMissionReport,
} from "@/lib/mission/mission-report-store";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";

type AgentExecution = {
  findings?: string[];
  recommendations?: string[];
};

export type MissionBlueprintPanelProps = {
  prompt: string;
  mode?: "agent" | "scope";
  chargedUsd?: number;
  headline?: string;
  detail?: string;
  execution?: AgentExecution | null;
  receiptHref?: string | null;
  communitySlug?: string | null;
  initialBudgetUsd?: number;
};

export function MissionBlueprintPanel({
  prompt,
  mode = "scope",
  chargedUsd = 0,
  headline,
  detail,
  execution,
  receiptHref,
  communitySlug: communitySlugProp,
  initialBudgetUsd,
}: MissionBlueprintPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const signedIn = Boolean(user);

  const [pool, setPool] = useState<ProgramPoolState | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [policy, setPolicy] = useState<MissionBlueprintPolicyId>("balanced");
  const [budgetUsd, setBudgetUsd] = useState(initialBudgetUsd ?? 500);
  const [simulated, setSimulated] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const slug =
    communitySlugProp ??
    resolveMissionCommunitySlug({ scopeLabel: prompt, topicName: prompt }) ??
    "react";

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/pool`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          pool?: ProgramPoolState | null;
          programId?: string | null;
        };
        setPool(data.pool ?? null);
        setProgramId(data.programId ?? data.pool?.programId ?? null);
        if (data.pool?.activeMilestoneUsd) {
          setBudgetUsd((prev) => initialBudgetUsd ?? Math.max(prev, data.pool!.activeMilestoneUsd));
        }
      }
    } finally {
      setPoolLoading(false);
    }
  }, [slug, initialBudgetUsd]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const basePkg = useMemo(() => {
    const common = {
      prompt,
      communitySlug: slug,
      poolPayees: pool?.nextBatchPayees,
      milestoneUsd: pool?.activeMilestoneUsd ?? budgetUsd,
      budgetUsd,
      policy,
      programId,
      poolBalanceUsd: pool?.poolBalanceUsd,
      owedUsd: pool?.owedToCreatorsUsd,
    };
    if (mode === "agent") {
      return buildMissionBlueprintFromAgent({
        ...common,
        chargedUsd,
        headline: headline ?? "Agent signal complete",
        detail,
        findings: execution?.findings,
        recommendations: execution?.recommendations,
      });
    }
    return buildMissionBlueprintFromScope({
      ...common,
    });
  }, [
    prompt,
    slug,
    pool,
    budgetUsd,
    policy,
    programId,
    mode,
    chargedUsd,
    headline,
    detail,
    execution?.findings,
    execution?.recommendations,
  ]);

  const pkg = useMemo((): MissionBlueprintPackage => {
    const basePayees =
      pool?.nextBatchPayees?.length
        ? pool.nextBatchPayees.map((r) => ({
            label: r.label,
            owedUsd: r.owedUsd,
            source: "Authorization ledger",
          }))
        : basePkg.payees;

    const payees = applyPolicyToPayees(basePayees, policy, budgetUsd);
    return {
      ...basePkg,
      id: reportId ?? basePkg.id,
      totalCapitalUsd: budgetUsd,
      milestoneUsd: pool?.activeMilestoneUsd ?? basePkg.milestoneUsd,
      payees,
      policy,
      programId,
    };
  }, [basePkg, pool, policy, budgetUsd, reportId, programId]);

  const simulation = useMemo(() => simulateBlueprintPackage(pkg), [pkg]);
  const poolUsd = pool?.poolBalanceUsd ?? 0;
  const isAgent = mode === "agent" && chargedUsd > 0;

  function persist(status: "simulated" | "authorized", extras?: { fundTxLabel?: string }) {
    const id = pkg.id;
    setReportId(id);
    const record = createReportFromPackage(pkg, status, extras);
    saveMissionReport(record);
    return id;
  }

  function handleSimulate() {
    const id = persist("simulated");
    setSimulated(true);
    toast.success("Simulation ready", {
      description: `${simulation.clearedAuthorizations} payees · $${simulation.totalPayeeUsd.toFixed(2)}`,
      action: {
        label: "View receipt",
        onClick: () => router.push(`/mission/report/${id}`),
      },
    });
  }

  async function handleAuthorize() {
    if (!simulated) {
      toast.error("Simulate first", { description: "Dry-run the package before authorizing." });
      return;
    }
    if (!signedIn) {
      openSignIn();
      return;
    }

    setAuthorizing(true);
    try {
      const fundAmount = Math.max(5, Math.round(budgetUsd));
      let fundTxLabel: string | undefined;

      if (programId && fundAmount >= 5) {
        const res = await fetch("/api/capital/fund", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programId, amountUsd: fundAmount }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; txHash?: string; message?: string };
        if (res.ok && data.ok !== false) {
          fundTxLabel = data.txHash
            ? `Arc fund · ${data.txHash.slice(0, 10)}…`
            : (data.message ?? `Pool +$${fundAmount}`);
          toast.success("Pool funded on Arc", { description: fundTxLabel });
        } else if (res.status === 401) {
          openSignIn();
          return;
        } else {
          toast.error(data.error ?? "Fund failed", {
            description: "Package saved — open Capital to complete funding.",
          });
        }
      }

      const id = persist("authorized", { fundTxLabel });
      router.push(`/mission/report/${id}`);
    } finally {
      setAuthorizing(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.08] to-black/20 p-4"
      data-testid="mission-blueprint-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            Mission Blueprint
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">
            {pkg.communityLabel} · decision package
          </h3>
          <p className="mt-1 text-xs text-resolve-muted">
            {isAgent
              ? `Signal ${formatAgentPrice(chargedUsd)} → ${pkg.payees.length} payees auto-filled`
              : `${pkg.payees.length} payees from proof · simulate before Arc`}
          </p>
        </div>
        <div className="text-right">
          <Money amount={simulation.totalPayeeUsd} size="sm" className="text-lg text-white" />
          <p className="text-[10px] text-resolve-muted-dim">
            {Math.round(pkg.confidence * 100)}% confidence
          </p>
        </div>
      </div>

      {(headline || pkg.agentHeadline) && (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-100">
          <span className="font-medium">{headline ?? pkg.agentHeadline}</span>
          {(detail ?? pkg.agentDetail) && (
            <span className="text-emerald-200/80"> — {detail ?? pkg.agentDetail}</span>
          )}
          {receiptHref && (
            <Link
              href={receiptHref}
              className="ml-2 inline-flex items-center gap-1 text-resolve-accent hover:underline"
            >
              <Receipt className="h-3 w-3" />
              Signal receipt
            </Link>
          )}
        </div>
      )}

      {pkg.findings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {pkg.findings.slice(0, 3).map((f) => (
            <li key={f} className="flex gap-2 text-[11px] text-resolve-muted">
              <span className="text-resolve-accent">•</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Allocation policy</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MISSION_POLICY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPolicy(opt.id);
                setSimulated(false);
              }}
              className={clsx(
                "rounded-lg border px-2.5 py-1.5 text-[11px] transition",
                policy === opt.id
                  ? "border-violet-400/40 bg-violet-500/15 text-white"
                  : "border-white/[0.08] text-resolve-muted hover:border-white/20",
              )}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

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
            className="mt-1 block w-44 accent-violet-400"
          />
          <span className="mt-0.5 block text-sm font-semibold tabular-nums text-white">
            ${budgetUsd.toLocaleString()}
          </span>
        </label>
        {poolLoading ? (
          <span className="flex items-center gap-1.5 text-[11px] text-resolve-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Syncing pool…
          </span>
        ) : (
          <div className="min-w-[140px] flex-1">
            <p className="text-[10px] text-resolve-muted-dim">Communal pool (context)</p>
            <Money amount={poolUsd} size="sm" className="text-white" />
            {pool?.owedToCreatorsUsd != null && pool.owedToCreatorsUsd > 0 && (
              <p className="text-[10px] text-amber-200/90">
                ${pool.owedToCreatorsUsd.toFixed(0)} owed to creators
              </p>
            )}
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
              <tr key={`${p.label}-${p.owedUsd}`} className="text-resolve-muted">
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
        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-xs text-emerald-100">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Simulated · no funds moved
          </p>
          <p className="mt-1">
            {simulation.clearedAuthorizations} authorizations · ${simulation.totalPayeeUsd.toFixed(2)}{" "}
            allocated
            {simulation.checkpointReached && " · checkpoint reachable"}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={handleSimulate}>
          <LineChart className="h-3.5 w-3.5" />
          Simulate
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={authorizing || !simulated}
          onClick={() => void handleAuthorize()}
        >
          {authorizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          Authorize
        </Button>
        {reportId && (
          <Link
            href={`/mission/report/${reportId}`}
            className="inline-flex items-center gap-1 self-center text-[11px] font-medium text-resolve-accent hover:underline"
          >
            Mission receipt
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-resolve-muted-dim">{pkg.rationale}</p>
    </section>
  );
}
