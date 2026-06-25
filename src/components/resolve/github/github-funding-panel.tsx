"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, GitBranch, Shield, Target } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { ImpactBreakdown } from "@/components/resolve/weight/impact-breakdown";
import { SettlementReceipt } from "@/components/resolve/missions/settlement-receipt";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import type { ContributorWeight } from "@/lib/weight/types";
import type { GitHubAllocationResult } from "@/lib/github/types";
import { DEFAULT_FOUNDER_INTENT } from "@/lib/github/types";
import { explorerUrlForTx, isOnChainTxHash } from "@/lib/payment/tx-utils";
import type { SettlementResult } from "@/lib/payment/types";
import type { PaymentPreview } from "@/lib/payment/preview";
import { PaymentPreviewPanel } from "@/components/resolve/payment/payment-preview";

function toContributorWeights(allocation: GitHubAllocationResult): ContributorWeight[] {
  return allocation.contributors.map((c) => ({
    payeeKey: c.login,
    payeeName: `@${c.login}`,
    wallet: null,
    totalWeight: c.totalWeight,
    sharePercent: c.sharePercent,
    payoutUsd: c.payoutUsd,
    eventCount: c.prCount,
    topRationale: c.topEvidence[0] ?? `Trust ${c.trustScore}/100`,
    events: c.verdicts.map((v) => ({
      eventId: `pr-${v.prNumber}`,
      type: "github_pr_merged",
      platformId: v.author,
      payeeKey: c.login,
      payeeName: `@${c.login}`,
      verified: v.status === "verified",
      impactScore: v.finalWeight,
      signals: [],
      rationale: v.evidence.join(" · "),
      rawAmountUsd: 0,
    })),
  }));
}

