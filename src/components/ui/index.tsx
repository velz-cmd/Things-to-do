import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-deputy-border bg-deputy-panel p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-deputy-bg/60 p-3">
      <p className="text-xs uppercase tracking-wide text-deputy-muted">{label}</p>
      <p className={clsx("mt-1 font-mono text-lg font-semibold", accent ?? "text-white")}>
        {value}
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    settled: "text-deputy-accent border-deputy-accent/40 bg-deputy-accent/10",
    verified: "text-deputy-accent border-deputy-accent/40 bg-deputy-accent/10",
    failed: "text-deputy-danger border-deputy-danger/40 bg-deputy-danger/10",
    executing: "text-deputy-warn border-deputy-warn/40 bg-deputy-warn/10",
    proof_pending: "text-deputy-warn border-deputy-warn/40 bg-deputy-warn/10",
    escalated: "text-deputy-danger border-deputy-danger/40",
  };
  return (
    <span
      className={clsx(
        "rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wide",
        colors[status] ?? "text-deputy-muted border-deputy-border"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
