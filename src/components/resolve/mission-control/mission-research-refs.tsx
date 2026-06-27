"use client";

import { ExternalLink } from "lucide-react";
import type { ResearchReference } from "@/lib/mission/capabilities/types";

/** In-chat research references — like Elsa citing routes and sources. */
export function MissionResearchRefs({ references }: { references: ResearchReference[] }) {
  if (!references.length) return null;

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        References
      </p>
      <ul className="space-y-2">
        {references.map((ref) => (
          <li key={ref.url}>
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 text-left"
            >
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-resolve-accent/70 group-hover:text-resolve-accent" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-white group-hover:text-resolve-accent">
                  {ref.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-resolve-muted">
                  {ref.snippet}
                </p>
                <p className="mt-0.5 text-[10px] text-resolve-muted-dim">{ref.provider}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
