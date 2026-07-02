import clsx from "clsx";
import { Activity, CircleDollarSign, Layers, Radio, Users, Wrench } from "lucide-react";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import { humanizeHealthLabel, humanizeSensorLabel } from "@/lib/communities/humanize-vitals";

type CommunityVitalsRowProps = {
  vitals: CommunityVitalsSummary;
  compact?: boolean;
};

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: "default" | "live" | "muted" | "warn";
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-resolve-muted-dim">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={clsx(
          "mt-0.5 truncate text-xs font-medium",
          tone === "live" && "text-emerald-300",
          tone === "warn" && "text-amber-300",
          tone === "muted" && "text-resolve-muted",
          tone === "default" && "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CommunityVitalsRow({ vitals, compact = false }: CommunityVitalsRowProps) {
  const healthValue =
    vitals.healthPct != null ? `${vitals.healthPct}%` : "—";
  const healthTone =
    vitals.healthPct == null
      ? "muted"
      : vitals.healthPct >= 70
        ? "live"
        : vitals.healthPct >= 40
          ? "default"
          : "warn";

  const buildersValue =
    vitals.topBuilders.length > 0
      ? vitals.topBuilders.map((b) => b.label).join(", ")
      : vitals.hasLiveData
        ? "No builders yet"
        : "—";

  const sensorTone = vitals.sensor.live ? "live" : vitals.sensor.ready ? "default" : "warn";

  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.06] bg-black/20",
        compact ? "px-3 py-2.5" : "px-3.5 py-3",
      )}
    >
      <div
        className={clsx(
          "grid gap-3",
          compact ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        )}
      >
        <Metric icon={Activity} label="Health" value={healthValue} tone={healthTone} />
        <Metric
          icon={CircleDollarSign}
          label="Funding"
          value={vitals.fundingLabel}
          tone={vitals.fundingTotalUsd > 0 ? "live" : "muted"}
        />
        <Metric
          icon={Wrench}
          label="Open work"
          value={vitals.openWorkCount > 0 ? String(vitals.openWorkCount) : vitals.hasLiveData ? "0" : "—"}
          tone={vitals.openWorkCount > 0 ? "live" : "muted"}
        />
        <Metric
          icon={Layers}
          label="Programs"
          value={vitals.programCount > 0 ? String(vitals.programCount) : vitals.hasLiveData ? "0" : "—"}
          tone={vitals.programCount > 0 ? "default" : "muted"}
        />
        <Metric icon={Users} label="Top builders" value={buildersValue} tone="muted" />
        <Metric icon={Radio} label="Proof" value={humanizeSensorLabel(vitals.sensor.label)} tone={sensorTone} />
      </div>
      {!compact && vitals.healthLabel && (
        <p className="mt-2 text-[10px] text-resolve-muted-dim">{humanizeHealthLabel(vitals.healthLabel)}</p>
      )}
    </div>
  );
}
