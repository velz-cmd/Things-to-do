"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useMissionScope } from "@/lib/mission/mission-context";
import { IntelligenceBriefing } from "@/components/resolve/intelligence/intelligence-briefing";
import { DiscoverCommunities } from "@/components/resolve/discover/discover-communities";
import { DiscoverLiveFeed } from "@/components/resolve/discover/discover-live-feed";
import { DiscoverGraphPreview } from "@/components/resolve/discover/discover-graph-preview";
import type { FundingOpportunity } from "@/lib/github/types";

const DOMAINS = [
  "Communities",
  "Projects",
  "Creators",
  "Libraries",
  "Music",
  "Research",
  "Design",
  "Datasets",
] as const;

/** Observe — where value already exists. Mission entry, not connector admin. */
export function DiscoverSurface() {
  const { enterMission } = useMissionScope();
  const [query, setQuery] = useState("");
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/github/opportunities")
      .then((r) => r.json())
      .then((d) => setOpportunities(d.opportunities ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = opportunities.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.fullName.toLowerCase().includes(q) || o.headline.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Observe
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Where does value already exist?</h1>
        <p className="mt-2 max-w-2xl text-sm text-resolve-muted">
          Communities, projects, creators — pick a mission and everything else follows that context.
        </p>
      </header>

      <IntelligenceBriefing className="mb-10 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/30 p-6" />

      <DiscoverLiveFeed />

      <DiscoverGraphPreview />

      <DiscoverCommunities />

      <p className="mb-8 text-center">
        <Link
          href="/communities"
          className="text-xs font-medium text-resolve-accent hover:underline"
        >
          Open Communities hub →
        </Link>
      </p>

      <form
        className="relative mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          enterMission(query);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repository, community, creator, or ask a question…"
          className="w-full rounded-xl border border-resolve-border bg-resolve-bg-deep/40 py-3 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
        />
      </form>

      <div className="mb-8 flex flex-wrap gap-2">
        {DOMAINS.map((d) => (
          <span
            key={d}
            className="rounded-full border border-resolve-border/60 px-3 py-1 text-[11px] text-resolve-muted"
          >
            {d}
          </span>
        ))}
      </div>

      <section>
        <p className="text-sm font-semibold text-white">Funding opportunities</p>
        <p className="mt-1 text-xs text-resolve-muted">
          Underfunded maintainers and communities — enter any as a mission.
        </p>
        {loading ? (
          <p className="mt-6 text-sm text-resolve-muted">Scanning open ecosystems…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-sm text-resolve-muted">No opportunities match your search.</p>
        ) : (
          <ul className="mt-4 divide-y divide-resolve-border/60">
            {filtered.slice(0, 12).map((o) => (
              <li key={o.fullName} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{o.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-resolve-muted">{o.headline}</p>
                </div>
                <button
                  type="button"
      onClick={() => enterMission(o.fullName)}
                  className="shrink-0 rounded-lg border border-resolve-accent/30 px-3 py-1.5 text-xs font-medium text-resolve-accent hover:bg-resolve-accent/10"
                >
                  Enter mission
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-resolve-muted-dim">
        <Link href="/mission" className="text-resolve-accent hover:underline">
          Open Mission →
        </Link>
      </p>
    </div>
  );
}
