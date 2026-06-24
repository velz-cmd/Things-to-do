"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { DEMO_DISTRIBUTION_CSV } from "@/lib/treasury/demo-data";
import { parseCsvEvents } from "@/lib/treasury/csv";
import type { DistributeResult } from "@/lib/gateway/types";
import { ExternalLink, Upload } from "lucide-react";

export default function DistributePage() {
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [csv, setCsv] = useState(DEMO_DISTRIBUTION_CSV);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DistributeResult | null>(null);

  async function runDistribute() {
    if (!ready) {
      openSignIn();
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      await fetch("/api/treasury", { method: "POST" });
      const events = parseCsvEvents(csv);
      const res = await fetch("/api/gateway/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "navidrome",
          events,
          verifySampleRate: 0.1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Distribution failed");
      setResult(data);
      toast.success("Distribution settled", {
        description: `$${data.totalAmountUsd.toFixed(2)} to ${data.payeeCount} payees`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const preview = parseCsvEvents(csv);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <p className="text-sm font-medium text-sky-400">Distribution Bootstrap</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Distribute</h1>
      <p className="mt-2 max-w-2xl text-resolve-muted">
        Founders upload verified creator events. RESOLVE resolves payees, samples
        verification, and batch-settles USDC on Arc.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Event batch</h2>
            <button
              type="button"
              onClick={() => setCsv(DEMO_DISTRIBUTION_CSV)}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Reset demo CSV
            </button>
          </div>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={14}
            className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white outline-none focus:border-sky-500/50"
          />
          <p className="mt-2 text-xs text-resolve-muted">
            {preview.length} events loaded
          </p>
          <button
            type="button"
            onClick={() => void runDistribute()}
            disabled={loading || preview.length === 0}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? "Verifying & settling…" : "Distribute when verified"}
          </button>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h2 className="font-semibold text-white">Settlement result</h2>
          {!result ? (
            <p className="mt-4 text-sm text-resolve-muted">
              Upload events and click distribute. Proof sampling runs on 10% of the
              batch before USDC releases.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-resolve-muted">Status</p>
                  <p className="font-semibold text-white">{result.status}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-resolve-muted">Total</p>
                  <p className="font-semibold text-white">
                    ${result.totalAmountUsd.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-resolve-muted">Payees</p>
                  <p className="font-semibold text-white">{result.payeeCount}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-resolve-muted">Verified</p>
                  <p className="font-semibold text-white">
                    {result.verifiedCount}/{result.eventCount}
                  </p>
                </div>
              </div>
              {result.explorerUrl && (
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                >
                  View batch on Arcscan <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <pre className="max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-resolve-muted">
                {result.complianceCsv.split("\n").slice(0, 8).join("\n")}
                {result.complianceCsv.split("\n").length > 8 ? "\n…" : ""}
              </pre>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
