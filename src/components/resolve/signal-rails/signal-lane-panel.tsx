"use client";

import Link from "next/link";
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
    <li className="resolve-signal-service-row">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-resolve-calm-periwinkle/70" strokeWidth={1.75} />
          <p className="text-sm font-medium text-white">{service.name}</p>
          {service.rfbProgram && (
            <span className="resolve-calm-chip rounded px-1.5 py-0.5 text-[9px] font-medium uppercase">
              {service.rfbProgram}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-sm font-semibold text-white">{formatUnitPrice(service.priceUsd)}</span>
          <span className="resolve-calm-chip rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
            {service.x402 ? "x402" : "sensor"}
          </span>
          <span className="text-[9px] uppercase text-resolve-muted-dim">/ {service.billingUnit}</span>
        </div>
      </div>

      <p className="mt-1 pl-6 text-[11px] text-resolve-muted">{service.tagline}</p>
      <p className="mt-1.5 pl-6 text-xs leading-relaxed text-resolve-muted-dim">{service.description}</p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-6">
        <p className="flex items-center gap-1 text-[10px] text-resolve-muted-dim">
          <ShieldCheck className="h-3 w-3 shrink-0 opacity-60" />
          {service.eventType}
          <span className="opacity-40">·</span>
          {service.connectorId}
        </p>
        {isMission && onUseInMission && (
          <button
            type="button"
            onClick={onUseInMission}
            className="text-[10px] font-medium text-resolve-calm-periwinkle hover:text-white"
          >
            Use in mission →
          </button>
        )}
      </div>
    </li>
  );
}

/** Lane grouping — typography only, no nested card. */
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
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-resolve-calm-periwinkle">
        {title}
      </h3>
      <p className="mt-0.5 text-[11px] text-white/50">{subtitle}</p>
      <ul className="mt-3 divide-y divide-white/[0.05]">
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
