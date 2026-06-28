"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";

type CommunitySummary = {
  slug: string;
  installed: boolean;
};

const KINDS = ["all", "music", "oss", "research", "protocol"] as const;

export function DiscoverCommunities() {
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");

  useEffect(() => {
    void fetch("/api/communities", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { communities: [] }))
      .then((d: { communities?: CommunitySummary[] }) => {
        const map: Record<string, boolean> = {};
        for (const c of d.communities ?? []) map[c.slug] = c.installed;
        setInstalled(map);
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMUNITY_CATALOG.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
      );
    });
  }, [query, kind]);

  return (
    <section className="mb-12">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
        Community directory
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white">Install RESOLVE where communities live</h2>
      <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
        Not a marketplace — attach doctrine, programs, and Arc settlement to worlds that already exist.
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search music, OSS, research…"
            className="w-full rounded-xl border border-resolve-border bg-resolve-bg-deep/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? "rounded-full border border-resolve-accent/40 bg-resolve-accent/10 px-3 py-1 text-[11px] text-resolve-accent"
                  : "rounded-full border border-resolve-border/60 px-3 py-1 text-[11px] text-resolve-muted hover:text-white"
              }
            >
              {k === "all" ? "All" : k}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {filtered.map((c) => (
          <InstallResolveCard
            key={c.slug}
            community={c}
            installed={installed[c.slug]}
            onInstalled={() => setInstalled((prev) => ({ ...prev, [c.slug]: true }))}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-sm text-resolve-muted">No communities match your search.</p>
      )}
    </section>
  );
}
