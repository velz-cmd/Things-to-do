"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  Music,
  GitBranch,
  BookOpen,
  Rss,
  Video,
  FileText,
  Palette,
  Radio,
} from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";

type DomainIntel = {
  domain: string;
  label: string;
  status: "live" | "waiting" | "soon";
  eventsToday: number;
  authorizationCount: number;
  amountUsd: number;
  awaitingSettlementUsd: number;
  signal: string;
  risk?: string;
};

type NetworkOverview = {
  network: { ecosystemsConnected: number; liveDomains: number; isLive: boolean };
  domainIntelligence: DomainIntel[];
  treasury: { balanceUsd: number; availableUsd: number; message: string } | null;
  recommendedActions: { id: string; label: string; href: string; detail?: string; evidence?: string }[];
  opportunitiesCount?: number;
};

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  music: Music,
  code: GitBranch,
  research: BookOpen,
  feeds: Rss,
  video: Video,
  documentation: FileText,
  photos: Palette,
};

function StatusDot({ status }: { status: DomainIntel["status"] }) {
  return (
    <span
      className={clsx(
        "inline-flex h-2 w-2 rounded-full",
        status === "live" && "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
        status === "waiting" && "bg-amber-400/80",
        status === "soon" && "bg-resolve-muted-dim",
      )}
    />
  );
}

/** Global Value Network — roles and domains, not connector products. */
export function ValueNetworkPanel() {
  const [data, setData] = useState<NetworkOverview | null>(null);
  const [loading, setLoading] = useState(true);

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
      <BlueGlowCard className="p-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-resolve-border border-t-resolve-accent" />
        <p className="mt-4 text-sm text-resolve-muted">Reading live ecosystem signals…</p>
      </BlueGlowCard>
    );
  }

  if (!data) return null;

  const activeDomains = data.domainIntelligence.filter(
    (d) => d.status === "live" || d.eventsToday > 0 || d.authorizationCount > 0,
  );
  const showAll = activeDomains.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-resolve-accent-bright" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              Global value network
            </p>
            {data.network.isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            )}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Here&apos;s what is already happening
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
            {data.network.ecosystemsConnected > 0
              ? `${data.network.ecosystemsConnected} ecosystem sensor${data.network.ecosystemsConnected === 1 ? "" : "s"} connected · open source never sleeps`
              : "Connect ecosystems where value already exists — RESOLVE observes, recognizes, and settles."}
          </p>
        </div>
        {data.treasury && data.treasury.balanceUsd > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
              Treasury available
            </p>
            <p className="text-xl font-semibold tabular-nums text-white">
              <Money amount={data.treasury.availableUsd || data.treasury.balanceUsd} size="sm" />
            </p>
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(showAll ? data.domainIntelligence : [...activeDomains, ...data.domainIntelligence.filter((d) => d.status === "soon")])
          .slice(0, showAll ? 7 : 8)
          .map((d) => {
            const Icon = DOMAIN_ICONS[d.domain] ?? FileText;
            const hasActivity = d.eventsToday > 0 || d.authorizationCount > 0 || d.amountUsd > 0;

            return (
              <BlueGlowCard
                key={d.domain}
                className={clsx("p-4", d.status === "soon" && "opacity-60")}
                grid={hasActivity}
                hover={hasActivity}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-resolve-accent/10 ring-1 ring-resolve-accent/20">
                      <Icon className="h-3.5 w-3.5 text-resolve-accent-bright" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{d.label}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <StatusDot status={d.status} />
                        <span className="text-[10px] capitalize text-resolve-muted-dim">
                          {d.status === "soon" ? "Coming" : d.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {hasActivity ? (
                  <div className="mt-4 space-y-1">
                    {d.eventsToday > 0 && (
                      <p className="text-lg font-semibold tabular-nums text-white">
                        {d.eventsToday.toLocaleString()}
                        <span className="ml-1 text-xs font-normal text-resolve-muted">
                          events today
                        </span>
                      </p>
                    )}
                    {d.authorizationCount > 0 && (
                      <p className="text-xs text-resolve-muted">
                        {d.authorizationCount} awaiting settlement
                        {d.awaitingSettlementUsd > 0 && (
                          <>
                            {" "}
                            ·{" "}
                            <Money amount={d.awaitingSettlementUsd} size="sm" className="inline" />
                          </>
                        )}
                      </p>
                    )}
                    {d.risk && (
                      <p className="text-[10px] font-medium text-amber-200/90">{d.risk}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-xs leading-relaxed text-resolve-muted-dim">{d.signal}</p>
                )}
              </BlueGlowCard>
            );
          })}
      </div>

      {data.recommendedActions.length > 0 && (
        <BlueGlowCard className="border border-resolve-accent/15 p-5" grid={false}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
            Capital recommendations
          </p>
          <ul className="mt-3 space-y-2">
            {data.recommendedActions.slice(0, 3).map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium text-white">{a.label}</span>
                {a.detail && (
                  <span className="mt-0.5 block text-xs text-resolve-muted">{a.detail}</span>
                )}
                {a.evidence && (
                  <span className="mt-0.5 block text-[10px] text-resolve-muted-dim">
                    Evidence: {a.evidence}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </BlueGlowCard>
      )}
    </div>
  );
}
