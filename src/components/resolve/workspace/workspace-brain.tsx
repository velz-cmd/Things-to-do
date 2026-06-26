"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GitBranch, Sparkles } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { AnalysisProgress } from "@/components/resolve/workspace/analysis-progress";
import { AnalysisActivityFeed } from "@/components/resolve/workspace/analysis-activity-feed";
import { ContributorBreakdown } from "@/components/resolve/workspace/contributor-breakdown";
import { FounderPriorities } from "@/components/resolve/workspace/founder-priorities";
import { WorkspaceOpportunities } from "@/components/resolve/workspace/workspace-opportunities";
import { WorkspaceRoles } from "@/components/resolve/workspace/workspace-roles";
import { IntegrationsPanel } from "@/components/resolve/workspace/integrations-panel";
import { PaymentSummary } from "@/components/resolve/payment/payment-summary";
import { SettlementReceipt } from "@/components/resolve/missions/settlement-receipt";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import {
  intentForPreset,
  type FounderPresetId,
} from "@/lib/workspace/founder-presets";
import type { GitHubAllocationResult } from "@/lib/github/types";
import type { PaymentPreview } from "@/lib/payment/preview";
import type { SettlementResult } from "@/lib/payment/types";
import { explorerUrlForTx, isOnChainTxHash } from "@/lib/payment/tx-utils";

type Phase = "input" | "analyzing" | "results" | "preview" | "complete";

