"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { SettlementReceipt } from "@/components/resolve/missions/settlement-receipt";

const ImpactBreakdown = dynamic(
  () =>
    import("@/components/resolve/weight/impact-breakdown").then(
      (m) => m.ImpactBreakdown,
    ),
  { loading: () => <div className="h-24 animate-pulse rounded-lg bg-white/[0.03]" /> },
);
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { DEMO_DISTRIBUTION_CSV } from "@/lib/treasury/demo-data";
import { parseCsvEvents } from "@/lib/treasury/csv";
import { evaluationToDistributionEvents } from "@/lib/weight/evaluate";
import type { DistributeResult } from "@/lib/gateway/types";
import type { ImpactEvaluation } from "@/lib/weight/types";

export function DistributePanel({ embedded }: { embedded?: boolean }) {
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [csv, setCsv] = useState("");
  const [fundPoolUsd, setFundPoolUsd] = useState(50);
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<ImpactEvaluation | null>(null);
  const [result, setResult] = useState<DistributeResult | null>(null);

  const preview = parseCsvEvents(csv);

  async function verifyWeight() {
    if (!ready) {
      openSignIn();
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/treasury", { method: "POST" });
      const res = await fetch("/api/weight/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "navidrome",
          events: preview,
          fundPoolUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Weight evaluation failed");
      setEvaluation(data);
      toast.success("Impact weights computed — review before settling");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function settleArc() {
    if (!evaluation) return;
    setLoading(true);
    try {
      const weightedEvents = evaluationToDistributionEvents(evaluation, "navidrome");
      const res = await fetch("/api/gateway/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "navidrome",
          events: weightedEvents,
          verifySampleRate: 0.1,
          weightProofHash: evaluation.weightProofHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Settlement failed");
      setResult(data);
      setEvaluation(null);
      toast.success(data.onChain ? "Impact-weighted batch settled on Arc" : "Verified off-chain");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className={embedded ? "p-3" : "p-6"}>
        <SettlementReceipt
          title="Impact-weighted settlement"
          amountUsd={result.totalAmountUsd}
          payeeCount={result.payeeCount}
          eventCount={result.eventCount}
          txHash={result.txHash}
          explorerUrl={result.explorerUrl}
          complianceCsv={result.complianceCsv}
        />
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-3 text-xs text-resolve-accent hover:underline"
        >
          New batch
        </button>
      </div>
    );
  }

  if (evaluation) {
    return (
      <div className={embedded ? "p-3" : "mx-auto max-w-4xl px-6 py-6"}>
        <ImpactBreakdown
          fundPoolUsd={evaluation.fundPoolUsd}
          contributors={evaluation.contributors}
          weightProofHash={evaluation.weightProofHash}
          onSettle={settleArc}
          settling={loading}
        />
        <button
          type="button"
          onClick={() => setEvaluation(null)}
          className="mt-3 text-xs text-resolve-muted hover:text-white"
        >
          ← Back to contribution graph
        </button>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-3 p-3" : "mx-auto max-w-4xl space-y-4 px-6 py-6"}>
      {!embedded && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Proof-of-Weight
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">Verify weight, then settle</h1>
          <p className="mt-1 text-xs text-resolve-muted">
            Not every scrobble or PR is equal. AI scores impact — you settle proportional amounts on Arc.
          </p>
        </div>
      )}

      <Panel className="p-3">
        <label className="text-xs font-medium text-white">Fund pool (USDC)</label>
        <input
          type="number"
          min={1}
          step={1}
          value={fundPoolUsd}
          onChange={(e) => setFundPoolUsd(Number(e.target.value))}
          className="mt-1 w-full max-w-[140px] rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-sm text-white"
        />
      </Panel>

      <Panel className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white">Contribution graph (raw events)</p>
          <button
            type="button"
            onClick={() => setCsv(DEMO_DISTRIBUTION_CSV)}
            className="text-[10px] text-resolve-accent hover:underline"
          >
            Load sample events
          </button>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          className="mt-2 w-full resize-y rounded border border-resolve-border bg-resolve-bg p-2 font-mono text-[11px] text-white"
        />
        <p className="mt-2 text-[10px] text-resolve-muted">
          {preview.length} events — amounts ignored until weighting; pool split by impact score.
        </p>
      </Panel>

      <button
        type="button"
        onClick={verifyWeight}
        disabled={loading || !preview.length}
        className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "Scoring impact…" : "Verify weight"}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
