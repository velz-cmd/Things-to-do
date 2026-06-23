"use client";

import clsx from "clsx";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";

const STATE_STYLES: Record<string, string> = {
  connected: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  ready: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  missing: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  needs_auth: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  error: "bg-red-500/15 text-red-300 border-red-500/30",
};

const STATE_LABEL: Record<string, string> = {
  connected: "Connected",
  ready: "Ready",
  missing: "Required",
  needs_auth: "Required",
  error: "Error",
};

export function ConnectorReadinessPanel({
  connectors,
  category,
  compact,
}: {
  connectors: ConnectorStatus[];
  category?: string;
  compact?: boolean;
}) {
  const visible = compact
    ? connectors.filter((c) =>
        ["gmail", "arc", "browser", "resend", "finance"].includes(c.id)
      )
    : connectors;

  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Connector readiness
      </p>
      <div className={clsx("mt-3 grid gap-2", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        {visible.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-deputy-border/60 bg-deputy-bg/50 px-3 py-2"
          >
            <span className="text-sm">{c.label}</span>
            <span
              className={clsx(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase",
                STATE_STYLES[c.state]
              )}
            >
              {STATE_LABEL[c.state] ?? c.state}
            </span>
          </div>
        ))}
      </div>
      {category && (
        <p className="mt-2 text-[11px] text-deputy-muted">
          Requirements for {category.replace(/_/g, " ")}
        </p>
      )}
    </section>
  );
}
