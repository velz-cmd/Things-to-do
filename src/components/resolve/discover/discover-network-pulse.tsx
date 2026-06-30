"use client";

import Link from "next/link";
import clsx from "clsx";
import { Activity, ArrowRight, Radio, Wallet } from "lucide-react";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";

export function DiscoverNetworkPulse({ className }: { className?: string }) {
  const { feed, loading } = useDiscoverRadarFeed();

  if (loading || !feed?.intelligence) {
    return (
      <div className={clsx("rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/30 px-5 py-4", className)}>
        <p className="text-xs text-resolve-muted">Loading network pulse…</p>
      </div>
    );
  }

  const { intelligence: i, fundableCount, ossSignalCount, claimHint, realSignalCount } = feed;
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
                {realSignalCount} verified gap{realSignalCount === 1 ? "" : "s"} from live sources
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {claimHint && claimHint.claimableUsd > 0 && (
            <Link
              href={claimHint.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15"
            >
              <Wallet className="h-3 w-3" />
              ${claimHint.claimableUsd.toFixed(2)} ready to claim
            </Link>
          )}
          {i.leakingUsd > 0 && (
            <a
              href="#opportunities"
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15"
            >
              ${i.leakingUsd.toFixed(0)} leaking
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

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <PulseStat label="Recognized" value={`$${i.recognizedUsd.toFixed(0)}`} />
        <PulseStat label="Pending" value={`$${i.pendingFundingUsd.toFixed(0)}`} />
        <PulseStat label="Settled" value={`$${i.settledUsd.toFixed(0)}`} />
        <PulseStat
          label="Leaking"
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
