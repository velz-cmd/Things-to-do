"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Eye, Radio } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import type { ObservatoryAlert } from "@/lib/communities/observatory";

const SEVERITY_STYLES = {
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
  watch: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

/** Background observatory — alerts only, not chat */
export function CommunityObservatory({ alerts }: { alerts: ObservatoryAlert[] }) {
  if (!alerts.length) return null;

  return (
    <BlueGlowCard variant="subtle" className="space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-resolve-accent" />
        <h2 className="text-sm font-semibold text-white">Observatory</h2>
        <span className="text-[10px] uppercase tracking-wider text-resolve-muted">background watch</span>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={clsx(
              "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
              SEVERITY_STYLES[a.severity],
            )}
          >
            {a.severity === "positive" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="mt-0.5 text-xs opacity-80">{a.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </BlueGlowCard>
  );
}
