import clsx from "clsx";

const VARIANTS: Record<string, string> = {
  ready: "border-resolve-accent/30 bg-resolve-accent-muted text-blue-300",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  waiting: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  settled: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  escrowed: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-300",
  demo: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  neutral: "border-resolve-border-strong bg-resolve-hover text-resolve-muted",
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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        VARIANTS[variant] ?? VARIANTS.neutral
      )}
    >
      {label}
    </span>
  );
}

export function statusVariantForMission(status: string): keyof typeof VARIANTS {
  if (status === "settled" || status === "verified") return "settled";
  if (status === "failed" || status === "refunded") return "blocked";
  if (["executing", "retrying", "waiting_for_response"].includes(status)) return "running";
  if (status === "proof_pending") return "verified";
  if (["authorized", "planning", "evidence_gathering"].includes(status)) return "escrowed";
  return "waiting";
}
