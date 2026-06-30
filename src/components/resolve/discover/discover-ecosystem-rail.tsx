"use client";

import Link from "next/link";
import { ECOSYSTEM_LOOP } from "@/lib/capital/ecosystem-program";

/** Compact bootstrap loop — Discover-only, not the full Program tab. */
export function DiscoverEcosystemRail({ className }: { className?: string }) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted-dim">
            Value loop
          </p>
          <p className="mt-1 text-xs text-resolve-muted">
            Observe where work already happens — then authorize, fulfill, claim.
          </p>
        </div>
        <Link href="/program" className="text-[11px] text-resolve-accent hover:underline">
          Full role guide →
        </Link>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ECOSYSTEM_LOOP.map((step) => (
          <li
            key={step.step}
            className="rounded-xl border border-white/[0.06] bg-[#0a0f18]/50 px-4 py-3"
          >
            <p className="text-[10px] font-semibold tabular-nums text-resolve-accent">
              {step.step}
            </p>
            <p className="mt-1 text-sm font-medium text-white">{step.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
