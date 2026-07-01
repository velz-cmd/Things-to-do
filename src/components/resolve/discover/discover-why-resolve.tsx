"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import {
  RESOLVE_DOCTRINE,
  RESOLVE_EMOTIONAL_HOOKS,
  RESOLVE_EXISTENTIAL_THESIS,
  RESOLVE_SETTLEMENT_LINE,
} from "@/lib/discover/resolve-doctrine";

/** Compact "why RESOLVE exists" — emotional hooks, not feature lists. */
export function DiscoverWhyResolve({ className }: { className?: string }) {
  return (
    <DiscoverCapitalCard className={className} padding={false}>
      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Why RESOLVE exists
        </p>
        <p className="mt-2 text-base font-medium leading-snug text-white">
          {RESOLVE_EXISTENTIAL_THESIS}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{RESOLVE_DOCTRINE}</p>
        <p className="mt-3 text-[11px] text-resolve-muted-dim">{RESOLVE_SETTLEMENT_LINE}</p>

        <ul className="mt-4 space-y-2">
          {RESOLVE_EMOTIONAL_HOOKS.map((hook) => (
            <li key={hook.who} className="text-xs leading-relaxed text-resolve-muted">
              <span className="font-medium text-white/90">{hook.who}:</span> {hook.hook}
            </li>
          ))}
        </ul>

        <Link
          href="/program"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
        >
          See role transformations
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </DiscoverCapitalCard>
  );
}
