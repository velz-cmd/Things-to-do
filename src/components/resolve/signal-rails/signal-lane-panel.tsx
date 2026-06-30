"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Clapperboard,
  FileSearch,
  GitMerge,
  MessageSquareText,
  Music2,
  ShieldCheck,
} from "lucide-react";
import type { PremiumSignalService } from "@/components/resolve/signal-rails/premium-signal-card";

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  sentiment: MessageSquareText,
  research: FileSearch,
  music: Music2,
  oss: GitMerge,
  video: Clapperboard,
  agent: Bot,
};

function formatUnitPrice(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

function SignalServiceRow({
  service,
  isMission,
  onUseInMission,
}: {
  service: PremiumSignalService;
  isMission: boolean;
  onUseInMission?: () => void;
}) {
  const Icon = DOMAIN_ICONS[service.domain] ?? Bot;

  return (
    <li className="resolve-signal-service-row group/row">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="resolve-signal-row-icon mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <Icon className="h-3.5 w-3.5 text-white/85" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{service.name}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/60">{service.tagline}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-base font-semibold text-white">{formatUnitPrice(service.priceUsd)}</span>
            <span className="resolve-signal-pill">{service.x402 ? "x402" : "sensor"}</span>
          </div>
          <span className="text-[9px] uppercase tracking-wide text-white/45">
            per {service.billingUnit}
          </span>
        </div>
      </div>

      <p className="mt-2 pl-9 text-xs leading-relaxed text-white/55">{service.description}</p>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pl-9">
        <p className="flex items-center gap-1.5 text-[10px] text-white/40">
          <ShieldCheck className="h-3 w-3 shrink-0 text-resolve-calm-periwinkle/70" />
          {service.eventType}
          <span className="opacity-35">·</span>
          {service.connectorId}
        </p>
        {isMission && onUseInMission && (
          <button
            type="button"
            onClick={onUseInMission}
            className="text-[10px] font-medium text-resolve-calm-periwinkle opacity-0 transition group-hover/row:opacity-100 hover:text-white sm:opacity-100"
          >
            Use in mission →
          </button>
        )}
      </div>
    </li>
  );
}

/** Lane grouping — sits inside the main gradient card body. */
export function SignalLaneSection({
  title,
  subtitle,
  services,
  isMission,
  onUseInMission,
}: {
  title: string;
  subtitle: string;
  services: PremiumSignalService[];
  isMission: boolean;
  onUseInMission?: (serviceId: string, examplePrompt: string) => void;
}) {
  return (
    <section className="resolve-signal-lane-section">
      <div className="resolve-signal-lane-heading">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
          {title}
        </h3>
        <p className="mt-1 text-[11px] text-resolve-calm-periwinkle/90">{subtitle}</p>
      </div>
      <ul className="mt-3 space-y-1">
        {services.map((s) => (
          <SignalServiceRow
            key={s.id}
            service={s}
            isMission={isMission}
            onUseInMission={
              onUseInMission ? () => onUseInMission(s.id, s.examplePrompt) : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}
