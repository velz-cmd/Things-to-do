import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

type Tone = "default" | "accent" | "success" | "warning" | "violet";

const toneStyles: Record<Tone, { border: string; value: string; icon: string }> = {
  default: { border: "", value: "text-white", icon: "text-resolve-muted" },
  accent: { border: "border-resolve-accent/25", value: "text-sky-200", icon: "text-resolve-accent" },
  success: { border: "border-emerald-500/25", value: "text-emerald-300", icon: "text-emerald-400" },
  warning: { border: "border-amber-500/25", value: "text-amber-200", icon: "text-amber-400" },
  violet: { border: "border-violet-500/25", value: "text-violet-200", icon: "text-violet-400" },
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
      className={clsx("p-4", t.border, className)}
      padding={false}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted">
            {label}
          </p>
          {Icon && <Icon className={clsx("h-3.5 w-3.5", t.icon)} strokeWidth={1.5} />}
        </div>
        <p className={clsx("mt-2 flex items-center gap-2 text-2xl font-semibold tabular-nums", t.value)}>
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}
          {value}
        </p>
        {hint && <p className="mt-1 text-[11px] text-resolve-muted-dim">{hint}</p>}
      </div>
    </Panel>
  );
}
