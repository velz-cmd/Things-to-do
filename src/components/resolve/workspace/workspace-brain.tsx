"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { GitBranch, Sparkles } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { AnalysisProgress } from "@/components/resolve/workspace/analysis-progress";
import { ContributorBreakdown } from "@/components/resolve/workspace/contributor-breakdown";
import { FounderPriorities } from "@/components/resolve/workspace/founder-priorities";
import { WorkspaceOpportunities } from "@/components/resolve/workspace/workspace-opportunities";
import { WorkspaceShell } from "@/components/resolve/workspace/workspace-shell";
import {
  WorkspaceSidebar,
  saveRecentWorkspace,
  type RecentWorkspace,
} from "@/components/resolve/workspace/workspace-sidebar";
import { WorkspaceActivityPanel } from "@/components/resolve/workspace/workspace-activity-panel";
import { WorkspaceOsDashboard } from "@/components/resolve/workspace/workspace-os-dashboard";
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
  const [apiComplete, setApiComplete] = useState(false);
  const [allocation, setAllocation] = useState<GitHubAllocationResult | null>(null);
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [authorizedUsd, setAuthorizedUsd] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [liveMessages, setLiveMessages] = useState<string[]>([]);

  const workspaceId = owner && repo ? `${owner}/${repo}` : null;

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

    let message = `Found ${allocation.contributors.length} contributors across ${prCount} pull requests. `;
    message += `The top three account for ${Math.round(topThreeShare)}% of measurable value in the last ${allocation.evaluationDays} days.`;
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
    setApiComplete(false);
    setAllocation(null);
    setPreview(null);
    setResult(null);
    setLiveMessages(["Scanning repository…"]);

    router.replace(`/workspace?owner=${parsed.owner}&repo=${parsed.repo}`, { scroll: false });

    try {
      await fetch("/api/treasury", { method: "POST" });
      setLiveMessages((m) => [...m, "Running attribution pipeline…"]);

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

      const { missionId: mid, authorization, pipeline, ...allocationData } = data;
      const alloc = allocationData as GitHubAllocationResult;

      setLiveMessages([
        `Evidence collected: ${pipeline?.evidenceCount ?? 0} items`,
        `${alloc.contributors.length} contributors identified`,
        `Authorizations recorded: $${(authorization?.totalUsd ?? alloc.fundPoolUsd).toLocaleString()}`,
      ]);

      saveRecentWorkspace({
        id: `${parsed.owner}/${parsed.repo}`,
        label: `${parsed.owner}/${parsed.repo}`,
        type: "github",
        owner: parsed.owner,
        repo: parsed.repo,
      });

      setApiComplete(true);
      setAllocation(alloc);
      setMissionId(mid ?? null);
      setAuthorizedUsd(authorization?.totalUsd ?? alloc.fundPoolUsd ?? 0);
      setPhase("results");
      toast.success("Analysis complete");
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
    setLiveMessages((m) => [...m, "Preparing fulfillment preview…"]);
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
    setLiveMessages((m) => [...m, "Running settlement batch…"]);
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
    setLiveMessages([]);
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

  function handleSidebarSelect(w: RecentWorkspace) {
    if (w.owner && w.repo) {
      setRepoInput(`${w.owner}/${w.repo}`);
      router.replace(`/workspace?owner=${w.owner}&repo=${w.repo}`, { scroll: false });
      autoRan.current = true;
      void runAnalysis();
    }
  }

  const shell = (content: React.ReactNode) => (
    <WorkspaceShell
      sidebar={
        <WorkspaceSidebar activeId={workspaceId} onSelect={handleSidebarSelect} />
      }
      main={content}
      activity={
        <WorkspaceActivityPanel phase={phase} liveMessages={liveMessages} />
      }
    />
  );

  if (phase === "complete" && result) {
    const txHash = result.proof?.txHashes?.find(isOnChainTxHash) ?? result.proof?.txHashes?.[0];
    const explorerUrl = result.explorerUrls?.[0] ?? explorerUrlForTx(txHash);
    return shell(
      <div className="mx-auto max-w-2xl space-y-4">
        <SettlementReceipt
          title="Fulfillment complete"
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
            New workspace
          </button>
          <Link
            href="/payments"
            className="rounded-md border border-resolve-border px-4 py-2 text-sm text-resolve-muted hover:text-white"
          >
            View payments
          </Link>
        </div>
      </div>,
    );
  }

  if (phase === "preview" && preview) {
    return shell(
      <div className="mx-auto max-w-2xl">
        <PaymentSummary
          preview={preview}
          onApprove={approveSettlement}
          onBack={() => setPhase("results")}
          approving={loading}
        />
      </div>,
    );
  }

  if (phase === "results" && allocation) {
    const health = allocation.repoHealth;

    return shell(
      <div className="mx-auto max-w-3xl space-y-4">
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
            <Money amount={authorizedUsd} size="sm" className="inline" /> across{" "}
            {allocation.contributors.length} contributors
          </p>
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-4 w-4 text-resolve-accent" />
            <h2 className="text-lg font-semibold text-white">
              {allocation.owner}/{allocation.repo}
            </h2>
          </div>
          <p className="mt-2 text-sm text-resolve-muted">{health.headline}</p>
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
            Change source
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-resolve-muted hover:text-white"
        >
          {showAdvanced ? "Hide" : "Why?"}
        </button>

        {showAdvanced && (
          <Panel className="p-4 text-xs text-resolve-muted">
            <p className="font-mono text-[10px] text-white/60">
              Proof {allocation.weightProofHash.slice(0, 24)}…
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Stat label="Health grade" value={health.grade} />
              <Stat
                label="Funding gap"
                value={`$${health.fundingGapUsd.toLocaleString()}`}
              />
            </div>
            <ul className="mt-3 space-y-1">
              {health.signals.map((s) => (
                <li key={s.label}>
                  {s.label}: {s.value}
                </li>
              ))}
            </ul>
            {allocation.contributors[0] && (
              <div className="mt-3 border-t border-resolve-border pt-3">
                <p className="text-white/80">Sample evidence (@{allocation.contributors[0].login})</p>
                <ul className="mt-1 space-y-0.5">
                  {(allocation.contributors[0].topEvidence ?? []).slice(0, 4).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        )}
      </div>,
    );
  }

  return shell(
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Workspace</h1>
        <p className="mt-1 text-sm text-resolve-muted">
          Show me where value is being created and where money should flow.
        </p>
      </div>

      <WorkspaceOsDashboard />

      <Panel className="p-5">
        <label className="text-sm font-medium text-white" htmlFor="repo-input">
          Add a source
        </label>
        <p className="mt-0.5 text-xs text-resolve-muted">
          Paste any repository or project — connectors stay invisible behind universal events.
        </p>
        <input
          id="repo-input"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runAnalysis()}
          placeholder="owner/repository or github.com/owner/repo"
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
          {phase === "analyzing" ? "Analyzing…" : "Analyze"}
        </button>
      </Panel>

      <FounderPriorities value={preset} onChange={setPreset} />
      <WorkspaceOpportunities onSelect={selectOpportunity} />

      {phase === "analyzing" && (
        <AnalysisProgress active apiComplete={apiComplete} />
      )}
    </div>,
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-resolve-muted-dim">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}
