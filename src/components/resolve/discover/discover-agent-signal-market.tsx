"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  Receipt,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import { Button } from "@/components/resolve/ui/button";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { apiFetchWallet } from "@/lib/discover/discover-action-engine";
import { PLATFORM_LOOP_TAGLINE } from "@/lib/economy/platform-loop";

type AgentServiceCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number;
  billingUnit: string;
  domain: string;
  eventType: string;
  examplePrompt: string;
  deliverables?: string[];
  x402: boolean;
};

type ExecutionReport = {
  steps: string[];
  findings: string[];
  recommendations: string[];
  deliverables: string[];
  inputPreview: string;
  payload?: Record<string, unknown>;
  generatedAt?: string;
};

type InvokeResult = {
  ok: boolean;
  serviceName?: string;
  amountUsd?: number;
  authorizationId?: string;
  receiptHref?: string | null;
  meteringMode?: string;
  summary?: { headline: string; detail: string };
  execution?: ExecutionReport | null;
  feePath?: ServicesPayload["feePath"];
  wallet?: {
    chargedUsd: number;
    balanceUsd: number;
    previousBalanceUsd: number;
  };
  walletError?: string;
  data?: { summary?: string; payload?: Record<string, unknown> };
  error?: string;
};

type ServicesPayload = {
  ok: boolean;
  gatewayEnabled: boolean;
  services: AgentServiceCard[];
  doctrine: string;
  tagline?: string;
  feePath?: {
    flow: string[];
    platformFeeBps: number;
    platformFeeUsd: number;
    note: string;
  };
};

