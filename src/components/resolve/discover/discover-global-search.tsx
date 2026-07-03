"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { DiscoverAction, DiscoverSearchResult } from "@/lib/discover/types";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";

type SearchMeta = {
  topPrimaryAction: DiscoverAction | null;
  queueFilter: string | null;
};

type DiscoverGlobalSearchProps = {
  signedIn: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onQueueFilter?: (filter: string | null) => void;
};

export function DiscoverGlobalSearch({
  signedIn,
  query,
  onQueryChange,
  onQueueFilter,
}: DiscoverGlobalSearchProps) {
  const { runAction } = useDiscoverActions();
  const [results, setResults] = useState<DiscoverSearchResult[]>([]);
  const [meta, setMeta] = useState<SearchMeta>({ topPrimaryAction: null, queueFilter: null });
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setMeta({ topPrimaryAction: null, queueFilter: null });
      onQueueFilter?.(null);
      return;
    }
    const t = setTimeout(() => {
      const runSearch = () => {
        setLoading(true);
        setSearchError(null);
        return fetch(`/api/discover/search?q=${encodeURIComponent(q)}`)
          .then((r) => {
            if (!r.ok) throw new Error("Search failed");
            return r.json();
          })
          .then((d) => {
            setResults(d.results ?? []);
            const nextMeta = {
              topPrimaryAction: d.topPrimaryAction ?? null,
              queueFilter: d.queueFilter ?? null,
            };
            setMeta(nextMeta);
            onQueueFilter?.(nextMeta.queueFilter);
          })
          .catch(() => {
            setSearchError("Search unavailable");
            setResults([]);
            setMeta({ topPrimaryAction: null, queueFilter: null });
            onQueueFilter?.(null);
            discoverFetchErrorToast("discover-search", "Search unavailable", runSearch, false);
          })
          .finally(() => setLoading(false));
      };
      void runSearch();
    }, 280);
    return () => clearTimeout(t);
  }, [query, onQueueFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const { topPrimaryAction, queueFilter } = metaRef.current;

    if (queueFilter) {
      onQueueFilter?.(queueFilter);
      document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (topPrimaryAction) {
      await runAction(topPrimaryAction, "global-search");
      return;
    }

    if (results[0]?.actions[0]) {
      await runAction(results[0].actions[0], "global-search");
    }
  }

  return (
    <DiscoverCapitalCard className="discover-search-card" padding={false}>
      <div className="relative p-3.5">
      <form onSubmit={(e) => void handleSubmit(e)} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-accent" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="owner/repo | @maintainer | artist | fund react | launch royalty pool | 0x..."
          className="w-full rounded-xl border border-resolve-accent/25 bg-[#060a12]/80 py-3 pl-11 pr-4 text-sm text-white shadow-[0_0_32px_rgba(96,165,250,0.06)] placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
        />
      </form>

      <p className="mt-2 text-[11px] text-resolve-muted-dim">
        Enter runs the top result action: create, fund, connect, claim, or start analysis.
      </p>

      {query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-resolve-border/60 bg-[#0a0f18]/95 shadow-2xl backdrop-blur">
          {loading ? (
            <p className="px-4 py-3 text-xs text-resolve-muted">Searching network...</p>
          ) : !results.length ? (
            <p className="px-4 py-3 text-xs text-resolve-muted">
              No matches. Try owner/repo, @username, or an artist name.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-resolve-border/40 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{r.label}</p>
                      <p className="text-[11px] text-resolve-muted">{r.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DiscoverSourceBadge source={r.dataSource} />
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase text-resolve-muted-dim">
                        {r.kind}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.actions.map((a) => (
                      <DiscoverActionChip
                        key={a.id}
                        action={a}
                        signedIn={signedIn}
                        primary={a.kind === "fund" || a.kind === "open"}
                        surface="global-search"
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </DiscoverCapitalCard>
  );
}
