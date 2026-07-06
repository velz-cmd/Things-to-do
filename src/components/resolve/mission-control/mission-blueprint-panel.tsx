"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
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
import {
  poolCacheKey,
  readPoolCache,
  writePoolCache,
} from "@/lib/capital/pool-cache";
import { prefetchMissionPool } from "@/lib/mission/prefetch-mission-pool";
import {
  computeFundCheckpointLabel,
  formatAgentAttributionLine,
} from "@/lib/mission/mission-checkpoint-math";
import { downloadBlueprintJson, downloadDaoProposal } from "@/lib/mission/mission-blueprint-export";
import { useMissionBlueprintCommand } from "@/components/resolve/mission-control/mission-blueprint-command-context";
import type { BlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";
import {
  authorizeBlueprintServer,
  fetchMissionMemory,
  persistMissionReportServer,
  prepareBlueprintSettlement,
} from "@/lib/mission/mission-report-api";
import {
  capitalHandoffFromBlueprint,
  communitiesInstallHandoff,
  profileClaimHandoff,
} from "@/lib/mission/mission-handoff";
import { ArcTxLink } from "@/components/resolve/ui/arc-tx-link";
import { useFundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import { PayFromWalletSection } from "@/components/resolve/fund/pay-from-wallet-section";
import { fundingSourceLabel } from "@/lib/wallet/funding-source";

type AgentExecution = {
  findings?: string[];
  recommendations?: string[];
};

export type MissionBlueprintPanelHandle = {
  simulate: () => void;
  authorize: () => Promise<void>;
  exportBlueprint: () => void;
  cyclePolicy: () => void;
  state: {
    simulated: boolean;
    policyLabel: string;
    authorizing: boolean;
  };
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
  /** When true, inline action buttons are hidden — workspace command bar drives actions. */
  commandBarMode?: boolean;
  registerCommand?: boolean;
};

export const MissionBlueprintPanel = forwardRef<
  MissionBlueprintPanelHandle,
  MissionBlueprintPanelProps
>(function MissionBlueprintPanel(
  {
    prompt,
    mode = "scope",
    chargedUsd = 0,
    headline,
    detail,
    execution,
    receiptHref,
    communitySlug: communitySlugProp,
    initialBudgetUsd,
    commandBarMode = true,
    registerCommand = true,
  },
  ref,
) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const signedIn = Boolean(user);
  const blueprintCommand = useMissionBlueprintCommand();

  const [pool, setPool] = useState<ProgramPoolState | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [payeeSource, setPayeeSource] = useState<"ledger" | "preview">("preview");
  const [policy, setPolicy] = useState<MissionBlueprintPolicyId>("balanced");
  const [budgetUsd, setBudgetUsd] = useState(initialBudgetUsd ?? 500);
  const [simulated, setSimulated] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [settlementPreview, setSettlementPreview] = useState<BlueprintSettlementPreview | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [memoryLine, setMemoryLine] = useState<string | null>(null);
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);

  const slug =
    communitySlugProp ??
    resolveMissionCommunitySlug({ scopeLabel: prompt, topicName: prompt }) ??
    "react";

  const fundAmount = Math.max(5, Math.round(budgetUsd));
  const walletChoice = useFundingWalletChoice(fundAmount);
  const { executeFund } = useFundProgramExecution(slug);

  const cacheKey = poolCacheKey(slug, null);

  const loadPool = useCallback(async () => {
    const cached = readPoolCache(cacheKey);
    if (cached) {
      setPool(cached);
      setProgramId(cached.programId ?? null);
      if (cached.nextBatchPayees?.length) setPayeeSource("ledger");
      if (cached.activeMilestoneUsd) {
        setBudgetUsd((prev) => initialBudgetUsd ?? Math.max(prev, cached.activeMilestoneUsd));
      }
      setPoolLoading(false);
    }

    const snapshot = await prefetchMissionPool(slug);
    if (snapshot.pool) {
      setPool(snapshot.pool);
      setProgramId(snapshot.programId ?? snapshot.pool.programId ?? null);
      if (snapshot.pool.nextBatchPayees?.length) setPayeeSource("ledger");
      if (snapshot.pool.activeMilestoneUsd) {
        setBudgetUsd((prev) => initialBudgetUsd ?? Math.max(prev, snapshot.pool!.activeMilestoneUsd));
      }
      writePoolCache(cacheKey, snapshot.pool);
    } else if (!cached) {
      setPool(null);
      setProgramId(snapshot.programId);
    }
    setPoolLoading(false);
  }, [slug, cacheKey, initialBudgetUsd]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  useEffect(() => {
    void fetchMissionMemory(slug).then((m) => setMemoryLine(m.line));
  }, [slug]);

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
    return buildMissionBlueprintFromScope({ ...common });
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

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    void prepareBlueprintSettlement(pkg).then((preview) => {
      if (!cancelled) {
        setSettlementPreview(preview);
        setPreviewLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pkg]);

  const simulation = useMemo(() => simulateBlueprintPackage(pkg), [pkg]);
  const poolUsd = pool?.poolBalanceUsd ?? 0;
  const isAgent = mode === "agent" && chargedUsd > 0;

  const checkpoint = useMemo(
    () =>
      computeFundCheckpointLabel({
        fundUsd: budgetUsd,
        payees: pkg.payees,
        poolBalanceUsd: poolUsd,
        milestoneUsd: pkg.milestoneUsd,
      }),
    [budgetUsd, pkg.payees, poolUsd, pkg.milestoneUsd],
  );

  const attributionLine = useMemo(() => {
    if (!isAgent) return null;
    return formatAgentAttributionLine(
      chargedUsd,
      pkg.payees.length,
      budgetUsd,
      formatAgentPrice,
    );
  }, [isAgent, chargedUsd, pkg.payees.length, budgetUsd]);

  const policyLabel =
    MISSION_POLICY_OPTIONS.find((o) => o.id === policy)?.label ?? "Balanced";

  const handleSimulate = useCallback(() => {
    const id = pkg.id;
    setReportId(id);
    const record = createReportFromPackage(pkg, "simulated");
    saveMissionReport(record);
    void persistMissionReportServer({ record, programId });
    setSimulated(true);
    toast.success("Simulation ready", {
      description: `${simulation.clearedAuthorizations} payees · $${simulation.totalPayeeUsd.toFixed(2)}`,
      action: {
        label: "View receipt",
        onClick: () => router.push(`/mission/report/${id}`),
      },
    });
  }, [pkg, simulation.clearedAuthorizations, simulation.totalPayeeUsd, router, programId]);

  const handleAuthorize = useCallback(async () => {
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
      let skipFund = false;
      try {
        const source = walletChoice.assertFundingSource();
        if (source === "external" && programId) {
          await executeFund(
            {
              programId,
              amountUsd: fundAmount,
              communitySlug: slug,
              label: pkg.communityLabel,
            },
            source,
          );
          skipFund = true;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Pick a wallet to pay from");
        return;
      }

      const result = await authorizeBlueprintServer({
        pkg: { ...pkg, programId },
        amountUsd: fundAmount,
        skipFund,
      });

      if (!result.ok) {
        if (result.preview) setSettlementPreview(result.preview);
        if (result.capitalHref) {
          toast.error(result.error ?? "Could not fund on Arc", {
            description: "Open Capital with this plan pre-filled.",
            action: {
              label: "Capital",
              onClick: () => router.push(result.capitalHref!),
            },
          });
        } else {
          toast.error(result.error ?? "Authorize failed");
        }
      } else {
        if (result.preview) setSettlementPreview(result.preview);
        if (result.fundTxHash) setFundTxHash(result.fundTxHash);
        const fundTxLabel = result.fundTxLabel;
        const record = createReportFromPackage(pkg, "authorized", { fundTxLabel });
        saveMissionReport(record);
        toast.success("Authorized in Mission", {
          description: fundTxLabel
            ? `${fundTxLabel}${walletChoice.fundingSource ? ` · ${fundingSourceLabel(walletChoice.fundingSource)}` : ""}`
            : "Pool funded · receipt saved",
        });
        router.push(`/mission/report/${pkg.id}`);
      }
    } finally {
      setAuthorizing(false);
    }
  }, [simulated, signedIn, openSignIn, fundAmount, programId, pkg, router, walletChoice, executeFund, slug]);

  const handleExport = useCallback(() => {
    downloadBlueprintJson(pkg);
    downloadDaoProposal(pkg, settlementPreview ?? undefined, "snapshot");
    toast.success("Blueprint + DAO proposal exported", {
      description: "JSON files for board or Snapshot/Tally review.",
    });
  }, [pkg, settlementPreview]);

  const cyclePolicy = useCallback(() => {
    setPolicy((prev) => {
      const order: MissionBlueprintPolicyId[] = ["balanced", "growth", "infrastructure"];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length]!;
    });
    setSimulated(false);
  }, []);

  const imperativeRef = useRef<MissionBlueprintPanelHandle>({
    simulate: () => {},
    authorize: async () => {},
    exportBlueprint: () => {},
    cyclePolicy: () => {},
    state: { simulated: false, policyLabel: "Balanced", authorizing: false },
  });

  imperativeRef.current = {
    simulate: handleSimulate,
    authorize: handleAuthorize,
    exportBlueprint: handleExport,
    cyclePolicy,
    state: { simulated, policyLabel, authorizing },
  };

  useImperativeHandle(ref, () => imperativeRef.current, [
    handleSimulate,
    handleAuthorize,
    handleExport,
    cyclePolicy,
    simulated,
    policyLabel,
    authorizing,
  ]);

  useEffect(() => {
    if (!registerCommand || !blueprintCommand) return;
    blueprintCommand.register(imperativeRef.current);
    return () => blueprintCommand.register(null);
  }, [
    registerCommand,
    blueprintCommand,
    simulated,
    policyLabel,
    authorizing,
    handleSimulate,
    handleAuthorize,
    handleExport,
    cyclePolicy,
  ]);

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/90 p-4 shadow-lg shadow-black/20 sm:p-5"
      data-testid="mission-blueprint-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
            Mission Blueprint
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">
            {pkg.communityLabel} · decision package
          </h3>
          <p className="mt-1 text-xs text-resolve-muted">
            {isAgent
              ? `Signal ${formatAgentPrice(chargedUsd)} → ${pkg.payees.length} payees auto-filled`
              : `${pkg.payees.length} payees · simulate before Arc`}
          </p>
        </div>
        <div className="text-right">
          <Money amount={simulation.totalPayeeUsd} size="sm" className="text-lg text-white" />
          <p className="text-[10px] text-resolve-muted-dim">
            {Math.round(pkg.confidence * 100)}% confidence
          </p>
        </div>
      </div>

      {attributionLine && (
        <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2 text-center text-xs font-semibold tracking-wide text-emerald-100">
          {attributionLine}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/90">
        <span className="font-medium text-sky-200">{checkpoint.label}</span>
        {!poolLoading && (
          <span className="ml-2 text-[10px] text-resolve-muted-dim">
            · {payeeSource === "ledger" ? "Ledger payees" : "Cohort preview"}
            {programId ? "" : " · no programId — install rail to authorize"}
          </span>
        )}
      </div>

      {memoryLine && (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-100">
          {memoryLine}
        </p>
      )}

      {(settlementPreview || previewLoading) && (
        <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
            Settlement package preview
          </p>
          {previewLoading && !settlementPreview ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-resolve-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparing batch…
            </p>
          ) : settlementPreview ? (
            <div className="mt-1.5 space-y-1 text-[11px] text-resolve-muted">
              <p>
                Batch <span className="font-mono text-white/90">{settlementPreview.batchHash}</span>
                {" · "}
                {settlementPreview.recipientCount} recipients ·{" "}
                <span className="text-emerald-300">
                  {settlementPreview.readyCount} ready
                </span>
                {settlementPreview.pendingCount > 0 && (
                  <span> · {settlementPreview.pendingCount} claimable</span>
                )}
              </p>
              <p className="font-mono text-[10px] text-resolve-muted-dim">
                proof {settlementPreview.proofHash.slice(0, 20)}…
              </p>
            </div>
          ) : null}
        </div>
      )}

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
        {commandBarMode ? (
          <p className="text-xs text-resolve-muted">
            Policy ·{" "}
            <span className="font-medium text-white/90">{policyLabel}</span>
            <span className="text-resolve-muted-dim"> — change via command bar</span>
          </p>
        ) : (
          <>
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
                      ? "border-sky-400/40 bg-sky-500/15 text-white"
                      : "border-white/[0.08] text-resolve-muted hover:border-white/20",
                  )}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
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
            className="mt-1 block w-44 accent-sky-400"
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
            <p className="text-[10px] text-resolve-muted-dim">Pool balance</p>
            <Money amount={poolUsd} size="sm" className="text-white" />
            {pool?.owedToCreatorsUsd != null && pool.owedToCreatorsUsd > 0 && (
              <p className="text-[10px] text-amber-200/90">
                ${pool.owedToCreatorsUsd.toFixed(0)} owed to creators
              </p>
            )}
            {!commandBarMode && (
              <PoolMilestoneBar poolUsd={poolUsd} className="mt-1" compact />
            )}
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
          {fundTxHash && (
            <p className="mt-1 flex items-center gap-2">
              Arc proof <ArcTxLink txHash={fundTxHash} />
            </p>
          )}
        </div>
      )}

      {simulated && signedIn && (
        <PayFromWalletSection
          amountUsd={fundAmount}
          disabled={authorizing}
          choice={walletChoice}
          className="mt-4"
        />
      )}

      <details className="mt-4 text-[10px]">
        <summary className="cursor-pointer text-resolve-muted hover:text-white">
          Handoffs · Capital · Install · Claim
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {!programId && (
            <Link
              href={communitiesInstallHandoff(slug)}
              className="rounded-lg border border-white/10 px-2 py-1 text-resolve-accent hover:underline"
            >
              Install program rail
            </Link>
          )}
          <Link
            href={capitalHandoffFromBlueprint(pkg)}
            className="rounded-lg border border-white/10 px-2 py-1 text-resolve-accent hover:underline"
          >
            Open Capital (prefilled)
          </Link>
          <Link
            href={profileClaimHandoff()}
            className="rounded-lg border border-white/10 px-2 py-1 text-resolve-muted hover:text-white"
          >
            Claim earnings
          </Link>
        </div>
      </details>

      {!commandBarMode && (
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
      )}

      {commandBarMode && reportId && (
        <Link
          href={`/mission/report/${reportId}`}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-resolve-accent hover:underline"
        >
          Mission receipt
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-resolve-muted-dim">{pkg.rationale}</p>
    </section>
  );
});
