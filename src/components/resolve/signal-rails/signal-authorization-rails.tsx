"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Loader2,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";

export type AgentServiceCard = {
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
  authorizationId?: string;
  data?: { sentiment?: string; score?: number; insight?: string };
  error?: string;
};

const RAIL_STEPS = [
  { label: "Select capability", detail: "Mission picks a priced signal from the catalog" },
  { label: "Settle on Arc", detail: "USDC micropay via x402 or verified sensor ingest" },
  { label: "Ledger proof", detail: "Authorization recorded — audit, claim, continue" },
] as const;

const LANE_ORDER = ["agent", "creator", "maintainer"] as const;

const LANE_META: Record<
  (typeof LANE_ORDER)[number],
  { title: string; subtitle: string; accent: string; rail: string }
> = {
  agent: {
    title: "Agent intelligence",
    subtitle: "x402 APIs — structured signal per request",
    accent: "text-resolve-calm-blue",
    rail: "border-l-resolve-calm-blue/45",
  },
  creator: {
    title: "Creator attribution",
    subtitle: "Verified plays and watches on royalty rails",
    accent: "text-resolve-calm-rose",
    rail: "border-l-resolve-calm-rose/40",
  },
  maintainer: {
    title: "Maintainer value",
    subtitle: "Citations, merges, and OSS program events",
    accent: "text-resolve-calm-sage",
    rail: "border-l-resolve-calm-sage/45",
  },
};

function laneForService(s: AgentServiceCard): (typeof LANE_ORDER)[number] {
  if (s.domain === "sentiment" || (s.domain === "research" && s.x402)) return "agent";
  if (s.domain === "music" || s.domain === "video") return "creator";
  return "maintainer";
}