function formatPrice(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

type DiscoverAgentSignalMarketProps = {
  signedIn: boolean;
  className?: string;
};

export function DiscoverAgentSignalMarket({
  signedIn,
  className,
}: DiscoverAgentSignalMarketProps) {
  const searchParams = useSearchParams();
  const { openSignIn } = useSignInModal();
  const [catalog, setCatalog] = useState<ServicesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Run intel on React maintainers — docs gaps and contributor health");
  const [serviceId, setServiceId] = useState("docs-review");
  const [budgetUsd, setBudgetUsd] = useState(0.05);
  const [invoking, setInvoking] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [walletUsd, setWalletUsd] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/services");
      const data = (await res.json()) as ServicesPayload;
      setCatalog(data);
      setLastLoaded(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!signedIn) {
      setWalletUsd(null);
      return;
    }
    void apiFetchWallet().then((w) => setWalletUsd(w.spendableUsd));
  }, [signedIn, result?.wallet?.balanceUsd]);

  useEffect(() => {
    const q = searchParams.get("prompt");
    const svc = searchParams.get("service");
    if (q) setPrompt(q);
    if (svc) setServiceId(svc);
  }, [searchParams]);

  const selected = useMemo(
    () => catalog?.services.find((s) => s.id === serviceId) ?? catalog?.services[0],
    [catalog?.services, serviceId],
  );

  const pricePreview = selected?.priceUsd ?? 0.001;
  const canAfford = walletUsd == null || walletUsd >= pricePreview;

  async function runIntel() {
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!prompt.trim()) {
      toast.error("Enter an intel prompt");
      return;
    }
    setInvoking(true);
    setResult(null);
    try {
      const res = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          prompt: prompt.trim(),
          text: prompt.trim(),
          maxSpendUsd: budgetUsd,
        }),
      });
      const data = (await res.json()) as InvokeResult;
      setResult(data);
      if (data.wallet?.balanceUsd != null) {
        setWalletUsd(data.wallet.balanceUsd);
      } else if (signedIn) {
        const w = await apiFetchWallet();
        setWalletUsd(w.spendableUsd);
      }
      if (data.ok) {
        toast.success(data.summary?.headline ?? "Agent task complete", {
          description: data.wallet
            ? `$${data.wallet.chargedUsd.toFixed(3)} charged · $${data.wallet.balanceUsd.toFixed(2)} remaining`
            : undefined,
        });
      } else {
        toast.error(data.walletError ?? data.error ?? "Agent invoke failed");
      }
    } catch {
      toast.error("Could not run agent task");
    } finally {
      setInvoking(false);
    }
  }

  return (
    <DiscoverPremiumSection
      id="agent-market"
      title="Agent Signal Market"
      subtitle="Hire agents to gather intel — pay-per-signal on Arc with ledger proof"
      className={clsx("mb-10 scroll-mt-24", className)}
      actions={
        <DiscoverSectionRefresh
          sectionId="agent-signal-market"
          onRefresh={load}
          lastUpdated={lastLoaded}
          cooldownMs={120_000}
        />
      }
    >
      {loading && !catalog ? (
        <div className="flex items-center gap-2 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading micro-services catalog…
        </div>
      ) : (
        <div className="space-y-6">
          <p className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-center text-sm font-medium leading-relaxed text-violet-100/95">
            {catalog?.tagline ?? PLATFORM_LOOP_TAGLINE}
          </p>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <DiscoverCapitalCard className="discover-agent-run-card" padding={false}>
              <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-accent">
                Run intel
              </p>
              {selected && (
                <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                    What you get
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
                    {selected.description}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(selected.deliverables ?? [selected.tagline]).map((d) => (
                      <li key={d} className="flex items-start gap-2 text-[11px] text-white/85">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-resolve-accent" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="mt-3 block text-[10px] uppercase tracking-wider text-resolve-muted-dim">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
                placeholder="Run intel on React maintainers…"
              />
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">
                    Service
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="mt-1 block w-full min-w-[200px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  >
                    {(catalog?.services ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {formatPrice(s.priceUsd)}/{s.billingUnit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">
                    Budget (USDC)
                  </label>
                  <input
                    type="number"
                    min={0.05}
                    step={0.01}
                    value={budgetUsd}
                    onChange={(e) => setBudgetUsd(Number(e.target.value))}
                    className="mt-1 block w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="text-xs text-resolve-muted">
                  Price preview:{" "}
                  <span className="font-medium text-emerald-300">{formatPrice(pricePreview)}</span>
                  {catalog && !catalog.gatewayEnabled && (
                    <span className="mt-1 block text-[10px] text-amber-200/80">
                      Arc gateway staging — metered invoke + ledger proof
                    </span>
                  )}
                </div>
              </div>
              {signedIn && walletUsd != null && (
                <p className="mt-3 text-[11px] text-resolve-muted">
                  Wallet:{" "}
                  <span className={clsx("font-semibold tabular-nums", canAfford ? "text-emerald-300" : "text-amber-200")}>
                    ${walletUsd.toFixed(2)} available
                  </span>
                  {" · "}
                  This run charges{" "}
                  <span className="font-medium text-white">{formatPrice(pricePreview)}</span>
                  {!canAfford && (
                    <span className="ml-1 text-amber-200">— add funds in Capital</span>
                  )}
                </p>
              )}
              <Button
                className="mt-4 gap-2"
                disabled={invoking || (signedIn && walletUsd != null && !canAfford)}
                onClick={() => void runIntel()}
              >
                {invoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Run agent · {formatPrice(pricePreview)}
              </Button>
              </div>
            </DiscoverCapitalCard>

            <DiscoverCapitalCard className="discover-agent-fee-card" padding={false}>
              <div className="p-4">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-resolve-muted" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                  RESOLVE fee path
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                {catalog?.feePath?.note ??
                  "x402 pays the signal provider; settlement batches may include platform bps."}
              </p>
              {catalog?.feePath && (
                <p className="mt-2 text-[10px] text-resolve-muted-dim">
                  Platform fee: {catalog.feePath.platformFeeBps / 100}% on settlements · sample{" "}
                  {formatPrice(catalog.feePath.platformFeeUsd)} on {formatPrice(pricePreview)} signal
                </p>
              )}
              </div>
            </DiscoverCapitalCard>
          </div>

          {result && (
            <DiscoverCapitalCard
              accent={result.ok ? "emerald" : "default"}
              className={clsx(
                result.ok ? "border-emerald-500/20" : "border-rose-500/20",
              )}
              padding={false}
            >
              <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    {result.ok ? "Agent execution report" : "Invoke failed"}
                  </p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {result.summary?.headline ?? result.error ?? "No summary"}
                  </p>
                  {result.summary?.detail && (
                    <p className="mt-1 text-sm text-resolve-muted">{result.summary.detail}</p>
                  )}
                </div>
                {result.ok && <Sparkles className="h-5 w-5 shrink-0 text-emerald-400" />}
              </div>

              {result.ok && result.wallet && (
                <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5 text-xs text-emerald-100">
                  <span className="font-semibold tabular-nums">
                    −${result.wallet.chargedUsd.toFixed(3)}
                  </span>{" "}
                  charged from your wallet · was ${result.wallet.previousBalanceUsd.toFixed(2)} → now{" "}
                  <span className="font-semibold tabular-nums">
                    ${result.wallet.balanceUsd.toFixed(2)}
                  </span>
                </div>
              )}
              {result.walletError && (
                <p className="mt-3 text-xs text-amber-200">{result.walletError}</p>
              )}

              {result.ok && result.execution && (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {result.execution.steps.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                        What the agent did
                      </p>
                      <ol className="mt-2 space-y-1.5">
                        {result.execution.steps.map((step, i) => (
                          <li key={step} className="flex gap-2 text-[11px] text-resolve-muted">
                            <span className="shrink-0 font-mono text-resolve-accent">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {result.execution.findings.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                        Findings
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {result.execution.findings.map((f) => (
                          <li key={f} className="text-[11px] text-white/90">
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.execution.recommendations.length > 0 && (
                    <div className="lg:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                        Recommended next steps
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {result.execution.recommendations.map((r) => (
                          <li key={r} className="flex gap-2 text-[11px] text-resolve-accent">
                            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.execution.inputPreview && (
                    <div className="lg:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                        Input analyzed
                      </p>
                      <p className="mt-1 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-resolve-muted">
                        {result.execution.inputPreview}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {result.ok && (
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-4 text-xs text-resolve-muted">
                  <span>
                    {result.serviceName} · {formatPrice(result.amountUsd ?? 0)} ·{" "}
                    {result.meteringMode ?? "metered"}
                  </span>
                  {result.receiptHref && (
                    <Link
                      href={result.receiptHref}
                      className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      View receipt
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {result.feePath && (
                    <span className="text-[11px] text-resolve-muted-dim">
                      Platform fee {formatPrice(result.feePath.platformFeeUsd)} on settlement
                    </span>
                  )}
                </div>
              )}
              </div>
            </DiscoverCapitalCard>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Micro-services registry
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {(catalog?.services ?? []).map((s) => (
                <li
                  key={s.id}
                  className={clsx(
                    "rounded-xl border px-4 py-3",
                    s.id === serviceId
                      ? "border-resolve-accent/30 bg-resolve-accent/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="text-[11px] text-resolve-muted">{s.tagline}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-300">
                      {formatPrice(s.priceUsd)}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-resolve-muted-dim">
                    {s.eventType} · per {s.billingUnit}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setPrompt(s.examplePrompt);
                    }}
                    className="mt-2 text-[10px] font-medium text-resolve-accent hover:underline"
                  >
                    Use example prompt
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-xs text-resolve-muted-dim">
            Per-opportunity cards include <strong className="font-medium text-resolve-muted">Automate</strong>{" "}
            with price preview · advanced rails in{" "}
            <Link href="/mission#signal-rails" className="text-resolve-accent hover:underline">
              Mission
              <ArrowRight className="ml-0.5 inline h-3 w-3" />
            </Link>
          </p>
        </div>
      )}
    </DiscoverPremiumSection>
  );
}
