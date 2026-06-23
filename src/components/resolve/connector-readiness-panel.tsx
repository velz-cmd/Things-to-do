"use client";

import clsx from "clsx";
import { Mail, Globe, Wallet, CreditCard, Send } from "lucide-react";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";

const ICONS: Record<string, typeof Mail> = {
  gmail: Mail,
  browser: Globe,
  arc: Wallet,
  finance: CreditCard,
  resend: Send,
};

const STATE_STYLES: Record<string, string> = {
  connected: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  ready: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  missing: "bg-white/5 text-resolve-muted border-white/10",
  needs_auth: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  error: "bg-red-500/10 text-red-300 border-red-500/30",
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
    <GlassPanel className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-resolve-muted">
        Connector readiness
      </p>
      <div className={clsx("mt-3 grid gap-2", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        {visible.map((c) => {
          const Icon = ICONS[c.id] ?? Globe;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                <Icon className="h-3.5 w-3.5 text-resolve-muted" />
                {c.label}
              </span>
              <span
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  STATE_STYLES[c.state]
                )}
              >
                {STATE_LABEL[c.state] ?? c.state}
              </span>
            </div>
          );
        })}
      </div>
      {category && (
        <p className="mt-2 text-[11px] text-resolve-muted">
          Requirements for {category.replace(/_/g, " ")}
        </p>
      )}
    </GlassPanel>
  );
}
