"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowRight,
  Bot,
  CircleDot,
  Loader2,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";

type AgentServiceCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number;
  billingUnit: string;
  domain: string;
  eventType: string;
  connectorId: string;
  rfbProgram?: string;
  examplePrompt: string;
  x402: boolean;
  ingest?: boolean;
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

const RAIL_STEPS = [
  { label: "Discover signal", detail: "Mission or agent selects a priced capability" },
  { label: "Settle on Arc", detail: "USDC micropay via x402 or sensor ingest" },
  { label: "Authorize ledger", detail: "Proof recorded — value can be claimed or audited" },
] as const;

const LANE_META: Record<
  string,
  { title: string; subtitle: string; accent: string }
> = {
  agent: {
    title: "Agent intelligence",
    subtitle: "x402-gated APIs — pay per request, return structured signal",
    accent: "text-resolve-calm-blue",
  },
  creator: {
    title: "Creator attribution",
    subtitle: "Verified plays and watches — RFB #7 royalty rails",
    accent: "text-resolve-calm-rose",
  },
  maintainer: {
    title: "Maintainer value",
    subtitle: "Citations and merges — OSS & research programs",
    accent: "text-resolve-calm-sage",
  },
};

function laneForService(s: AgentServiceCard): keyof typeof LANE_META {
  if (s.domain === "sentiment" || (s.domain === "research" && s.x402)) return "agent";
  if (s.domain === "music" || s.domain === "video") return "creator";
  return "maintainer";
}

