"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Upload, ChevronRight, ChevronLeft } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { EmptyState } from "@/components/resolve/ui/empty-state";
import { TableSkeleton } from "@/components/resolve/ui/skeleton";
import { SettlementReceipt } from "@/components/resolve/missions/settlement-receipt";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { DEMO_DISTRIBUTION_CSV } from "@/lib/treasury/demo-data";
import { parseCsvEvents } from "@/lib/treasury/csv";
import type { DistributeResult } from "@/lib/gateway/types";
import clsx from "clsx";

type Step = "upload" | "review" | "receipt";

export default function DistributePage() {
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [step, setStep] = useState<Step>("upload");
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
      setStep("receipt");
      toast.success("Batch settled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl animate-resolve-enter px-6 py-6">
      <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
        Distribution
      </p>
      <h1 className="mt-1 text-xl font-semibold text-white">Batch payout</h1>
      <p className="mt-1 text-sm text-resolve-muted">
        Upload verified creator events. RESOLVE resolves payees, samples verification, and
        settles on Arc.
      </p>

      <div className="mt-6 flex gap-2">
        {(["upload", "review", "receipt"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={clsx(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium",
                step === s
                  ? "bg-resolve-accent text-white"
                  : i < ["upload", "review", "receipt"].indexOf(step)
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-resolve-hover text-resolve-muted-dim"
              )}
            >
              {i + 1}
            </span>
            <span
              className={clsx(
                "text-xs capitalize",
                step === s ? "text-white" : "text-resolve-muted-dim"
              )}
            >
              {s}
            </span>
            {i < 2 && <ChevronRight className="h-3 w-3 text-resolve-muted-dim" />}
          </div>
        ))}
      </div>

      <div className="mt-6">
        {step === "upload" && (
          <Panel>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Event batch</p>
              <button
                type="button"
                onClick={() => setCsv(DEMO_DISTRIBUTION_CSV)}
                className="text-xs text-resolve-accent hover:underline"
              >
                Load demo
              </button>
            </div>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={12}
              className="mt-4 w-full rounded-md border border-resolve-border-strong bg-resolve-bg p-3 font-mono text-xs text-white outline-none focus:border-resolve-accent/50"
            />
            <p className="mt-2 text-xs text-resolve-muted tabular-nums">
              {preview.length} events
            </p>
            <button
              type="button"
              disabled={preview.length === 0}
              onClick={() => setStep("review")}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-resolve-accent px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Review batch
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </Panel>
        )}

        {step === "review" && (
          <Panel className="p-0 overflow-hidden">
            <div className="border-b border-resolve-border-strong px-5 py-4">
              <p className="text-sm font-medium text-white">Review</p>
              <p className="mt-1 text-xs text-resolve-muted tabular-nums">
                {preview.length} events · ${totalPreview.toFixed(4)} total · 10% verification
                sample
              </p>
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-resolve-raised text-[10px] uppercase text-resolve-muted">
                  <tr>
                    <th className="px-5 py-2 font-medium">Event</th>
                    <th className="px-5 py-2 font-medium">Type</th>
                    <th className="px-5 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 12).map((e) => (
                    <tr key={e.eventId} className="border-t border-resolve-border">
                      <td className="px-5 py-2.5 font-mono text-resolve-muted">{e.eventId}</td>
                      <td className="px-5 py-2.5 text-white">{e.type.replace(/_/g, " ")}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-white">
                        ${e.amountUsd.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 border-t border-resolve-border-strong p-4">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="inline-flex items-center gap-1 rounded-md border border-resolve-border-strong px-3 py-2 text-xs text-resolve-muted hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={() => void runDistribute()}
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-resolve-accent py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {loading ? "Verifying & settling…" : "Release when verified"}
              </button>
            </div>
          </Panel>
        )}

        {step === "receipt" && result ? (
          <SettlementReceipt
            title="Distribution batch settled"
            amountUsd={result.totalAmountUsd}
            payeeCount={result.payeeCount}
            eventCount={result.eventCount}
            txHash={result.txHash}
            explorerUrl={result.explorerUrl}
            complianceCsv={result.complianceCsv}
          />
        ) : step === "receipt" && loading ? (
          <TableSkeleton />
        ) : null}

        {step === "receipt" && result && (
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setResult(null);
            }}
            className="mt-4 text-xs text-resolve-accent hover:underline"
          >
            New batch
          </button>
        )}
      </div>
    </div>
  );
}
