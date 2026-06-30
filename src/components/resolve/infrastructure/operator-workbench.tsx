"use client";

import Link from "next/link";
import { ArrowRight, Settings, Users, Wallet } from "lucide-react";
import { buildRoleWorkbench } from "@/lib/economy/actor-routing";

type Props = {
  role?: "founder" | "operator";
};

export function OperatorWorkbench({ role = "founder" }: Props) {
  const workbench = buildRoleWorkbench(role);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-200/80">
            {workbench.label} console
          </p>
          <p className="mt-1 text-sm font-medium text-white">{workbench.headline}</p>
        </div>
        <Link
          href="/program"
          className="shrink-0 text-[11px] text-resolve-accent hover:underline"
        >
          Full infrastructure
        </Link>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {workbench.workflows.slice(0, 4).map((w) => (
          <li key={w.step}>
            <Link
              href={w.href}
              className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 transition hover:border-white/15"
            >
              <span className="font-mono text-[10px] text-resolve-accent">{w.step}</span>
              <div>
                <p className="text-xs font-medium text-white">{w.title}</p>
                <p className="text-[10px] text-resolve-muted">{w.detail}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white hover:bg-white/[0.06]"
        >
          <Settings className="h-3 w-3" />
          Sensors
        </Link>
        <Link
          href="/capital?tab=programs"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white hover:bg-white/[0.06]"
        >
          <Wallet className="h-3 w-3" />
          Funder queue
        </Link>
        <Link
          href="/program"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-resolve-accent hover:bg-white/[0.06]"
        >
          <Users className="h-3 w-3" />
          Operator docs
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
