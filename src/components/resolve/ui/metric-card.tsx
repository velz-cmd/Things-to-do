import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

type Tone = "default" | "accent" | "success" | "warning" | "violet";

const toneStyles: Record<Tone, { border: string; value: string; icon: string; glow: string }> = {
  default: {
    border: "",
    value: "text-white",
    icon: "text-resolve-muted",
    glow: "",
  },
  accent: {
    border: "ring-1 ring-cyan-400/15",
    value: "text-cyan-100",
    icon: "text-cyan-400",
    glow: "shadow-[0_0_30px_rgba(56,189,248,0.08)]",
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
  violet: {
    border: "ring-1 ring-violet-400/15",
    value: "text-violet-200",
    icon: "text-violet-400",
    glow: "shadow-[0_0_30px_rgba(167,139,250,0.08)]",
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
    <Panel
      variant="glass"
      hover
      className={clsx("p-0", t.border, t.glow, className)}
      padding={false}
    >
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
    </Panel>
  );
}