export function WorkspaceBrain() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();

  const [repoInput, setRepoInput] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [fundPoolUsd, setFundPoolUsd] = useState(10_000);
  const [preset, setPreset] = useState<FounderPresetId>("balanced");
  const [phase, setPhase] = useState<Phase>("input");
  const [loading, setLoading] = useState(false);
  const [allocation, setAllocation] = useState<GitHubAllocationResult | null>(null);
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [authorizedUsd, setAuthorizedUsd] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const qOwner = params.get("owner");
    const qRepo = params.get("repo");
    if (qOwner && qRepo) {
      setOwner(qOwner);
      setRepo(qRepo);
      setRepoInput(`${qOwner}/${qRepo}`);
    }
  }, [params]);

  const aiSummary = useMemo(() => {
    if (!allocation) return null;
    const top = [...allocation.contributors].sort((a, b) => b.sharePercent - a.sharePercent);
    const topThreeShare = top.slice(0, 3).reduce((s, c) => s + c.sharePercent, 0);
    const prCount = allocation.contributors.reduce((s, c) => s + c.prCount, 0);
    const underpaid =
      top[0] && allocation.repoHealth.fundingGapUsd > allocation.fundPoolUsd ?
        top[0].login
      : null;

    let message = `I analyzed ${prCount} pull requests across the last ${allocation.evaluationDays} days. `;
    message += `I found ${allocation.contributors.length} contributors who created ${Math.round(topThreeShare)}% of the project's measurable value.`;
    if (underpaid) {
      message += ` @${underpaid} appears underpaid relative to their impact.`;
    }
    message += " Authorizations are recorded — settlement is pending funding until you fulfill.";
    return message;
  }, [allocation]);

  const runAnalysis = useCallback(async () => {
    if (!ready) {
      openSignIn();
      return;
    }

    const parsed = parseRepoInput(repoInput) ?? (owner && repo ? { owner, repo } : null);
    if (!parsed) {
      toast.error("Enter a repository like owner/repo or a GitHub URL");
      return;
    }

    setOwner(parsed.owner);
    setRepo(parsed.repo);
    setPhase("analyzing");
    setLoading(true);
    setAllocation(null);
    setPreview(null);
    setResult(null);

    router.replace(`/workspace?owner=${parsed.owner}&repo=${parsed.repo}`, { scroll: false });

    try {
      await fetch("/api/treasury", { method: "POST" });
      const res = await fetch("/api/github/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: parsed.owner,
          repo: parsed.repo,
          fundPoolUsd,
          evaluationDays: 30,
          founderIntent: intentForPreset(preset),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      await new Promise((r) => setTimeout(r, 3200));
      const { missionId: mid, authorization, pipeline, ...allocationData } = data;
      setAllocation(allocationData as GitHubAllocationResult);
      setMissionId(mid ?? null);
      setAuthorizedUsd(authorization?.totalUsd ?? allocationData.fundPoolUsd ?? 0);
      setPhase("results");
      toast.success(authorization?.message ?? "Analysis complete");
    } catch (e) {
      setPhase("input");
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [ready, openSignIn, repoInput, owner, repo, fundPoolUsd, preset, router]);

  const autoRan = useRef(false);
  useEffect(() => {
    const qOwner = params.get("owner");
    const qRepo = params.get("repo");
    if (params.get("autostart") === "0") return;
    if (!qOwner || !qRepo || autoRan.current || phase !== "input") return;
    autoRan.current = true;
    void runAnalysis();
  }, [params, phase, runAnalysis]);

  async function loadPreview() {
    if (!allocation) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ allocation, missionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
      setPhase("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function approveSettlement() {
    if (!allocation) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payment/from-allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation, execute: true, missionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Settlement failed");
      setResult(data);
      setAllocation(null);
      setPreview(null);
      setPhase("complete");
      toast.success(data.status === "SETTLED" ? "Funds distributed" : "Settlement recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settlement failed");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPhase("input");
    setAllocation(null);
    setPreview(null);
    setResult(null);
    setMissionId(null);
    setAuthorizedUsd(0);
    setRepoInput("");
    setOwner("");
    setRepo("");
    router.replace("/workspace", { scroll: false });
  }

  function selectOpportunity(selectedOwner: string, selectedRepo: string) {
    setOwner(selectedOwner);
    setRepo(selectedRepo);
    setRepoInput(`${selectedOwner}/${selectedRepo}`);
    router.replace(`/workspace?owner=${selectedOwner}&repo=${selectedRepo}`, { scroll: false });
    autoRan.current = true;
    void runAnalysis();
  }

  if (phase === "complete" && result) {
    const txHash = result.proof?.txHashes?.find(isOnChainTxHash) ?? result.proof?.txHashes?.[0];
    const explorerUrl = result.explorerUrls?.[0] ?? explorerUrlForTx(txHash);
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <SettlementReceipt
          title="Funding distributed"
          amountUsd={result.plan.contributorTotal}
          payeeCount={result.plan.intents.length}
          eventCount={result.nanoPayments.length}
          txHash={txHash}
          explorerUrl={explorerUrl}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Analyze another repository
          </button>
          <a
            href="/payments"
            className="rounded-md border border-resolve-border px-4 py-2 text-sm text-resolve-muted hover:text-white"
          >
            View payments
          </a>
        </div>
      </div>
    );
  }

  if (phase === "preview" && preview) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <PaymentSummary
          preview={preview}
          onApprove={approveSettlement}
          onBack={() => setPhase("results")}
          approving={loading}
        />
      </div>
    );
  }

  if (phase === "results" && allocation) {
    const health = allocation.repoHealth;
    const topCount = allocation.contributors.filter((c) => c.sharePercent >= 5).length;

    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Panel className="border-resolve-accent/20 bg-resolve-accent/5 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-resolve-accent" />
            <p className="text-sm leading-relaxed text-white/90">{aiSummary}</p>
          </div>
        </Panel>

        <Panel className="border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            Authorized — settlement pending funding
          </p>
          <p className="mt-1 text-sm text-white">
            <Money amount={authorizedUsd} size="sm" className="inline" /> owed across{" "}
            {allocation.contributors.length} contributors
          </p>
          <p className="mt-1 text-xs text-resolve-muted">
            Economic facts are recorded. Fulfill settlement when treasury is ready.
            {missionId && (
              <span className="block font-mono text-[10px] text-resolve-muted-dim mt-1">
                {missionId}
              </span>
            )}
          </p>
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-4 w-4 text-resolve-accent" />
            <h2 className="text-lg font-semibold text-white">
              {allocation.owner}/{allocation.repo}
            </h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Health" value={health.grade} />
            <Stat
              label="Funding gap"
              value={`$${health.fundingGapUsd.toLocaleString()}`}
              warn={health.fundingGapUsd > 10_000}
            />
            <Stat label="High-impact contributors" value={String(topCount)} />
            <Stat
              label="Recommended treasury"
              value={<Money amount={allocation.fundPoolUsd} size="sm" />}
            />
          </div>
          <p className="mt-3 text-xs text-resolve-muted">{health.headline}</p>
        </Panel>

        <ContributorBreakdown
          contributors={allocation.contributors}
          fundPoolUsd={allocation.fundPoolUsd}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="rounded-md bg-resolve-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Preparing…" : "Fulfill settlement"}
          </button>
          <button
            type="button"
            onClick={() => setPhase("input")}
            className="rounded-md border border-resolve-border px-5 py-2.5 text-sm text-resolve-muted hover:text-white"
          >
            Change repository
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-resolve-muted hover:text-white"
        >
          {showAdvanced ? "▼ Hide" : "▶ Why?"} technical evidence
        </button>

        {showAdvanced && (
          <Panel className="p-4 text-xs text-resolve-muted">
            <p className="font-mono text-[10px] text-white/60">
              Proof {allocation.weightProofHash.slice(0, 20)}…
            </p>
            <ul className="mt-2 space-y-1">
              {health.signals.map((s) => (
                <li key={s.label}>
                  {s.label}: {s.value}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Workspace</h1>
        <p className="mt-1 text-sm text-resolve-muted">
          Paste a GitHub repository. RESOLVE discovers who created value, proves it with evidence,
          and prepares capital allocation.
        </p>
      </div>

      <WorkspaceRoles />

      <Panel className="p-5">
        <label className="text-sm font-medium text-white" htmlFor="repo-input">
          GitHub repository
        </label>
        <input
          id="repo-input"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runAnalysis()}
          placeholder="github.com/owner/repository or owner/repository"
          className="mt-2 w-full rounded-lg border border-resolve-border bg-resolve-bg px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent focus:outline-none"
        />

        <div className="mt-4">
          <label className="text-xs text-resolve-muted">Treasury amount (USDC)</label>
          <input
            type="number"
            min={100}
            step={500}
            value={fundPoolUsd}
            onChange={(e) => setFundPoolUsd(Number(e.target.value))}
            className="mt-1 w-full max-w-xs rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-sm text-white"
          />
        </div>

        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={loading || phase === "analyzing"}
          className="mt-4 w-full rounded-md bg-resolve-accent py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 sm:w-auto sm:px-8"
        >
          Analyze
        </button>
      </Panel>

      <FounderPriorities value={preset} onChange={setPreset} />

      <WorkspaceOpportunities onSelect={selectOpportunity} />

      <IntegrationsPanel />

      {phase === "analyzing" && (
        <>
          <AnalysisProgress active />
          <AnalysisActivityFeed active />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-resolve-border bg-resolve-bg/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-resolve-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${warn ? "text-amber-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
