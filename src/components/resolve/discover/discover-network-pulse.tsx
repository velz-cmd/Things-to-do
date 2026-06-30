"use client";

import Link from "next/link";
import clsx from "clsx";
import { Activity, ArrowRight, Radio } from "lucide-react";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverDegradedHint,
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";

export function DiscoverNetworkPulse({ className }: { className?: string }) {
  const { feed, loading, error, refresh } = useDiscoverRadarFeed();

  if (loading && !feed) {
    return (
      <DiscoverStatePanel variant="loading" className={clsx("px-5 py-4 text-left", className)}>
        <p className="text-xs text-resolve-muted">Loading network pulse…</p>
      </DiscoverStatePanel>
    );
  }

  if (error && !feed?.intelligence) {
    return (
      <DiscoverStatePanel variant="error" className={clsx("px-5 py-4 text-left", className)}>
        <p className="text-xs text-resolve-muted">{error}</p>
        <DiscoverRetryButton onClick={() => void refresh()} />
      </DiscoverStatePanel>
    );
  }

  if (!feed?.intelligence) {
    return (
      <DiscoverStatePanel variant="empty" className={clsx("px-5 py-4 text-left", className)}>
        <p className="text-xs text-resolve-muted">
          Network pulse unavailable — connect sensors to populate ledger.
        </p>
      </DiscoverStatePanel>
    );
  }

  const { intelligence: i, fundableCount, ossSignalCount, realSignalCount } = feed;
  const hasActivity =
    i.recognizedUsd > 0 || i.settledUsd > 0 || i.leakingUsd > 0 || i.sensorsOnline > 0;

  return (
    <section
      className={clsx(
        "rounded-xl border border-resolve-border/60 bg-gradient-to-br from-resolve-bg-deep/50 to-[#060a12]/80 px-5 py-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-resolve-accent" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              Network pulse
            </p>
            <p className="mt-0.5 text-sm text-white">
              {hasActivity ? i.headline : "Connect ecosystems — value discovery starts with sensors"}
            </p>
            {realSignalCount > 0 && (
              <p className="mt-0.5 text-[10px] text-resolve-muted-dim">
                {realSignalCount} ledger-verified gap{realSignalCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DiscoverSectionRefresh
            sectionId="network-pulse"
            onRefresh={refresh}
            lastUpdated={feed?.updatedAt}
          />
          {i.leakingUsd > 0 && (
            <a
              href="#opportunities"
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15"
            >
              ${i.leakingUsd.toFixed(0)} {i.flowGapLabel.toLowerCase()}
              <ArrowRight className="h-3 w-3" />
            </a>
          )}
          {i.sensorsOnline === 0 && (
            <a
              href="#communities"
              className="inline-flex items-center gap-1 rounded-full border border-resolve-border/60 px-3 py-1 text-[11px] text-resolve-muted hover:text-white"
            >
              <Radio className="h-3 w-3" />
              Connect sensors
            </a>
          )}
        </div>
      </div>

      {feed.degraded && (
        <DiscoverDegradedHint onRefresh={() => void refresh()} className="mt-3" />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <PulseStat label="Recognized" value={`$${i.recognizedUsd.toFixed(0)}`} />
        <PulseStat label="Pending" value={`$${i.pendingFundingUsd.toFixed(0)}`} />
        <PulseStat label="Settled" value={`$${i.settledUsd.toFixed(0)}`} />
        <PulseStat
          label={i.flowGapLabel}
          value={`$${i.leakingUsd.toFixed(0)}`}
          tone={i.leakingUsd > 0 ? "warning" : undefined}
        />
        <PulseStat label="Programs" value={String(fundableCount)} />
        <PulseStat label="OSS signals" value={String(ossSignalCount)} />
      </div>
    </section>
  );
}

function PulseStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">{label}</p>
      <p
        className={clsx(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "warning" ? "text-amber-200" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
