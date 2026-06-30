"use client";

import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  Clapperboard,
  FileSearch,
  GitMerge,
  MessageSquareText,
  Music2,
  ShieldCheck,
} from "lucide-react";
export type SignalLane = "agent" | "creator" | "maintainer";

export type PremiumSignalService = {
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
};

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  sentiment: MessageSquareText,
  research: FileSearch,
  music: Music2,
  oss: GitMerge,
  video: Clapperboard,
  agent: Bot,
};

const FOOTER_COPY: Record<SignalLane, { discover: string; mission: string }> = {
  agent: { discover: "See capability details", mission: "Use in mission" },
  creator: { discover: "View attribution rail", mission: "Use in mission" },
  maintainer: { discover: "View maintainer rail", mission: "Use in mission" },
};

function formatUnitPrice(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

export function PremiumSignalCard({
  service,
  lane,
  featured = false,
  isMission,
  missionHref = "/mission#signal-rails",
  onUseInMission,
}: {
  service: PremiumSignalService;
  lane: SignalLane;
  featured?: boolean;
  isMission: boolean;
  missionHref?: string;
  onUseInMission?: () => void;
}) {
  const Icon = DOMAIN_ICONS[service.domain] ?? Bot;
  const footerLabel = isMission ? FOOTER_COPY[lane].mission : FOOTER_COPY[lane].discover;

  const stripInner = (
    <>
      <span className="text-[11px] font-medium tracking-wide text-white/85">{footerLabel}</span>
      <ArrowRight className="h-3.5 w-3.5 text-white/70 transition-transform group-hover/strip:translate-x-0.5" />
    </>
  );

  return (
    <article
      className={clsx(
        "resolve-premium-signal-card resolve-card-hover group flex flex-col",
        `resolve-premium-signal-card--${lane}`,
        featured && "resolve-premium-signal-card--featured",
      )}
    >
      <div className="relative z-[1] flex flex-1 flex-col p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
              <Icon className="h-4 w-4 text-[#0a1628]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-semibold text-white">{service.name}</h3>
                {service.rfbProgram && (
                  <span className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white/90">
                    {service.rfbProgram}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-white/65">{service.tagline}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-white">
            {formatUnitPrice(service.priceUsd)}
          </p>
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90">
            {service.x402 ? "x402" : "sensor"}
          </span>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-white/50">
          per {service.billingUnit}
        </p>

        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/70">{service.description}</p>

        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/45">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {service.eventType}
            <span className="mx-1 opacity-50">·</span>
            {service.connectorId}
          </span>
        </p>
      </div>

      {isMission && onUseInMission ? (
        <button
          type="button"
          onClick={onUseInMission}
          className="resolve-silver-strip group/strip relative z-[1] mt-auto flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.06]"
        >
          {stripInner}
        </button>
      ) : (
        <Link
          href={missionHref}
          className="resolve-silver-strip group/strip relative z-[1] mt-auto flex items-center justify-between px-4 py-3 transition hover:bg-white/[0.06]"
        >
          {stripInner}
        </Link>
      )}
    </article>
  );
}
