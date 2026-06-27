"use client";

import type { ServerWorkbench } from "@/lib/mission/client-api";
import { ExternalLink, Wrench } from "lucide-react";

export function MissionWorkbenchPanel({
  workbench,
  loading,
  expanded,
  onToggle,
}: {
  workbench: ServerWorkbench | null;
  loading?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="px-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 text-left"
      >
        <Wrench className="h-3.5 w-3.5 text-resolve-muted-dim" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          Workbench
        </p>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 px-2">
          {loading && (
            <p className="text-xs text-resolve-muted-dim">Loading live systems…</p>
          )}
          {workbench && (
            <>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                  Treasury
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  ${workbench.treasury.balanceUsd.toLocaleString()} USDC
                </p>
                <p className="mt-0.5 text-[10px] text-resolve-muted-dim">
                  {workbench.treasury.canSettleGlobally ?
                    "Ready to settle"
                  : workbench.treasury.blockers[0] ?? "Settlement blocked"}
                </p>
              </div>

              {workbench.ledger && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                    Ledger
                  </p>
                  <p className="mt-1 text-xs text-resolve-muted">
                    {workbench.ledger.count} authorizations · $
                    {Math.round(workbench.ledger.claimableUsd).toLocaleString()} claimable
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                  Connectors
                </p>
                {workbench.connectors.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-[11px] text-resolve-muted"
                  >
                    <span className="capitalize">{c.id}</span>
                    <span
                      className={
                        c.health === "healthy" ? "text-emerald-400/80" : "text-resolve-muted-dim"
                      }
                    >
                      {c.health}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">APIs</p>
                {workbench.apis.map((api) => (
                  <a
                    key={api.id}
                    href={api.href}
                    className="flex items-center gap-1 text-[11px] text-resolve-muted transition hover:text-white"
                  >
                    <span className={api.live ? "text-emerald-400/70" : "text-resolve-muted-dim"}>
                      ●
                    </span>
                    {api.label}
                    <ExternalLink className="h-3 w-3 opacity-40" />
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
