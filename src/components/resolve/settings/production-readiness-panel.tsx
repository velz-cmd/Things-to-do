"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProductionDemoReadiness, ReadinessItem } from "@/lib/demo/production-readiness";
import clsx from "clsx";
import { CheckCircle2, AlertCircle, Circle, Rocket, ExternalLink } from "lucide-react";

function StatusIcon({ status }: { status: ReadinessItem["status"] }) {
  if (status === "ready") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "partial") return <Circle className="h-4 w-4 text-amber-300" />;
  return <AlertCircle className="h-4 w-4 text-red-400" />;
}

export function ProductionReadinessPanel() {
  const [data, setData] = useState<ProductionDemoReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/status/demo-readiness")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-resolve-muted">Loading production status…</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-resolve-muted">
        Could not load production status. Try{" "}
        <a href="/api/status/demo-readiness" className="text-resolve-accent hover:underline">
          /api/status/demo-readiness
        </a>
      </p>
    );
  }

  const pct = Math.round((data.score / data.total) * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-resolve-accent/10 via-transparent to-transparent p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-resolve-accent" />
              <p className="text-sm font-semibold text-white">Production readiness</p>
            </div>
            <p className="mt-2 text-xs text-resolve-muted">
              Live env, treasury, music ingress, and claims — nothing cosmetic.{" "}
              <span className="text-white">{pct}% ready</span> ({data.score.toFixed(1)}/
              {data.total})
            </p>
          </div>
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
              data.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200",
            )}
          >
            {data.ok ? "Ready" : "Setup needed"}
          </span>
        </div>
        {data.demoMode && (
          <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Synthetic credits are still enabled — set{" "}
            <code className="text-amber-50">DEPUTY_DEMO_MODE=false</code> on Vercel Production
            and redeploy before external review.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {data.items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-resolve-muted">{item.detail}</p>
                {item.action && (
                  <p className="mt-1.5 text-[11px] text-resolve-muted-dim">
                    {item.href?.startsWith("http") ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
                      >
                        {item.action}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : item.href?.startsWith("/") ? (
                      <Link href={item.href} className="text-resolve-accent hover:underline">
                        {item.action}
                      </Link>
                    ) : (
                      item.action
                    )}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["music", "bounty", "claim"] as const).map((path) => (
          <div
            key={path}
            className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted">
              {path} flow
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-resolve-muted">
              {data.paths[path].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/** @deprecated use ProductionReadinessPanel */
export const DemoReadinessPanel = ProductionReadinessPanel;
