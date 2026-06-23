import clsx from "clsx";

const VARIANTS: Record<string, string> = {
  ready: "border-resolve-primary/30 bg-resolve-primary/10 text-sky-300",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  waiting: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-300",
  demo: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  neutral: "border-white/10 bg-white/5 text-resolve-muted",
};

export function StatusChip({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        VARIANTS[variant] ?? VARIANTS.neutral
      )}
    >
      {label}
    </span>
  );
}
