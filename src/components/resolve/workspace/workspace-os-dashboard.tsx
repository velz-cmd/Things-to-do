"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

type Overview = {
  tagline: string;
  subtitle: string;
  sources: {
    id: string;
    label: string;
    connected: boolean;
    status: "connected" | "syncing" | "needs_attention" | "disconnected" | "soon";
  }[];
  timeline: {
    label: string;
    authorizationCount: number;
    amountUsd: number;
    reason: string;
  }[];
  valueFlow: { stage: string; amountUsd: number; tone: string }[];
  valueOwed: {
    authorizedUsd: number;
    pendingFundingUsd: number;
    claimableUsd: number;
    settledUsd: number;
    totalVerifiedUsd: number;
  } | null;
  liveActivity: {
    id: string;
    domain: string;
    eventLabel: string;
    amountUsd: number;
    status: string;
    context: string;
    explanation: string;
    confidence?: number;
    at: string;
  }[];
  recommendedActions: {
    id: string;
    label: string;
    href: string;
    priority: string;
    detail?: string;
    evidence?: string;
  }[];
  aiInsight: string | null;
};

function relative(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function sourceStatusLabel(s: Overview["sources"][0]["status"]) {
  if (s === "connected") return "Connected";
  if (s === "syncing") return "Syncing";
  if (s === "needs_attention") return "Needs attention";
  if (s === "soon") return "Coming soon";
  return "Disconnected";
}

export function WorkspaceOsDashboard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/workspace/overview")
        .then((r) => r.json())
        .then((d) => setData(d))
        .finally(() => setLoading(false));

    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <Panel variant="glass" className="p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-resolve-border border-t-resolve-accent" />
        <p className="mt-4 text-sm text-resolve-muted">Loading live ecosystem data…</p>
      </Panel>
    );
  }

  if (!data) return null;

  const maxFlow = Math.max(...data.valueFlow.map((v) => v.amountUsd), 1);

  return (
    <div className={compact ? "space-y-6" : "space-y-8"}>
      {!compact && (
        <>
          <header className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-resolve-accent">
              Open ecosystems
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {data.tagline}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-resolve-muted">{data.subtitle}</p>
          </header>

          {data.aiInsight && (
            <Panel variant="accent" className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
                Continuously watching open ecosystems
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/90">{data.aiInsight}</p>
            </Panel>
          )}
        </>
      )}

      {/* 1. Connected sources — sensors, not products */}
      <section>
        <SectionTitle>Connected sources</SectionTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-resolve-lg border border-resolve-border/60 resolve-glass-subtle px-4 py-3 transition hover:border-resolve-accent/20"
            >
              <span className="text-sm text-white">{s.label}</span>
              <span
                className={clsx(
                  "text-[10px] font-medium",
                  s.status === "connected" && "text-emerald-300",
                  s.status === "syncing" && "text-sky-300",
                  s.status === "needs_attention" && "text-amber-300",
                  s.status === "soon" && "text-resolve-muted",
                  s.status === "disconnected" && "text-resolve-muted-dim",
                )}
              >
                {sourceStatusLabel(s.status)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Live activity — one stream */}
      <section>
        <SectionTitle>Live activity</SectionTitle>
        {data.liveActivity.length === 0 ?
          <p className="mt-2 text-sm text-resolve-muted">
            No activity yet. Value from code, music, research, and more will stream here
            automatically.
          </p>
        : <ul className="mt-3 divide-y divide-resolve-border/40 overflow-hidden rounded-resolve-lg border border-resolve-border/60 resolve-glass">
            {data.liveActivity.slice(0, 12).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setExpandedEvent(expandedEvent === a.id ? null : a.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-resolve-hover/30"
                >
                  <span className="mt-0.5 text-[10px] font-medium uppercase text-resolve-accent">
                    {a.domain}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      {a.eventLabel}
                      <span className="text-resolve-muted"> · {a.context}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-resolve-muted">
                      <Money amount={a.amountUsd} size="sm" className="inline" />
                      <span className="mx-1">·</span>
                      {a.status.replace("_", " ")}
                      <span className="mx-1">·</span>
                      {relative(a.at)}
                    </p>
                    {expandedEvent === a.id && (
                      <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                        {a.explanation}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className={clsx(
                      "h-4 w-4 shrink-0 text-resolve-muted transition",
                      expandedEvent === a.id && "rotate-90",
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        }
      </section>

      {/* Today's timeline */}
      {data.timeline.length > 0 && (
        <section>
          <SectionTitle>Today</SectionTitle>
          <ul className="mt-3 space-y-3">
            {data.timeline.map((t) => (
              <Panel key={t.label} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-sm text-emerald-300">
                    +{t.authorizationCount} authorization{t.authorizationCount === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-resolve-muted">because {t.reason}</p>
              </Panel>
            ))}
          </ul>
        </section>
      )}

      {/* 3. What am I owed? */}
      {!compact && data.valueOwed && data.valueOwed.totalVerifiedUsd > 0 && (
        <section>
          <SectionTitle>What you&apos;re owed</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Recognized" amount={data.valueOwed.authorizedUsd} />
            <MetricCard label="Pending funding" amount={data.valueOwed.pendingFundingUsd} />
            <MetricCard label="Claimable" amount={data.valueOwed.claimableUsd} accent />
            <MetricCard label="Settled" amount={data.valueOwed.settledUsd} />
          </div>
        </section>
      )}

      {/* 4. Value flow */}
      {!compact && data.valueFlow.some((v) => v.amountUsd > 0) && (
        <section>
          <SectionTitle>Where value is flowing</SectionTitle>
          <Panel className="mt-3 p-4">
            <div className="flex flex-wrap items-end gap-4">
              {data.valueFlow.map((v, i) => (
                <div key={v.stage} className="flex items-center gap-2">
                  <div className="text-center">
                    <div
                      className="mx-auto w-12 rounded-t bg-resolve-accent/30"
                      style={{
                        height: `${Math.max(8, (v.amountUsd / maxFlow) * 48)}px`,
                      }}
                    />
                    <p className="mt-2 text-[10px] uppercase text-resolve-muted">{v.stage}</p>
                    <p className="text-xs font-medium text-white">
                      <Money amount={v.amountUsd} size="sm" className="inline" />
                    </p>
                  </div>
                  {i < data.valueFlow.length - 1 && (
                    <span className="mb-6 text-resolve-muted-dim">→</span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}

      {/* 5. Recommended actions */}
      {!compact && data.recommendedActions.length > 0 && (
        <section>
          <SectionTitle>Recommended actions</SectionTitle>
          <ul className="mt-3 space-y-2">
            {data.recommendedActions.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between rounded-lg border border-resolve-border/60 px-4 py-3 text-sm text-white hover:border-resolve-accent/40 hover:bg-resolve-hover/20"
                >
                  <span>
                    <span className="block">{a.label}</span>
                    {"detail" in a && a.detail && (
                      <span className="mt-0.5 block text-xs font-normal text-resolve-muted">
                        {a.detail}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-resolve-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-medium uppercase tracking-[0.15em] text-resolve-muted">
      {children}
    </h2>
  );
}

function MetricCard({
  label,
  amount,
  accent,
}: {
  label: string;
  amount: number;
  accent?: boolean;
}) {
  return (
    <Panel variant="glass" className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-resolve-muted">{label}</p>
      <p className={clsx("mt-2 text-xl font-semibold tabular-nums", accent ? "text-emerald-300" : "text-white")}>
        <Money amount={amount} size="sm" />
      </p>
    </Panel>
  );
}