function formatUnitPrice(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

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

  const lanes = useMemo(() => {
    const grouped = new Map<keyof typeof LANE_META, AgentServiceCard[]>();
    for (const s of catalog?.services ?? []) {
      const lane = laneForService(s);
      const list = grouped.get(lane) ?? [];
      list.push(s);
      grouped.set(lane, list);
    }
    return (["agent", "creator", "maintainer"] as const)
      .filter((lane) => (grouped.get(lane)?.length ?? 0) > 0)
      .map((lane) => ({ lane, services: grouped.get(lane) ?? [] }));
  }, [catalog?.services]);

  const x402Count = catalog?.services.filter((s) => s.x402).length ?? 0;

  async function runSentimentInvoke() {
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
      setLastResult({ ok: false, continue: false, error: "Invocation failed" });
    } finally {
      setInvoking(false);
    }
  }

  return (
    <section
      id="agent-signals"
      className={clsx(
        "scroll-mt-24 overflow-hidden rounded-2xl border border-resolve-border/80 resolve-calm-surface shadow-resolve",
        className,
      )}
    >
      <div className="border-b border-resolve-calm-periwinkle/10 bg-gradient-to-r from-resolve-accent/[0.06] via-transparent to-transparent px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-resolve-accent/25 bg-resolve-accent/10">
                <Radio className="h-4 w-4 text-resolve-accent" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-resolve-calm-periwinkle">
                Signal authorization rails
              </p>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-white sm:text-xl">
              Pay-per-signal infrastructure for missions and agents
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-resolve-muted">
              {catalog?.doctrine ??
                "Micropay on Arc, authorize on ledger, mission continues — one proof rail for operators and autonomous agents."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
                catalog?.gatewayEnabled
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-resolve-calm-periwinkle/25 bg-resolve-calm-periwinkle/10 text-resolve-calm-periwinkle",
              )}
            >
              <CircleDot className="h-2.5 w-2.5" />
              {catalog?.gatewayEnabled ? "Arc gateway live" : "Gateway staging"}
            </span>
            <DiscoverSectionRefresh
              sectionId="agent-signals"
              onRefresh={load}
              cooldownMs={120_000}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {RAIL_STEPS.map((step, i) => (
            <div
              key={step.label}
              className="relative rounded-xl border border-resolve-border/50 bg-resolve-bg-deep/40 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-resolve-accent/15 text-[10px] font-semibold text-resolve-accent">
                  {i + 1}
                </span>
                <p className="text-xs font-medium text-white">{step.label}</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-resolve-muted-dim">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {loading && !catalog ? (
          <p className="text-xs text-resolve-muted">Loading authorization catalog…</p>
        ) : (
          <div className="space-y-6">
            {lanes.map(({ lane, services }) => {
              const meta = LANE_META[lane];
              return (
                <div key={lane}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className={clsx("text-[10px] font-semibold uppercase tracking-[0.18em]", meta.accent)}>
                        {meta.title}
                      </p>
                      <p className="mt-0.5 text-xs text-resolve-muted-dim">{meta.subtitle}</p>
                    </div>
                    <span className="text-[10px] text-resolve-muted-dim">
                      {services.length} rail{services.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="divide-y divide-resolve-border/40 overflow-hidden rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/35">
                    {services.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-white">{s.name}</p>
                            {s.rfbProgram && (
                              <span className="resolve-calm-chip rounded px-1.5 py-0.5 text-[9px] font-medium uppercase">
                                {s.rfbProgram}
                              </span>
                            )}
                            {s.x402 ? (
                              <span className="rounded border border-resolve-accent/25 bg-resolve-accent/10 px-1.5 py-0.5 text-[9px] text-resolve-accent">
                                x402
                              </span>
                            ) : (
                              <span className="rounded border border-resolve-calm-sage/25 bg-resolve-calm-sage/10 px-1.5 py-0.5 text-[9px] text-resolve-calm-sage">
                                sensor
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
                            {s.description}
                          </p>
                          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-resolve-muted-dim">
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-resolve-calm-periwinkle" />
                              {s.eventType}
                            </span>
                            <span>·</span>
                            <span>{s.connectorId}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right sm:pl-4">
                          <p className="text-sm font-semibold tabular-nums text-white">
                            {formatUnitPrice(s.priceUsd)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                            per {s.billingUnit}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {x402Count > 0 && (
              <div className="rounded-xl border border-resolve-accent/20 bg-gradient-to-br from-resolve-accent/[0.06] to-resolve-bg-deep/50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-resolve-accent" />
                    <div>
                      <p className="text-sm font-medium text-white">Live rail proof</p>
                      <p className="mt-1 max-w-xl text-xs leading-relaxed text-resolve-muted">
                        Invoke a sentiment signal — USDC settles on Arc, RESOLVE records{" "}
                        <code className="text-resolve-calm-periwinkle">mcp.invocation</code> on the
                        ledger, and your mission can continue with verified output.
                      </p>
                    </div>
                  </div>
                  <span className="resolve-calm-chip rounded-full px-2 py-0.5 text-[10px]">
                    {x402Count} x402 endpoint{x402Count === 1 ? "" : "s"}
                  </span>
                </div>

                <label className="mt-4 block text-[10px] font-medium uppercase tracking-[0.16em] text-resolve-calm-periwinkle">
                  Input signal
                </label>
                <textarea
                  value={demoText}
                  onChange={(e) => setDemoText(e.target.value)}
                  rows={2}
                  placeholder="Paste feedback, research snippet, or mission context…"
                  className="mt-2 w-full rounded-xl border border-resolve-border/70 bg-resolve-bg-deep/60 px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none focus:ring-1 focus:ring-resolve-accent/25"
                />

                {signedIn ? (
                  <button
                    type="button"
                    disabled={invoking || !demoText.trim()}
                    onClick={() => void runSentimentInvoke()}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-resolve-accent/35 bg-resolve-accent/15 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-resolve-accent/25 disabled:opacity-50"
                  >
                    {invoking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-resolve-accent" />
                    )}
                    Authorize &amp; classify
                    <ArrowRight className="h-3.5 w-3.5 text-resolve-accent" />
                  </button>
                ) : (
                  <p className="mt-4 text-xs text-resolve-muted">
                    Sign in to run a live authorization — proof appears on the ledger and in Mission.
                  </p>
                )}

                {lastResult && (
                  <div
                    className={clsx(
                      "mt-4 rounded-xl border px-4 py-3 text-xs",
                      lastResult.ok
                        ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100"
                        : "border-resolve-calm-alert/25 bg-resolve-calm-alert/[0.06] text-resolve-muted",
                    )}
                  >
                    {lastResult.ok ? (
                      <>
                        <p>
                          <span className="font-medium text-white">Authorized</span> ·{" "}
                          {formatUnitPrice(lastResult.amountUsd ?? 0)} USDC · sentiment{" "}
                          <strong className="text-emerald-200">
                            {lastResult.data?.sentiment ?? "—"}
                          </strong>
                        </p>
                        {lastResult.authorizationId && (
                          <p className="mt-1.5 text-[10px] text-emerald-200/80">
                            Ledger ref {lastResult.authorizationId.slice(0, 12)}… — mission may
                            continue
                          </p>
                        )}
                      </>
                    ) : (
                      lastResult.error ??
                      "Gateway unavailable — configure ARC_AGENT_GATEWAY_PRIVATE_KEY for live settlement"
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
