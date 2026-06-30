"use client";

import Link from "next/link";
import clsx from "clsx";
import { Activity, ArrowRight, Radio } from "lucide-react";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverDegradedHint,
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";

export function DiscoverNetworkPulse({ className }: { className?: string }) {
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
      {feed?.intelligence?.sensorsOnline === 0 && (
        <a
          href="#communities"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/65 hover:text-white"
        >
          <Radio className="h-3 w-3" />
          Connect sensors
        </a>
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
        Network pulse unavailable — connect sensors to populate ledger.
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
              {hasActivity ? i.headline : "Connect ecosystems — value discovery starts with sensors"}
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
