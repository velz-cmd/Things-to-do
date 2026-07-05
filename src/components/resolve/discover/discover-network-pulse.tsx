"use client";

import Link from "next/link";
import clsx from "clsx";
import { Activity, ArrowRight, Radio } from "lucide-react";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverDegradedHint,
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";
import { ACTION_ERRORS } from "@/lib/copy/action-errors";

export function DiscoverNetworkPulse({
  className,
  variant = "card",
}: {
  className?: string;
  variant?: "card" | "strip";
}) {
  const { feed, loading, error, refresh } = useDiscoverRadarFeed();

  const actions = (
    <>
      <DiscoverSectionRefresh
        sectionId="network-pulse"
        onRefresh={refresh}
        lastUpdated={feed?.updatedAt}
      />
      {feed?.intelligence && feed.intelligence.leakingUsd > 0 && (
        <a
          href="#opportunities"
          className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15"
        >
          ${feed.intelligence.leakingUsd.toFixed(0)} {feed.intelligence.flowGapLabel.toLowerCase()}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
      {feed?.intelligence?.sensorsOnline === 0 && feed?.intelligence?.recognizedUsd === 0 && (
        <Link
          href="#discover-workspace"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/65 hover:text-white"
        >
          <Radio className="h-3 w-3" />
          Explore programs
        </Link>
      )}
    </>
  );

  let body: React.ReactNode;
  if (loading && !feed) {
    body = <p className="text-xs text-resolve-muted">Loading network pulse…</p>;
  } else if (error && !feed?.intelligence) {
    body = (
      <>
        <p className="text-xs text-resolve-muted">{error}</p>
        <DiscoverRetryButton onClick={() => void refresh()} />
      </>
    );
  } else if (!feed?.intelligence) {
    body = (
      <p className="text-xs text-resolve-muted">
        {ACTION_ERRORS.networkPulseEmpty}
      </p>
    );
  } else {
    const { intelligence: i, fundableCount, ossSignalCount, realSignalCount } = feed;
    const hasActivity =
      i.recognizedUsd > 0 || i.settledUsd > 0 || i.leakingUsd > 0 || i.sensorsOnline > 0;

    body = (
      <>
        <div className="flex items-start gap-2">
          <Activity className="mt-0.5 h-4 w-4 text-resolve-calm-periwinkle" />
          <div>
            <p className="text-sm text-white">
              {hasActivity ? i.headline : "Value discovery is live — explore community programs in the workspace below"}
            </p>
            {realSignalCount > 0 && (
              <p className="mt-0.5 text-[10px] text-white/45">
                {realSignalCount} ledger-verified gap{realSignalCount === 1 ? "" : "s"}
              </p>
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
      </>
    );
  }

  if (variant === "strip") {
    const i = feed?.intelligence;
    const showSkeleton = loading && !feed;
    return (
      <DiscoverCapitalCard
        id="network-pulse"
        className={clsx("discover-pulse-strip scroll-mt-24", className)}
        padding={false}
      >
        <div className="px-3.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Activity className="h-3.5 w-3.5 shrink-0 text-resolve-calm-periwinkle" />
              {showSkeleton ? (
                <div className="discover-pulse-skeleton min-w-[12rem] flex-1">
                  <span className="discover-pulse-skeleton__line w-3/4" />
                  <span className="discover-pulse-skeleton__line mt-1.5 w-1/2 opacity-60" />
                </div>
              ) : (
                <p className="truncate text-[11px] text-white">
                  {i ? (
                    i.headline
                  ) : error ? (
                    <span className="text-amber-200/90">{error}</span>
                  ) : (
                    <span className="text-resolve-muted">Ranking opportunities across communities…</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <DiscoverSectionRefresh
                sectionId="network-pulse"
                onRefresh={refresh}
                lastUpdated={feed?.updatedAt}
              />
              {i && i.leakingUsd > 0 && (
                <a
                  href="#discover-workspace"
                  className="discover-action-btn discover-action-btn--primary discover-action-btn--fund rounded-full px-2.5 py-0.5 text-[10px]"
                >
                  ${i.leakingUsd.toFixed(0)} leaking
                </a>
              )}
            </div>
          </div>
          {showSkeleton ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <span key={idx} className="discover-pulse-skeleton__chip h-5 w-14 rounded-md" />
              ))}
            </div>
          ) : i ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StripStat label="Rec" value={`$${i.recognizedUsd.toFixed(0)}`} />
              <StripStat label="Pend" value={`$${i.pendingFundingUsd.toFixed(0)}`} />
              <StripStat label="Settled" value={`$${i.settledUsd.toFixed(0)}`} />
              <StripStat
                label="Leak"
                value={`$${i.leakingUsd.toFixed(0)}`}
                warn={i.leakingUsd > 0}
              />
              <StripStat label="Prog" value={String(feed?.fundableCount ?? 0)} />
              <StripStat label="OSS" value={String(feed?.ossSignalCount ?? 0)} />
            </div>
          ) : null}
        </div>
      </DiscoverCapitalCard>
    );
  }

  return (
    <DiscoverPremiumSection
      id="network-pulse"
      title="Network pulse"
      subtitle="Live ledger totals — recognized, pending, and leaking value"
      actions={actions}
      className={className}
    >
      {body}
    </DiscoverPremiumSection>
  );
}

function StripStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] tabular-nums",
        warn ? "text-amber-200" : "text-white/90",
      )}
    >
      <span className="text-white/40">{label}</span>
      {value}
    </span>
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wide text-white/45">{label}</p>
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
