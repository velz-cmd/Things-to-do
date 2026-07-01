"use client";

import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import {
  GAPS_TAB_EXAMPLES,
  GAPS_TAB_INTRO,
  gapsConnectLinks,
  gapsEmptyMessage,
} from "@/lib/discover/gaps-empty-state";
import { DiscoverStatePanel } from "@/components/resolve/discover/discover-state-panel";

export function DiscoverGapsEmpty({
  needType,
  role,
  degraded,
}: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  degraded?: boolean;
}) {
  const links = gapsConnectLinks({ needType, role });

  return (
    <DiscoverStatePanel variant="empty">
      <p className="text-sm leading-relaxed text-resolve-muted">{GAPS_TAB_INTRO}</p>

      <ul className="mt-3 space-y-1.5">
        {GAPS_TAB_EXAMPLES.map((example) => (
          <li key={example} className="flex items-start gap-2 text-[11px] text-white/80">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-resolve-accent" />
            {example}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-resolve-muted">{gapsEmptyMessage(needType)}</p>

      {degraded && (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Some sources were slow — community links below still work.
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="group flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 transition hover:border-resolve-accent/30 hover:bg-resolve-accent/[0.06]"
          >
            <span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                <Radio className="h-3 w-3 text-resolve-calm-periwinkle" />
                {link.label}
              </span>
              <span className="mt-0.5 block text-[10px] text-resolve-muted-dim">{link.hint}</span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-resolve-muted transition group-hover:text-resolve-accent" />
          </Link>
        ))}
      </div>

      <Link
        href="/profile"
        className="mt-4 inline-block text-[11px] font-medium text-resolve-calm-blue hover:text-resolve-accent"
      >
        Or connect sensors on Profile →
      </Link>
    </DiscoverStatePanel>
  );
}
