import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";

type Tone = "default" | "accent" | "success" | "warning" | "blue" | "orange";

const toneStyles: Record<Tone, { border: string; value: string; icon: string; glow: string }> = {
  default: {
    border: "",
    value: "text-white",
    icon: "text-resolve-muted",
    glow: "",
  },
  accent: {
    border: "ring-1 ring-resolve-accent/20",
    value: "text-blue-100",
    icon: "text-resolve-accent-bright",
    glow: "shadow-[0_0_30px_rgba(0,122,255,0.1)]",
  },
  success: {
    border: "ring-1 ring-emerald-400/15",
    value: "text-emerald-200",
    icon: "text-emerald-400",
    glow: "shadow-[0_0_30px_rgba(52,211,153,0.08)]",
  },
  warning: {
    border: "ring-1 ring-amber-400/15",
    value: "text-amber-200",
    icon: "text-amber-400",
    glow: "",
  },
  blue: {
    border: "ring-1 ring-resolve-accent/25",
    value: "text-blue-50",
    icon: "text-resolve-accent",
    glow: "shadow-[0_0_30px_rgba(0,122,255,0.12)]",
  },
  orange: {
    border: "ring-1 ring-orange-400/20",
    value: "text-orange-100",
    icon: "text-resolve-orange",
    glow: "shadow-[0_0_30px_rgba(255,122,69,0.1)]",
  },
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  live,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  live?: boolean;
  className?: string;
}) {
  const t = toneStyles[tone];
  return (
    <BlueGlowCard hover className={clsx("p-0", t.border, t.glow, className)} padding={false}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
            {label}
          </p>
          {Icon && <Icon className={clsx("h-4 w-4", t.icon)} strokeWidth={1.5} />}
        </div>
        <p
          className={clsx(
            "mt-3 flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight",
            t.value,
          )}
        >
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}
          {value}
        </p>
        {hint && <p className="mt-1.5 text-[11px] text-resolve-muted-dim">{hint}</p>}
      </div>
    </BlueGlowCard>
  );
}
