"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { DiscoverSearchResult } from "@/lib/discover/types";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";

type DiscoverGlobalSearchProps = {
  signedIn: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function DiscoverGlobalSearch({
  signedIn,
  query,
  onQueryChange,
  onSubmit,
}: DiscoverGlobalSearchProps) {
  const [results, setResults] = useState<DiscoverSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      void fetch(`/api/discover/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <section className="relative">
      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-resolve-accent" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="GitHub repo, DAO, artist, research, community, creator…"
          className="w-full rounded-2xl border border-resolve-accent/25 bg-[#060a12]/80 py-4 pl-12 pr-4 text-sm text-white shadow-[0_0_40px_rgba(96,165,250,0.08)] placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
        />
      </form>

      <p className="mt-2 text-[11px] text-resolve-muted-dim">
        Actions: open entity · install sensor · create program · fund gap · claim identity
      </p>

      {query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-resolve-border/60 bg-[#0a0f18]/95 shadow-2xl backdrop-blur">
          {loading ? (
            <p className="px-4 py-3 text-xs text-resolve-muted">Searching network…</p>
          ) : !results.length ? (
            <p className="px-4 py-3 text-xs text-resolve-muted">
              No matches — press Enter to scan radars
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
                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase text-resolve-muted-dim">
                      {r.kind}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.actions.slice(0, 5).map((a) => (
                      <DiscoverActionChip
                        key={a.id}
                        action={a}
                        signedIn={signedIn}
                        primary={a.kind === "fund" || a.kind === "open"}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