export function GitHubFundingPanel({
  initialOwner,
  initialRepo,
  embedded,
}: {
  initialOwner?: string;
  initialRepo?: string;
  embedded?: boolean;
}) {
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [owner, setOwner] = useState(initialOwner ?? "navidrome");
  const [repo, setRepo] = useState(initialRepo ?? "navidrome");
  const [fundPoolUsd, setFundPoolUsd] = useState(10000);
  const [evaluationDays, setEvaluationDays] = useState(30);
  const [intent, setIntent] = useState(DEFAULT_FOUNDER_INTENT);
  const [loading, setLoading] = useState(false);
  const [allocation, setAllocation] = useState<GitHubAllocationResult | null>(null);
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);

  async function analyzeAndAllocate() {
    if (!ready) {
      openSignIn();
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/treasury", { method: "POST" });
      const res = await fetch("/api/github/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          fundPoolUsd,
          evaluationDays,
          founderIntent: intent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Allocation failed");
      setAllocation(data);
      toast.success(`Weighted ${data.contributors.length} contributors from live GitHub data`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    if (!allocation) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ allocation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function settleArc() {
    if (!allocation) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payment/from-allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocation,
          execute: true,
          agentsRun: [
            "identity_worker",
            "repository_worker",
            "pr_worker",
            "code_worker",
            "collaboration_worker",
            "impact_worker",
            "reputation_worker",
            "ecosystem_worker",
            "reasoning_engine",
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Settlement failed");
      }
      setResult(data);
      setAllocation(null);
      setPreview(null);
      const pending = data.pendingRewards?.length ?? 0;
      toast.success(
        data.status === "SETTLED" ?
          `Settled on Arc${pending ? ` · ${pending} rewards sent to claim portal` : ""}`
        : pending ?
          `Escrow locked · ${pending} contributors can claim via /claim`
        : "Settlement recorded",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settlement failed");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const txHash = result.proof?.txHashes?.find(isOnChainTxHash) ?? result.proof?.txHashes?.[0];
    const explorerUrl = result.explorerUrls?.[0] ?? explorerUrlForTx(txHash);
    return (
      <div className={embedded ? "p-3" : "p-6"}>
        <SettlementReceipt
          title="Arc batch settlement with memos"
          amountUsd={result.plan.contributorTotal}
          payeeCount={result.plan.intents.length}
          eventCount={result.nanoPayments.length}
          txHash={txHash}
          explorerUrl={explorerUrl}
        />
        <Panel className="mt-3 p-3 text-xs text-resolve-muted">
          <p>
            Settlement <span className="font-mono text-white">{result.settlementId}</span> · Batch{" "}
            {result.proof?.batchNumber} · Status {result.status}
          </p>
          <p className="mt-1">
            Agent nano payments: ${result.plan.agentNanoTotal.toFixed(2)} · Proof{" "}
            <span className="font-mono">{result.plan.proofHash.slice(0, 14)}…</span>
          </p>
          {result.failedWallets.length > 0 && (
            <p className="mt-1 text-amber-400">
              Failed wallets: {result.failedWallets.join(", ")} — retry via payment API
            </p>
          )}
          {result.pendingRewards && result.pendingRewards.length > 0 && (
            <p className="mt-1 text-violet-300">
              {result.pendingRewards.length} rewards in claim portal — contributors visit /claim
            </p>
          )}
        </Panel>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-3 text-xs text-resolve-accent hover:underline"
        >
          New funding pool
        </button>
      </div>
    );
  }

  if (preview && allocation) {
    return (
      <div className={embedded ? "p-3" : "mx-auto max-w-4xl px-6 py-6 space-y-4"}>
        <PaymentPreviewPanel
          preview={preview}
          onApprove={settleArc}
          onBack={() => setPreview(null)}
          approving={loading}
        />
      </div>
    );
  }

  if (allocation) {
    return (
      <div className={embedded ? "p-3" : "mx-auto max-w-4xl px-6 py-6 space-y-4"}>
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-4 w-4 text-white" />
            <p className="font-medium text-white">
              {allocation.owner}/{allocation.repo}
            </p>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
              Health {allocation.repoHealth.grade} · {allocation.repoHealth.score}/100
            </span>
          </div>
          <p className="mt-1 text-xs text-resolve-muted">{allocation.repoHealth.headline}</p>
        </Panel>

        <Panel className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            Transparency — evidence per payout
          </p>
          <ul className="mt-3 space-y-3">
            {allocation.transparency.map((t) => (
              <li key={t.login} className="rounded border border-resolve-border bg-resolve-bg/50 p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <p className="font-medium text-white">@{t.login}</p>
                  <Money amount={t.payoutUsd} size="sm" />
                </div>
                <ul className="mt-2 space-y-1 text-resolve-muted">
                  {t.evidence.map((e, i) => (
                    <li key={i}>· {e}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>

        <ImpactBreakdown
          fundPoolUsd={allocation.fundPoolUsd}
          contributors={toContributorWeights(allocation)}
          weightProofHash={allocation.weightProofHash}
          onSettle={loadPreview}
          settling={loading}
          settleLabel="Review payment preview"
        />
        <button
          type="button"
          onClick={() => setAllocation(null)}
          className="text-xs text-resolve-muted hover:text-white"
        >
          ← Back to funding pool setup
        </button>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-3 p-3" : "mx-auto max-w-4xl space-y-4 px-6 py-6"}>
      {!embedded && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            GitHub Phase 1 · Capital Flow
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">
            Connect repo · deposit USDC · prove who created value
          </h1>
          <p className="mt-1 text-xs text-resolve-muted">
            RESOLVE ingests PRs, reviews, and diffs. Sybil Shield + Weight Council score impact.
            Founder intent steers allocation. Every payout has evidence.
          </p>
        </div>
      )}

      <Panel className="p-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-resolve-accent" />
          <p className="text-xs font-medium text-white">Repository</p>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="owner"
            className="w-1/3 rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-sm text-white"
          />
          <span className="self-center text-resolve-muted">/</span>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="repo"
            className="flex-1 rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-sm text-white"
          />
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="p-4">
          <label className="text-xs font-medium text-white">Funding pool (USDC)</label>
          <input
            type="number"
            min={100}
            step={100}
            value={fundPoolUsd}
            onChange={(e) => setFundPoolUsd(Number(e.target.value))}
            className="mt-1 w-full rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-sm text-white"
          />
        </Panel>
        <Panel className="p-4">
          <label className="text-xs font-medium text-white">Evaluation period (days)</label>
          <input
            type="number"
            min={7}
            max={90}
            value={evaluationDays}
            onChange={(e) => setEvaluationDays(Number(e.target.value))}
            className="mt-1 w-full rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-sm text-white"
          />
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-medium text-white">Founder intent — where should money flow?</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.keys(intent) as (keyof typeof intent)[]).map((key) => (
            <label key={key} className="flex items-center justify-between gap-2 text-xs">
              <span className="capitalize text-resolve-muted">{key}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={intent[key]}
                onChange={(e) =>
                  setIntent((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="w-16 rounded border border-resolve-border bg-resolve-bg px-2 py-1 text-right text-white"
              />
            </label>
          ))}
        </div>
      </Panel>

      <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] text-resolve-muted">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p>
          Sybil-resistant, evidence-based attribution — not activity counting.
          Trust scores filter bots before the Weight Council runs.
        </p>
      </div>

      <button
        type="button"
        onClick={analyzeAndAllocate}
        disabled={loading || !owner || !repo}
        className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "Ingesting GitHub + scoring impact…" : "Analyze impact & compute split"}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
