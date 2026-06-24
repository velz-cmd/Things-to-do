"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Upload } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { SettlementReceipt } from "@/components/resolve/missions/settlement-receipt";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { DEMO_DISTRIBUTION_CSV } from "@/lib/treasury/demo-data";
import { parseCsvEvents } from "@/lib/treasury/csv";
import type { DistributeResult } from "@/lib/gateway/types";

export function DistributePanel({ embedded }: { embedded?: boolean }) {
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [csv, setCsv] = useState(DEMO_DISTRIBUTION_CSV);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DistributeResult | null>(null);

  const preview = parseCsvEvents(csv);
  const totalPreview = preview.reduce((s, e) => s + e.amountUsd, 0);

  async function runDistribute() {
    if (!ready) {
      openSignIn();
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/treasury", { method: "POST" });
      const res = await fetch("/api/gateway/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "navidrome",
          events: preview,
          verifySampleRate: 0.1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Distribution failed");
      setResult(data);
      toast.success("Batch settled");
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
          title="Distribution settled"
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

  return (
    <div className={embedded ? "space-y-3 p-3" : "mx-auto max-w-4xl space-y-4 px-6 py-6"}>
      {!embedded && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Distribution
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">Batch payout</h1>
        </div>
      )}

      <Panel className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white">Event batch (CSV)</p>
          <button
            type="button"
            onClick={() => setCsv(DEMO_DISTRIBUTION_CSV)}
            className="text-[10px] text-resolve-accent hover:underline"
          >
            Load demo
          </button>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={embedded ? 6 : 10}
          className="mt-2 w-full rounded-md border border-resolve-border-strong bg-resolve-bg p-2 font-mono text-[11px] text-white outline-none focus:border-resolve-accent/50"
        />
        <p className="mt-1 text-[10px] text-resolve-muted tabular-nums">
          {preview.length} events · ${totalPreview.toFixed(2)} total
        </p>
        <button
          type="button"
          disabled={loading || preview.length === 0}
          onClick={() => void runDistribute()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-resolve-accent py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? (
            "Verifying & settling…"
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Release when verified
            </>
          )}
        </button>
      </Panel>
    </div>
  );
}
