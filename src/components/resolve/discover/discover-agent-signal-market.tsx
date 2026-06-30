"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Bot, Loader2, Zap } from "lucide-react";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";

type AgentServiceCard = {
  id: string;
  name: string;
  tagline: string;
  priceUsd: number;
  billingUnit: string;
  domain: string;
  rfbProgram?: string;
  examplePrompt: string;
  x402: boolean;
};

type ServicesPayload = {
  ok: boolean;
  gatewayEnabled: boolean;
  services: AgentServiceCard[];
  doctrine: string;
  updatedAt: string;
};

type InvokeResult = {
  ok: boolean;
  continue: boolean;
  serviceName?: string;
  amountUsd?: number;
  txRef?: string | null;
  authorizationId?: string;
  data?: { sentiment?: string; score?: number; insight?: string };
  error?: string;
};

export function DiscoverAgentSignalMarket({
  signedIn,
  className,
}: {
  signedIn: boolean;
  className?: string;
}) {
  const [catalog, setCatalog] = useState<ServicesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoText, setDemoText] = useState(
    "Love the product but shipping was slower than promised.",
  );
  const [invoking, setInvoking] = useState(false);
  const [lastResult, setLastResult] = useState<InvokeResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/services");
      const data = (await res.json()) as ServicesPayload;
      setCatalog(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSentimentDemo() {
    if (!signedIn) return;
    setInvoking(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "sentiment-per-request",
          text: demoText,
        }),
      });
      const data = (await res.json()) as InvokeResult;
      setLastResult(data);
    } catch {
      setLastResult({ ok: false, continue: false, error: "Invoke failed" });
    } finally {
      setInvoking(false);
    }
  }

  const x402Services = catalog?.services.filter((s) => s.x402) ?? [];

  return (
    <section
      id="agent-signals"
      className={clsx(
        "scroll-mt-24 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#0a0614]/80 to-[#04070d]/90 p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-300" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
              Agent signal commerce
            </p>
            <p className="mt-0.5 text-sm text-white">
              Find service → pay per request in USDC → keep moving
            </p>
            <p className="mt-1 max-w-2xl text-xs text-resolve-muted">
              {catalog?.doctrine ??
                "Circle Agent Stack on Arc — x402 nanopay maps to RESOLVE pay-per-signal RFB programs."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "rounded-full border px-2 py-0.5 text-[10px]",
              catalog?.gatewayEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200",
            )}
          >
            {catalog?.gatewayEnabled ? "Gateway live" : "Gateway demo mode"}
          </span>
          <DiscoverSectionRefresh sectionId="agent-signals" onRefresh={load} cooldownMs={120_000} />
        </div>
      </div>

      {loading && !catalog ? (
        <p className="mt-6 text-xs text-resolve-muted">Loading agent services…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(catalog?.services ?? []).map((s) => (
              <article
                key={s.id}
                className="rounded-xl border border-white/[0.08] bg-black/30 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{s.name}</p>
                  <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] uppercase text-violet-200">
                    {s.billingUnit}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-resolve-muted">{s.tagline}</p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-300">
                  ${s.priceUsd.toFixed(s.priceUsd < 0.01 ? 4 : 3)}
                  <span className="text-[10px] font-normal text-resolve-muted-dim">
                    {" "}
                    / {s.billingUnit}
                  </span>
                </p>
                {s.rfbProgram && (
                  <p className="mt-1 text-[10px] text-resolve-muted-dim">{s.rfbProgram}</p>
                )}
                {s.x402 && (
                  <span className="mt-2 inline-block rounded border border-sky-500/30 px-1.5 py-0.5 text-[9px] text-sky-200">
                    x402 · Arc USDC
                  </span>
                )}
              </article>
            ))}
          </div>

          {x402Services.length > 0 && (
            <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/25 p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                <p className="text-xs font-medium text-white">Try sentiment pipeline (Circle demo)</p>
              </div>
              <p className="mt-1 text-[11px] text-resolve-muted">
                Agent prompt: &quot;Classify this customer feedback&quot; → pays ~$0.001 USDC → returns
                label.
              </p>
              <textarea
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                rows={2}
                className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
              {signedIn ? (
                <button
                  type="button"
                  disabled={invoking}
                  onClick={() => void runSentimentDemo()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                >
                  {invoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Invoke · pay &amp; classify
                </button>
              ) : (
                <p className="mt-3 text-xs text-resolve-muted">Sign in to run live x402 invoke.</p>
              )}
              {lastResult && (
                <div
                  className={clsx(
                    "mt-3 rounded-lg border px-3 py-2 text-xs",
                    lastResult.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-100",
                  )}
                >
                  {lastResult.ok ? (
                    <>
                      Paid ${lastResult.amountUsd?.toFixed(4)} · sentiment:{" "}
                      <strong>{lastResult.data?.sentiment ?? "—"}</strong>
                      {lastResult.authorizationId && (
                        <span className="block mt-1 text-[10px] opacity-80">
                          Ledger auth {lastResult.authorizationId.slice(0, 10)}… · agent continues
                        </span>
                      )}
                    </>
                  ) : (
                    lastResult.error ?? "Payment skipped — configure ARC_AGENT_GATEWAY_PRIVATE_KEY"
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