function formatUnitPrice(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

export type SignalAuthorizationRailsProps = {
  signedIn: boolean;
  variant: "discover" | "mission";
  defaultExpanded?: boolean;
  className?: string;
  onMissionPrompt?: (prompt: string, serviceId: string) => void;
};

export function SignalAuthorizationRails({
  signedIn,
  variant,
  defaultExpanded = false,
  className,
  onMissionPrompt,
}: SignalAuthorizationRailsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [catalog, setCatalog] = useState<ServicesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoText, setDemoText] = useState(
    "Love the product but shipping was slower than promised.",
  );
  const [invoking, setInvoking] = useState(false);
  const [lastResult, setLastResult] = useState<InvokeResult | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("sentiment-per-request");

  const isMission = variant === "mission";
  const missionHref = "/mission#signal-rails";

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

  useEffect(() => {
    if (typeof window === "undefined" || variant !== "mission") return;
    if (window.location.hash === "#signal-rails") {
      setExpanded(true);
    }
  }, [variant]);

  const lanes = useMemo(() => {
    const grouped = new Map<(typeof LANE_ORDER)[number], AgentServiceCard[]>();
    for (const s of catalog?.services ?? []) {
      const lane = laneForService(s);
      const list = grouped.get(lane) ?? [];
      list.push(s);
      grouped.set(lane, list);
    }
    return LANE_ORDER.filter((lane) => (grouped.get(lane)?.length ?? 0) > 0).map((lane) => ({
      lane,
      services: grouped.get(lane) ?? [],
    }));
  }, [catalog?.services]);

  const serviceCount = catalog?.services.length ?? 0;
  const x402Services = catalog?.services.filter((s) => s.x402) ?? [];

  async function runInvoke() {
    if (!signedIn || !isMission) return;
    setInvoking(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
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
      id="signal-rails"
      className={clsx("resolve-signal-rails scroll-mt-24 overflow-hidden rounded-2xl", className)}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.02] sm:px-5"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-resolve-calm-periwinkle/20 bg-resolve-calm-card/[0.08]">
            <Radio className="h-4 w-4 text-resolve-calm-periwinkle" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-resolve-calm-periwinkle">
              Signal authorization rails
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg">
              Pay-per-signal infrastructure for missions and agents
            </h2>
            {!expanded && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-resolve-muted">
                {catalog?.doctrine ??
                  "Micropay on Arc, authorize on ledger, mission continues."}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {catalog && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-resolve-calm-periwinkle/20 bg-resolve-calm-card/[0.06] px-2.5 py-1 text-[10px] text-resolve-muted">
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  catalog.gatewayEnabled ? "bg-emerald-400/90" : "bg-resolve-calm-periwinkle/50",
                )}
              />
              {catalog.gatewayEnabled ? "Arc live" : "Staging"}
              <span className="text-resolve-muted-dim">·</span>
              {serviceCount} rails
            </span>
          )}
          {!isMission && (
            <Link
              href={missionHref}
              className="inline-flex items-center gap-1 rounded-lg border border-resolve-calm-blue/30 bg-resolve-calm-blue/10 px-2.5 py-1.5 text-[11px] font-medium text-resolve-calm-blue transition hover:bg-resolve-calm-blue/15"
            >
              Run in Mission
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          {expanded && (
            <DiscoverSectionRefresh
              sectionId={isMission ? "mission-signal-rails" : "agent-signals"}
              onRefresh={load}
              cooldownMs={120_000}
            />
          )}
          <span className="inline-flex items-center gap-1 rounded-lg border border-resolve-calm-periwinkle/15 px-2.5 py-1.5 text-[11px] text-resolve-muted">
            {expanded ? "Collapse" : "Expand"}
            <ChevronDown
              className={clsx("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-resolve-calm-periwinkle/10 px-4 pb-5 pt-4 sm:px-5">
          <p className="max-w-3xl text-sm leading-relaxed text-resolve-muted">
            {catalog?.doctrine ??
              "Micropay on Arc, authorize on ledger, mission continues — agents and operators share one proof rail."}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {RAIL_STEPS.map((step, i) => (
              <div key={step.label} className="resolve-signal-step rounded-xl px-4 py-3.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-calm-periwinkle/80">
                  Step {i + 1}
                </p>
                <p className="mt-1.5 text-sm font-medium text-white/95">{step.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted-dim">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          {loading && !catalog ? (
            <p className="mt-8 text-xs text-resolve-muted">Loading catalog…</p>
          ) : (
            <div className="mt-8 space-y-8">
              {lanes.map(({ lane, services }) => {
                const meta = LANE_META[lane];
                return (
                  <div key={lane}>
                    <div className={clsx("border-l-2 pl-3", meta.rail)}>
                      <p
                        className={clsx(
                          "text-[10px] font-semibold uppercase tracking-[0.18em]",
                          meta.accent,
                        )}
                      >
                        {meta.title}
                      </p>
                      <p className="mt-0.5 text-xs text-resolve-muted-dim">{meta.subtitle}</p>
                    </div>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {services.map((s) => (
                        <li
                          key={s.id}
                          className="resolve-signal-rail-card flex flex-col rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-medium text-white">{s.name}</p>
                                {s.rfbProgram && (
                                  <span className="resolve-calm-chip rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase">
                                    {s.rfbProgram}
                                  </span>
                                )}
                                <span className="resolve-calm-chip rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase">
                                  {s.x402 ? "x402" : "sensor"}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                                {s.description}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold tabular-nums text-resolve-calm-periwinkle">
                                {formatUnitPrice(s.priceUsd)}
                              </p>
                              <p className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">
                                per {s.billingUnit}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-resolve-calm-periwinkle/10 pt-3">
                            <p className="flex items-center gap-1.5 text-[10px] text-resolve-muted-dim">
                              <ShieldCheck className="h-3 w-3 text-resolve-calm-periwinkle/70" />
                              {s.eventType}
                              <span className="opacity-40">·</span>
                              {s.connectorId}
                            </p>
                            {isMission && onMissionPrompt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceId(s.id);
                                  setDemoText(s.examplePrompt);
                                  onMissionPrompt(s.examplePrompt, s.id);
                                }}
                                className="rounded-lg border border-resolve-calm-blue/25 bg-resolve-calm-blue/10 px-2.5 py-1 text-[10px] font-medium text-resolve-calm-blue transition hover:bg-resolve-calm-blue/15"
                              >
                                Use in mission
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {isMission && x402Services.length > 0 && (
                <div className="resolve-calm-surface rounded-2xl p-5">
                  <p className="text-sm font-medium text-white">Authorize signal</p>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-resolve-muted">
                    Settles on Arc and writes{" "}
                    <code className="rounded bg-white/[0.04] px-1 py-0.5 text-resolve-calm-periwinkle">
                      mcp.invocation
                    </code>{" "}
                    to the ledger.
                  </p>

                  <label className="mt-4 block text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-calm-periwinkle">
                    Signal input
                  </label>
                  <textarea
                    value={demoText}
                    onChange={(e) => setDemoText(e.target.value)}
                    rows={2}
                    placeholder="Paste feedback, research snippet, or mission context…"
                    className="mt-2 w-full rounded-xl border border-resolve-calm-periwinkle/15 bg-[#050a14]/50 px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-calm-blue/35 focus:outline-none focus:ring-1 focus:ring-resolve-calm-blue/20"
                  />

                  {signedIn ? (
                    <button
                      type="button"
                      disabled={invoking || !demoText.trim()}
                      onClick={() => void runInvoke()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-resolve-calm-blue/30 bg-resolve-calm-blue/12 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-resolve-calm-blue/20 disabled:opacity-50"
                    >
                      {invoking ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-resolve-calm-blue" />
                      )}
                      Authorize &amp; continue
                    </button>
                  ) : (
                    <p className="mt-4 text-xs text-resolve-muted">
                      Sign in to authorize signals from Mission.
                    </p>
                  )}

                  {lastResult && (
                    <div
                      className={clsx(
                        "mt-4 rounded-xl border px-4 py-3 text-xs",
                        lastResult.ok
                          ? "border-resolve-calm-periwinkle/15 bg-resolve-calm-card/[0.05] text-resolve-muted"
                          : "border-resolve-calm-alert/20 bg-resolve-calm-alert/[0.05] text-resolve-muted",
                      )}
                    >
                      {lastResult.ok ? (
                        <>
                          <span className="font-medium text-white">Authorized</span>{" "}
                          {formatUnitPrice(lastResult.amountUsd ?? 0)} USDC
                          {lastResult.data?.sentiment && (
                            <>
                              {" "}
                              · sentiment{" "}
                              <span className="text-resolve-calm-periwinkle">
                                {lastResult.data.sentiment}
                              </span>
                            </>
                          )}
                          {lastResult.authorizationId && (
                            <span className="mt-1 block text-[10px] text-resolve-muted-dim">
                              Ledger {lastResult.authorizationId.slice(0, 12)}…
                            </span>
                          )}
                        </>
                      ) : (
                        lastResult.error ?? "Gateway unavailable for live settlement"
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isMission && (
                <p className="text-center text-xs text-resolve-muted-dim">
                  Invoke and authorize signals from{" "}
                  <Link
                    href={missionHref}
                    className="font-medium text-resolve-calm-blue hover:text-resolve-accent"
                  >
                    Mission control
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
